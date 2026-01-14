
import { CONFIG } from '../../config';

// RunPod endpoint for A-Roll Video (LipSync/I2V)
const ENDPOINT_I2V = "https://api.runpod.ai/v2/tklzus2cinih6d/run";
const ENDPOINT_STATUS = "https://api.runpod.ai/v2/tklzus2cinih6d/status";

export interface VideoInput {
    image_url: string;
    audio_url: string;
    duration_sec: number; // Used to calc frames
}

export interface BRollInput {
    image_url: string;
    prompt: string;
    duration_sec: number;
}

export interface VideoOutput {
    video_url: string;
    last_frame_url?: string;
    jobId: string;
}

async function pollJob(jobId: string, endpointStatus: string, maxAttempts = 400): Promise<any> {
    let attempts = 0;
    while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 10000));
        attempts++;

        const statusRes = await fetch(`${endpointStatus}/${jobId}`, {
            headers: { 'Authorization': `Bearer ${CONFIG.RUNPOD_API_KEY}` }
        });
        if (!statusRes.ok) continue;
        const statusData: any = await statusRes.json();

        if (attempts % 6 === 0) console.log(`[Video] Poll ${attempts}/${maxAttempts}: ${statusData.status} (elapsed: ${attempts * 10}s)`);

        if (statusData.status === 'COMPLETED') {
            return statusData.output; // Return full output object
        } else if (statusData.status === 'FAILED') {
            throw new Error(`Video Gen Failed: ${JSON.stringify(statusData.error)}`);
        }
    }
    throw new Error("Video Gen Timeout");
}

export async function generateARollVideo(input: VideoInput): Promise<VideoOutput> {
    console.log(`[Video] Generating A-Roll (I2V/LipSync)...`);

    const fps = 30;
    const num_frames = Math.max(1, Math.round(input.duration_sec * fps));

    const payload = {
        input: {
            input_type: "image", // or "image" if model expects it
            person_count: "single", // A-Roll specific
            prompt: "A person is talking in a natural way.", // Standard prompt from n8n
            image_url: input.image_url,
            wav_url: input.audio_url,
            width: 960,
            height: 544,
            fps: fps,
            num_frames: num_frames,
            teacache: true,
            return_base64: false,
            filename: `aroll_${Date.now()}_${Math.random().toString(36).substring(7)}.mp4` // Unique suffix
        }
    };

    const startRes = await fetch(ENDPOINT_I2V, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CONFIG.RUNPOD_API_KEY}`
        },
        body: JSON.stringify(payload)
    });

    if (!startRes.ok) throw new Error(`Video Start Failed: ${startRes.statusText}`);
    const startData: any = await startRes.json();
    console.log(`[Video] A-Roll Job started: ${startData.id}`);

    const output = await pollJob(startData.id, ENDPOINT_STATUS);
    console.log(`[Video] Raw A-Roll Output Type: ${typeof output}`);
    console.log(`[Video] Raw A-Roll Output: ${JSON.stringify(output, null, 2)}`);

    // Extract logical fields from raw output
    // Handle case where output is just the URL string
    let video_url: string | undefined;

    if (typeof output === 'string' && output.startsWith('http')) {
        video_url = output;
    } else if (typeof output === 'object') {
        video_url = output.output_video_url ||
            output.video_url ||
            output.url ||
            output.s3_url ||
            output.output?.video_url ||
            output.output?.s3_url ||
            output.output?.artifacts?.video_url ||
            output.artifacts?.video_url || // Correct path based on pollJob return
            output.result ||
            (Array.isArray(output.results) ? output.results[0] : undefined);
    }

    const last_frame_url = (output as any).last_frame_url || (output as any).lastFrameUrl || (output as any).output?.last_frame_url || null;

    if (!video_url) {
        console.warn(`[Video] WARNING: Could not extract video_url from A-Roll output!`);
    } else {
        console.log(`[Video] Extracted A-Roll URL: ${video_url}`);
    }

    return { video_url: video_url!, last_frame_url, jobId: startData.id };
}

export async function generateBRollVideo(input: BRollInput): Promise<VideoOutput> {
    console.log(`[Video] Generating B-Roll (LTX/Hunyuan)...`);

    // LTX V2 Endpoint (qc9eozskjhwylz)
    const ENDPOINT_LTX = "https://api.runpod.ai/v2/qc9eozskjhwylz/run";
    const ENDPOINT_LTX_STATUS = "https://api.runpod.ai/v2/qc9eozskjhwylz/status";

    const fps = 24; // Cinematic default
    const num_frames = Math.round(input.duration_sec * fps);

    const payload = {
        input: {
            image: input.image_url, // 'image' key required by handler
            prompt: input.prompt,
            num_frames: num_frames,
            fps: fps,
            width: 960,
            height: 544,
            guidance_scale: 3.0,
            num_inference_steps: 25, // n8n uses 25
            enhance_prompt: true, // Internal prompt enhancement

            filename: `broll_${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`,
            return_base64: false
        }
    };

    const startRes = await fetch(ENDPOINT_LTX, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CONFIG.RUNPOD_API_KEY}`
        },
        body: JSON.stringify(payload)
    });

    if (!startRes.ok) throw new Error(`B-Roll Start Failed: ${startRes.statusText}`);
    const startData: any = await startRes.json();
    console.log(`[Video] B-Roll Job started: ${startData.id}`);

    const output = await pollJob(startData.id, ENDPOINT_LTX_STATUS);

    // Extract logical fields from raw output
    const video_url = output.output_video_url || output.video_url || output.url || output.s3_url || output.output?.video_url || output.output?.s3_url;
    const last_frame_url = output.last_frame_url || output.lastFrameUrl || output.output?.last_frame_url || null;

    return { video_url, last_frame_url, jobId: startData.id };
}
