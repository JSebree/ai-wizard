
import axios from 'axios';
import { CONFIG } from '../../config';

// Logic derived from "Captions Builder.json"
// Endpoint: https://n8n-nca-toolkit-9mavn.ondigitalocean.app/v1/video/caption

// Endpoint: https://n8n.simplifies.click/webhook/render-captions
const N8N_CAPTION_URL = "https://n8n.simplifies.click/webhook/render-captions";
const API_KEY = process.env.TOOLKIT_API_KEY || "Header Auth account";

interface CaptionInput {
    video_url: string;
    style?: any;
    requestId?: string;
    webhook_url?: string;
    doUpscale?: boolean; // New Backend Flag
}

interface CaptionOutput {
    captioned_video_url: string;
    jobId?: string;
}

export async function generateCaptions(input: CaptionInput): Promise<CaptionOutput> {
    console.log(`[Captions] Requesting captions for: ${input.video_url}`);

    // Logic from "Payload Builder" node in JSON
    // Default style
    const baseStyle = {
        line_color: "#FFFFFF",
        word_color: "#FFFF00",
        all_caps: false,
        max_words_per_line: 3,
        font_size: 40,
        font_family: "The Bold Font",
        position: "bottom_center",
        style: "highlight",
        ...input.style
    };

    const payload = {
        id: input.requestId || `cap-${Date.now()}`,
        video_url: input.video_url,
        replace: [],
        settings: baseStyle,
        webhook_url: input.webhook_url || "https://n8n.simplifies.click/webhook/render-captions",
        doUpscale: input.doUpscale // Pass to n8n
    };

    try {
        console.log(`[Captions] Sending job to n8n: ${N8N_CAPTION_URL}`);

        // Increase timeout to 5 minutes since n8n might be processing synchronously
        const { data } = await axios.post(N8N_CAPTION_URL, payload, {
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            timeout: 300000 // 5 minutes
        });

        console.log("[Captions] Job Response:", data);

        // 1. Direct Success (Synchronous Workflow)
        if (data.output_url || data.captioned_video_url || data.caption_url) {
            const finalUrl = data.output_url || data.captioned_video_url || data.caption_url;
            console.log(`[Captions] Received URL directly: ${finalUrl}`);
            return {
                captioned_video_url: finalUrl,
                jobId: payload.id
            };
        }

        // 2. Fallback: URL Prediction & Polling (Asynchronous Workflow)
        // If n8n returns early without a URL, we look for it in the bucket.
        // Path-style URL format for DigitalOcean Spaces
        const predictedUrl = `https://nyc3.digitaloceanspaces.com/n8n-nca-bucket/n8n-nca-bucket/${payload.id}_captioned.mp4`;

        console.log(`[Captions] No URL in response, polling for file: ${predictedUrl}`);
        let attempts = 0;
        const maxAttempts = 30; // 30 * 2s = 60s

        while (attempts < maxAttempts) {
            try {
                // Check if file exists (HEAD request)
                await axios.head(predictedUrl);
                console.log(`[Captions] File confirmed at attempt ${attempts + 1}`);
                return {
                    captioned_video_url: predictedUrl,
                    jobId: payload.id
                };
            } catch (err: any) {
                if (err.response?.status === 404 || err.response?.status === 403) {
                    await new Promise(r => setTimeout(r, 2000));
                    attempts++;
                } else {
                    console.warn(`[Captions] Check failed: ${err.message}`);
                    break;
                }
            }
        }

        // If we fall through here, just return predicted and hope for the best
        return {
            captioned_video_url: predictedUrl,
            jobId: payload.id
        };

        return {
            captioned_video_url: predictedUrl,
            jobId: payload.id
        };

    } catch (e: any) {
        console.error("Captions Request Failed:", e.message);
        throw e;
    }
}
