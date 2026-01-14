
import axios from 'axios';
import { CONFIG } from '../../config';

// Logic derived from "Music Builder.json"
// The n8n node hits: https://api.runpod.ai/v2/gllgz1ipfunewi/run

interface MusicInput {
    prompt: string;
    duration: number; // seconds
    tags?: string;
    seed?: number;
    // Optional: other parameters from n8n (vocals, tempo, etc.) can be folded into prompt/tags
}

interface MusicOutput {
    audio_url: string;
    duration_sec: number;
    jobId: string;
}

const RUNPOD_URL = "https://api.runpod.ai/v2/gllgz1ipfunewi/run";

export async function generateMusic(input: MusicInput): Promise<MusicOutput> {
    const payload = {
        input: {
            tags: input.tags || input.prompt, // n8n logic uses 'tags' as main driver
            duration: input.duration,
            seed: input.seed
        }
    };

    console.log(`[Music] Starting generation for: ${input.prompt} (${input.duration}s)...`);

    // 1. Submit Job
    const { data: jobData } = await axios.post(RUNPOD_URL, payload, {
        headers: {
            'Authorization': `Bearer ${CONFIG.RUNPOD_API_KEY}`, // Using same key as others, hoping it covers this endpoint
            'Content-Type': 'application/json'
        }
    });

    const jobId = jobData.id;
    console.log(`[Music] Job submitted: ${jobId}`);

    // 2. Poll for Completion
    let status = jobData.status;
    let result = null;

    while (status === "IN_QUEUE" || status === "IN_PROGRESS") {
        await new Promise(r => setTimeout(r, 5000)); // 5s poll
        const { data: statusData } = await axios.get(`${RUNPOD_URL.replace('/run', '/status')}/${jobId}`, {
            headers: { 'Authorization': `Bearer ${CONFIG.RUNPOD_API_KEY}` }
        });
        status = statusData.status;
        console.log(`[Music] Status: ${status}`);

        if (status === "COMPLETED") {
            result = statusData.output;
        } else if (status === "FAILED") {
            throw new Error(`Music generation failed: ${JSON.stringify(statusData)}`);
        }
    }

    if (!result || !result.audio || !result.audio.url) {
        throw new Error("Music generation completed but returned no audio URL.");
    }

    return {
        audio_url: result.audio.url,
        duration_sec: result.audio.duration_sec || input.duration,
        jobId: jobId
    };
}
