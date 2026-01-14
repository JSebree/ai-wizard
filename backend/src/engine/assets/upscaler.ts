
import axios from 'axios';
import { CONFIG } from '../../config';

// Logic from "Upscaler.json"
// Endpoint: https://api.runpod.ai/v2/vt9zxj81obdvyh/run
// Status: https://api.runpod.ai/v2/vt9zxj81obdvyh/status/{id}

interface UpscalerInput {
    video_url: string;
    doHD?: boolean; // preset: "fast" vs "express" ?? 
    // JSON says: doHD ? 'fast' : 'express' -> 'fast' seems HD? Or maybe 'express' is faster/lower quality?
    // Let's check JSON: "preset = doHD ? 'fast' : 'express';"
    // "fast" usually implies quality/speed tradeoff.
    // Let's trust the logic: if doHD is true, use 'fast'. 
    title?: string;
}

interface UpscalerOutput {
    upscaled_video_url: string;
    jobId: string;
}

const RUNPOD_ID = "vt9zxj81obdvyh";
const RUNPOD_URL = `https://api.runpod.ai/v2/${RUNPOD_ID}/run`;
const RUNPOD_STATUS = `https://api.runpod.ai/v2/${RUNPOD_ID}/status`;

export async function generateUpscale(input: UpscalerInput): Promise<UpscalerOutput> {
    const doHD = input.doHD !== false; // Default to true if not specified? n8n uses input param.
    const preset = doHD ? 'fast' : 'express'; // Per JSON logic

    const safeTitle = (input.title || "video").replace(/[^a-zA-Z0-9\s\-_]/g, '').replace(/\s+/g, '-').toLowerCase();
    const timestamp = Date.now();
    const outputFilename = `${safeTitle}-${timestamp}`;

    const payload = {
        input: {
            video_url: input.video_url,
            preset, // 'fast' or 'express'
            outscale: 2,
            output_prefix: 'upscaled/episodes/',
            output_filename: outputFilename
        }
    };

    console.log(`[Upscaler] Starting job for ${input.video_url} (Preset: ${preset})`);

    // 1. Submit
    const { data: jobData } = await axios.post(RUNPOD_URL, payload, {
        headers: {
            'Authorization': `Bearer ${CONFIG.RUNPOD_API_KEY}`,
            'Content-Type': 'application/json'
        }
    });
    const jobId = jobData.id;
    console.log(`[Upscaler] Job ID: ${jobId}`);

    // 2. Poll
    let status = jobData.status;
    let finalUrl = null;

    while (status === "IN_QUEUE" || status === "IN_PROGRESS") {
        await new Promise(r => setTimeout(r, 5000));
        const { data: statusData } = await axios.get(`${RUNPOD_STATUS}/${jobId}`, {
            headers: { 'Authorization': `Bearer ${CONFIG.RUNPOD_API_KEY}` }
        });
        status = statusData.status;

        if (status === "COMPLETED") {
            // JSON: output.output_url || output.upscaled_video_url || output.video_url || output.url
            const out = statusData.output || {};
            finalUrl = out.output_url || out.upscaled_video_url || out.video_url || out.url;

            // Normalize to Path-Style if it's our bucket
            if (finalUrl && finalUrl.includes('nyc3.digitaloceanspaces.com')) {
                // Check if it's virtual-hosted: https://{bucket}.nyc3...
                const match = finalUrl.match(/https:\/\/([^\.]+)\.nyc3\.digitaloceanspaces\.com\/(.+)/);
                if (match) {
                    const bucket = match[1];
                    const key = match[2];
                    finalUrl = `https://nyc3.digitaloceanspaces.com/${bucket}/${key}`;
                    console.log(`[Upscaler] Normalized URL: ${finalUrl}`);
                }
            }
        } else if (status === "FAILED") {
            throw new Error(`Upscaler failed: ${JSON.stringify(statusData)}`);
        }
    }

    if (!finalUrl) throw new Error("Upscaler completed but no URL found.");

    return {
        upscaled_video_url: finalUrl,
        jobId
    };
}
