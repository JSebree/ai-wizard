
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
        // Refactoring to Object-based syntax for safety
        let complexFilter: any[] = [];
        let inputCount = 0;
        let videoStreams: string[] = []; // This is no longer used in the new object-based approach
        let audioMixedStreams: string[] = []; // Streams to go into concat (audio part)

        const addInput = (clip: Clip) => {
            const localPath = assetMap.get(clip.src);
            if (!localPath) throw new Error(`Missing local path for ${clip.src}`);
            command.input(localPath);
            if (clip.type === 'image') {
                command.inputOptions(['-loop 1', `-t ${clip.out - clip.in}`]);
            }
            return inputCount++;
        };

        // --- Process Main Video & Embedded Audio Tracks ---
        const videoTrack = edl.tracks.video[0];

        let concatInputs: string[] = []; // Strings like '[v0][a0]' for the concat filter inputs

        for (const [i, clip] of videoTrack.clips.entries()) {
            const idx = addInput(clip);
            const duration = clip.out - clip.in;
            const w = edl.resolution.width;
            const h = edl.resolution.height;

            // Video Filter
            complexFilter.push({
                filter: 'scale',
                options: { w, h, force_original_aspect_ratio: 'decrease' },
                inputs: `${idx}:v`,
                outputs: `vBase${idx}`
            });

            complexFilter.push({
                filter: 'pad',
                options: { w, h, x: '(ow-iw)/2', y: '(oh-ih)/2' },
                inputs: `vBase${idx}`,
                outputs: `vPad${idx}`
            });

            // Setsar/FPS chain
            // We can chain them or make separate objects. Separate is clearer.
            complexFilter.push({
                filter: 'setsar',
                options: '1',
                inputs: `vPad${idx}`,
                outputs: `vSar${idx}`
            });

            complexFilter.push({
                filter: 'fps',
                options: edl.fps,
                inputs: `vSar${idx}`,
                outputs: `vFps${idx}`
            });

            const finalVLabel = `v${idx}`;
            complexFilter.push({
                filter: 'format',
                options: 'yuv420p',
                inputs: `vFps${idx}`,
                outputs: finalVLabel
            });

            concatInputs.push(`[${finalVLabel}]`);

            // Audio Logic
            const localPath = assetMap.get(clip.src);
            let hasAudio = false;
            if (clip.type === 'video' && localPath) {
                hasAudio = await this.probeClip(localPath);
            }

            if (hasAudio) {
                concatInputs.push(`[${idx}:a]`);
            } else {
                const silentLabel = `s${idx}`;
                // Using anullsrc as a filter source
                complexFilter.push({
                    filter: 'anullsrc',
                    options: { sample_rate: 44100, channel_layout: 'stereo', duration: duration },
                    outputs: silentLabel
                });
                concatInputs.push(`[${silentLabel}]`);
            }
        }

        // Concat Filter
        complexFilter.push({
            filter: 'concat',
            options: { n: videoTrack.clips.length, v: 1, a: 1 },
            inputs: concatInputs.map(s => s.replace(/[\[\]]/g, '')), // Strip brackets for inputs array
            outputs: ['vMain', 'aEmbedded']
        });

        // --- Process Audio Tracks (Mixing) ---

        let audioMixParts: string[] = ['aEmbedded'];

        edl.tracks.audio.forEach((track, trackIdx) => {
            console.log(`[Composition] Processing Audio Track '${track.name}' with ${track.clips.length} clips.`);
            track.clips.forEach((clip, clipIdx) => {
                const idx = addInput(clip);
                const delayMs = Math.floor(clip.timelineStart * 1000);
                const label = `aT${trackIdx}C${clipIdx}`;

                const vol = clip.volume ?? (track.name === 'music' ? 0.3 : 1.0);

                // Volume Filter - use positional arg for compatibility
                const volLabel = `${label}Vol`;
                complexFilter.push({
                    filter: 'volume',
                    options: String(vol),  // positional: volume=0.05
                    inputs: `${idx}:a`,
                    outputs: volLabel
                });

                // ADelay Filter - use positional arg for compatibility
                complexFilter.push({
                    filter: 'adelay',
                    options: `${delayMs}|${delayMs}`,  // positional: adelay=7080|7080
                    inputs: volLabel,
                    outputs: label
                });

                audioMixParts.push(label);
            });
        });

        if (audioMixParts.length > 0) {
            complexFilter.push({
                filter: 'amix',
                options: { inputs: audioMixParts.length, duration: 'longest' },
                inputs: audioMixParts,
                outputs: 'aMain'
            });
        } else {
            // Fallback silence if no audio at all?
            // Usually aEmbedded exists, so this path is rare
            complexFilter.push({
                filter: 'anullsrc',
                options: { sample_rate: 44100, channel_layout: 'stereo' },
                outputs: 'aMain'
            });
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
