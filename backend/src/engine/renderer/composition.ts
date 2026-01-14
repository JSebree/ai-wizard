
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

        // --- Process Main Video Track ---
        // We will concat all video clips into one stream [vBase]
        const videoTrack = edl.tracks.video[0]; // Assume single track for MVP

        videoTrack.clips.forEach(clip => {
            const idx = addInput(clip);
            const duration = clip.out - clip.in;

            // Scaling and Setsar to ensure uniformity
            // Also fps=30
            // trim if video, loop if image (handled in inputOptions)

            // We need to give each input a label to concat
            const streamLabel = `[v${idx}]`;

            // Force resolution and fps normalization
            const w = edl.resolution.width;
            const h = edl.resolution.height;

            complexFilter.push(`[${idx}:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${edl.fps},format=yuv420p${streamLabel}`);
            videoStreams.push(streamLabel);
        });

        // Concat video
        const concatFilter = `${videoStreams.join('')}concat=n=${videoStreams.length}:v=1:a=0[vMain]`;
        complexFilter.push(concatFilter);

        // --- Process Audio Tracks ---
        // We have 'narration' and 'music'.
        // Narration usually aligns with clips (A-Roll) or is separate track (B-Roll).
        // Music is a background track.

        // Strategy: 
        // 1. Gather all dialogue/narration clips, normalize, offset delay, and mix into [aSpeech]
        // 2. Add Music track as [aMusic] with volume adaptation
        // 3. Mix [aSpeech] + [aMusic] -> [aFinal]

        // Actually simpler:
        // Use `amix` to mix all audio inputs.
        // We need to position them on the timeline using `adelay`.

        let audioOutputLabel = "[aMain]";
        let audioMixInputs: string[] = [];
        let audioInputIdxStart = inputCount;

        // Narration (if any separate inputs)
        // Note: For A-roll video clips, their audio IS the narration. 
        // The current Orchestrator seems to produce separate audio clips only for B-Roll voice?
        // Let's check Orchestrator logic: 
        // "If A-Roll... assume embedded audio".
        // "If B-Roll... audioClips.push(...)".

        // Wait, if we are doing complex filter concat for video, we stripped audio (a=0 in concat).
        // We need to extract audio from video clips too if they are A-roll!

        // REVISED Video Concat:
        // If clip is 'video', we should include its audio in the concat?
        // A-Roll videos have lipsync audio.
        // Image clips have no audio.

        // Let's refine the Video Concat to be Audio-Aware.
        // But some clips (Images) have no audio stream, so standard concat v=1:a=1 fails if a segment has no audio.
        // We must generate silent audio for image clips to keep streams aligned, OR handle audio separately.

        // Better Logic:
        // 1. Video Track: Concat all Video Only -> [vMain]
        // 2. Audio Track: Construct from:
        //    a. A-Roll Video keys (extract audio)
        //    b. B-Roll Narration keys (separate files)
        //    c. Music keys (separate files)

        // OR simply rely on the Orchestrator's `edl.tracks.audio`?
        // Orchestrator logic: 
        // "If A-Roll... don't push to audio clips (embedded)". -> This is a problem for the renderer if we process tracks separately.
        // The Renderer needs to know everything.

        // FIX: If A-Roll, we need to treat the Video File as an Audio Source as well.
        // But `edl.tracks.audio` currently doesn't include A-Roll audio.

        // Let's auto-detect:
        // Iterate timeline. If video track clip is 'video', use its audio as a 'speech' clip.
        // If 'audio' track clip exists, use it.

        // Implementation for MVP: 
        // We will build a unified list of Audio Clips with start times.
        // 1. From Video Track (if type='video')
        // 2. From Audio Track (Narration)
        // 3. From Music Track

        const audiolayerInputs: { idx: number, start: number, duration: number, volume: number }[] = [];

        // 1. Main Speech (from A-Roll video or Audio Clips)
        // We iterate the timeline of the MAIN video track.
        for (const [i, clip] of videoTrack.clips.entries()) {
            const inputIdx = i; // Corresponds to the video inputs we added earlier
            if (clip.type === 'video') {
                const localPath = assetMap.get(clip.src);
                if (localPath) {
                    const hasAudio = await this.probeClip(localPath);
                    if (hasAudio) {
                        audiolayerInputs.push({
                            idx: inputIdx,
                            start: clip.timelineStart,
                            duration: clip.out - clip.in,
                            volume: 1.0
                        });
                    } else {
                        console.log(`[Composition] Skipping silent video audio for clip ${clip.id}`);
                    }
                }
            }
        }

        // For A-Roll, the audio is contiguous usually.
        // Let's just blindly take `[i:a]` for every video clip? No, images fail.

        // 2. Explicit Audio Tracks
        edl.tracks.audio.forEach(track => {
            console.log(`[Composition] Processing Audio Track with ${track.clips.length} clips.`);
            track.clips.forEach(clip => {
                console.log(`[Composition] Adding Audio Input: ${clip.id}, Type=${clip.type}, Src=${clip.src}`);
                const idx = addInput(clip);
                audiolayerInputs.push({
                    idx,
                    start: clip.timelineStart,
                    duration: clip.out - clip.in,
                    volume: track.name === 'music' ? 0.15 : 1.0
                });
            });
        });

        // Now build the audio mix filter
        let audioMixParts: string[] = [];

        audiolayerInputs.forEach((item, i) => {
            // [idx:a] -> delay -> [aPartN]
            // Note: adelay uses milliseconds
            const delayMs = Math.floor(item.start * 1000);
            const label = `aPart${i}`; // Label without brackets for cleaner variable

            // adelay=3000|3000 for stereo.
            // map label [aPartN]
            complexFilter.push(`[${item.idx}:a]volume=${item.volume},adelay=${delayMs}|${delayMs}[${label}]`);
            audioMixParts.push(`[${label}]`);
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
