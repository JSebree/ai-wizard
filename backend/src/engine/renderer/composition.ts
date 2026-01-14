
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import ffprobePath from '@ffprobe-installer/ffprobe';
import { EDL, Clip, Track } from '../common/types';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { CONFIG } from '../../config';

// Set paths
ffmpeg.setFfmpegPath(ffmpegPath.path);
ffmpeg.setFfprobePath(ffprobePath.path);

export interface CompositionOptions {
    outputDir: string;
    jobId: string;
    title?: string; // Video title for output filename (e.g., "Baby Zuck part 4")
}

export class CompositionEngine {
    private options: CompositionOptions;

    constructor(options: CompositionOptions) {
        this.options = options;
        // Ensure output dir exists
        if (!fs.existsSync(this.options.outputDir)) {
            fs.mkdirSync(this.options.outputDir, { recursive: true });
        }
    }

    // Slugify title for safe filename
    private getOutputFilename(): string {
        const timestamp = Date.now();
        if (this.options.title) {
            // Convert title to URL-safe slug: lowercase, replace spaces/special chars with underscores
            const slug = this.options.title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '') // Trim leading/trailing underscores
                .slice(0, 80); // Limit length to leave room for timestamp
            return `${slug}_${timestamp}.mp4`;
        }
        return `${this.options.jobId}_${timestamp}.mp4`;
    }

    private async downloadAsset(url: string, destPath: string) {
        if (fs.existsSync(destPath)) return; // Cache hit

        const writer = fs.createWriteStream(destPath);
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        });

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    }

    private async probeClip(filePath: string): Promise<boolean> {
        return new Promise((resolve) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) {
                    console.warn(`[Composition] Probe failed for ${filePath}, assuming no audio.`);
                    resolve(false);
                } else {
                    const hasAudio = metadata.streams.some(s => s.codec_type === 'audio');
                    resolve(hasAudio);
                }
            });
        });
    }

    public async render(edl: EDL): Promise<string> {
        console.log(`[Composition] Starting render for Job ${this.options.jobId}`);
        const tempDir = path.join(this.options.outputDir, 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        // 1. Download all assets
        console.log(`[Composition] Downloading assets...`);
        const allClips = [
            ...edl.tracks.video.flatMap(t => t.clips),
            ...edl.tracks.audio.flatMap(t => t.clips)
        ];

        const assetMap = new Map<string, string>(); // url -> localPath

        await Promise.all(allClips.map(async (clip) => {
            if (!clip.src) return;
            const filename = `${clip.id}_${path.basename(clip.src).split('?')[0]}`;
            // sanitize filename
            const safeFilename = filename.replace(/[^a-z0-9.]/gi, '_');
            const localPath = path.join(tempDir, safeFilename);

            await this.downloadAsset(clip.src, localPath);
            assetMap.set(clip.src, localPath);
        }));

        // 2. Build FFmpeg Command
        // We will use the "concat demuxer" approach or complex filter. 
        // For precise editing with images+video+audio mixed, complex filter is best but can be complex.
        // A simpler approach for A-Roll (sequential clips) is to normalize them and concat.

        // Let's implement a concat-based approach for the video track for now.
        // We need to ensure all video clips are same resolution/fps.
        // If they are images, we loop them.

        const outputPath = path.join(this.options.outputDir, this.getOutputFilename());
        const command = ffmpeg();

        // --- Video Inputs ---
        let complexFilter: string[] = [];
        let inputCount = 0;
        let videoStreams: string[] = [];
        // let audioStreams: string[] = []; // If video has audio

        // Helper to add input
        const addInput = (clip: Clip) => {
            const localPath = assetMap.get(clip.src);
            if (!localPath) throw new Error(`Missing local path for ${clip.src}`);

            command.input(localPath);

            // If image, loop it
            if (clip.type === 'image') {
                command.inputOptions(['-loop 1', `-t ${clip.out - clip.in}`]);
            } else if (clip.type === 'video') {
                // If we need to trim?
                // For now assuming source matches target duration generally
                // But safer to add trim filter
            }
            return inputCount++;
        };

        // --- Process Main Video & Embedded Audio Tracks ---
        const videoTrack = edl.tracks.video[0]; // Assume single track for MVP
        let concatInputs: string[] = [];

        for (const [i, clip] of videoTrack.clips.entries()) {
            const idx = addInput(clip);
            const duration = clip.out - clip.in;

            // Video Filter Part
            const w = edl.resolution.width;
            const h = edl.resolution.height;
            const streamLabel = `[v${idx}]`;

            complexFilter.push(`[${idx}:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${edl.fps},format=yuv420p${streamLabel}`);
            videoStreams.push(streamLabel);

            // Audio Filter Part (Embedded)
            // Check if this input has audio
            const localPath = assetMap.get(clip.src);
            let hasAudio = false;
            if (clip.type === 'video' && localPath) {
                hasAudio = await this.probeClip(localPath);
            }

            if (hasAudio) {
                // Use the video's audio stream
                concatInputs.push(`${streamLabel}[${idx}:a]`);
            } else {
                // Generate Silence matching duration
                // Using anullsrc. Note: simple 'anullsrc' produces infinite stream, strictly need 'd' or 't'
                const silentLabel = `[s${idx}]`;
                complexFilter.push(`anullsrc=r=44100:cl=stereo:d=${duration}[${silentLabel}]`);
                concatInputs.push(`${streamLabel}${silentLabel}`);
            }
        }

        // Concat: v=1:a=1
        // [v0][a0][v1][s1]...concat
        // Result is [vMain] and [aEmbedded]
        const concatFilter = `${concatInputs.join('')}concat=n=${videoTrack.clips.length}:v=1:a=1[vMain][aEmbedded]`;
        complexFilter.push(concatFilter);

        // --- Process Audio Tracks (Mixing) ---
        // Strategy:
        // 1. [aEmbedded] is our Base Speech Track (sync locked to video)
        // 2. Add [aNarration] and [aMusic] as layers
        // 3. Mix all

        let audioMixParts: string[] = ['[aEmbedded]'];

        edl.tracks.audio.forEach((track, trackIdx) => {
            console.log(`[Composition] Processing Audio Track '${track.name}' with ${track.clips.length} clips.`);
            track.clips.forEach((clip, clipIdx) => {
                const idx = addInput(clip);
                // adelay uses milliseconds
                const delayMs = Math.floor(clip.timelineStart * 1000);
                const label = `aT${trackIdx}C${clipIdx}`;

                // Determine volume (track level or clip level)
                const vol = clip.volume ?? (track.name === 'music' ? 0.3 : 1.0);

                // Apply volume & delay
                complexFilter.push(`[${idx}:a]volume=${vol},adelay=${delayMs}|${delayMs}[${label}]`);
                audioMixParts.push(`[${label}]`);
            });
        });

        if (audioMixParts.length > 0) {
            complexFilter.push(`${audioMixParts.join('')}amix=inputs=${audioMixParts.length}:duration=longest[aMain]`);
        } else {
            // No audio? generated silence
            complexFilter.push(`anullsrc=channel_layout=stereo:sample_rate=44100[aMain]`);
        }

        // --- Execute ---
        command
            .complexFilter(complexFilter)
            .outputOptions(['-map [vMain]', '-map [aMain]', '-c:v libx264', '-c:a aac', '-pix_fmt yuv420p', '-shortest'])
            .output(outputPath);

        return new Promise((resolve, reject) => {
            command
                .on('start', (cmd: string) => console.log('FFmpeg Start:', cmd))
                .on('end', async () => {
                    console.log(`[Composition] Render complete: ${outputPath}`);
                    try {
                        const url = await this.uploadToS3(outputPath, this.getOutputFilename());
                        resolve(url);
                    } catch (e) {
                        reject(e);
                    }
                })
                .on('error', (err: any) => reject(err))
                .run();
        });
    }

    private async uploadToS3(filePath: string, key: string): Promise<string> {
        console.log(`[S3] Uploading ${key} to ${CONFIG.SPACES_BUCKET || 'media-catalog'}/renders`);

        const fileContent = fs.readFileSync(filePath);
        const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

        // Use custom endpoint for "media-catalog" if different from main config
        // Defaulting to "nyc3" for this user request
        const s3 = new S3Client({
            endpoint: "https://nyc3.digitaloceanspaces.com",
            region: "nyc3",
            forcePathStyle: true,
            credentials: {
                accessKeyId: CONFIG.SPACES_KEY || "",
                secretAccessKey: CONFIG.SPACES_SECRET || ""
            }
        });

        // User requested: media-catalog.nyc3... /renders
        const bucket = "media-catalog";
        const folder = "renders";
        const fullKey = `${folder}/${key}`;

        const command = new PutObjectCommand({
            Bucket: bucket,
            Key: fullKey,
            Body: fileContent,
            ContentType: 'video/mp4',
            ACL: 'public-read'
        });

        await s3.send(command);

        // Path-style URL format for DigitalOcean Spaces
        const url = `https://nyc3.digitaloceanspaces.com/${bucket}/${fullKey}`;
        console.log(`[S3] Upload successful: ${url}`);
        return url;
    }
}
