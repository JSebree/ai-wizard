
import { CONFIG } from '../../config';

// Endpoints (User Defined)
// 1. T2I: Qwen Image 2512 (26db11qogcpri6) -> Brand new images, B-roll
// 2. I2I: Qwen Image Editor 1211 (ftcydbizpxj4o3) -> Editing, Reference images
const ENDPOINT_T2I = "https://api.runpod.ai/v2/26db11qogcpri6/run";
const ENDPOINT_T2I_STATUS = "https://api.runpod.ai/v2/26db11qogcpri6/status";

const ENDPOINT_I2I = "https://api.runpod.ai/v2/ftcydbizpxj4o3/run";
const ENDPOINT_I2I_STATUS = "https://api.runpod.ai/v2/ftcydbizpxj4o3/status";

export interface KeyframeInput {
    prompt: string;
    negative_prompt?: string;
    width?: number;
    height?: number;
    num_inference_steps?: number;
    guidance_scale?: number;
    seed?: number;
    image_urls?: string[]; // Array support
    strength?: number;
}

export interface KeyframeOutput {
    image_url: string;
    jobId: string;
}

export async function generateKeyframe(input: KeyframeInput): Promise<KeyframeOutput> {
    console.log(`[Image] Generating keyframe: "${input.prompt.substring(0, 50)}..."`);

    // 1. Determine Mode & Endpoint
    const hasReferenceImages = input.image_urls && input.image_urls.length > 0;

    let targetEndpointRun = ENDPOINT_T2I;
    let targetEndpointStatus = ENDPOINT_T2I_STATUS;
    let payload;

    if (hasReferenceImages) {
        // --- I2I Mode (Qwen Image Editor) ---
        targetEndpointRun = ENDPOINT_I2I;
        targetEndpointStatus = ENDPOINT_I2I_STATUS;

        // Payload: "Express Keyframe.json" Style
        payload = {
            input: {
                scene_prompt: input.prompt,
                negative_prompt: input.negative_prompt || "",
                width: input.width || 1024,
                height: input.height || 576,
                num_inference_steps: input.num_inference_steps || 30,
                guidance_scale: input.guidance_scale || 7.5,
                seed: input.seed ?? -1,

                // Img2Img Specifics
                image_urls: input.image_urls,
                reference_urls: input.image_urls,
                creative_edit: false,
                edit_strength: input.strength || 0.7,
                identity_emphasis: 2.2,
                true_guidance_scale: 2.4,
                preserve_identity: true,

                output: {
                    type: "scenes",
                    ext: "png",
                    root_prefix: "Catalog",
                    filename: "{name}_{job_id}"
                }
            }
        };
    } else {
        // --- T2I Mode (Qwen 2.5) ---
        targetEndpointRun = ENDPOINT_T2I;
        targetEndpointStatus = ENDPOINT_T2I_STATUS;

        // Payload: "Keyframe Image Builder.json" Style
        payload = {
            input: {
                prompt: input.prompt,
                negative_prompt: input.negative_prompt || "",
                width: input.width || 1024,
                height: input.height || 576,
                num_inference_steps: input.num_inference_steps || 30,
                guidance_scale: input.guidance_scale || 7.5,
                seed: input.seed ?? -1,

                output: {
                    type: "scenes",
                    ext: "png",
                    root_prefix: "Catalog",
                    filename: "{name}_{job_id}"
                }
            }
        };
    }

    // 2. Start Job
    const startRes = await fetch(targetEndpointRun, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CONFIG.RUNPOD_API_KEY}`
        },
        body: JSON.stringify(payload)
    });

    if (!startRes.ok) {
        throw new Error(`Image Gen Start Failed: ${startRes.status} ${startRes.statusText}`);
    }

    const startData: any = await startRes.json();
    const jobId = startData.id;
    console.log(`[Image] Job started (${hasReferenceImages ? 'I2I' : 'T2I'}): ${jobId}`);

    // 3. Poll for Completion
    let finalUrl: string | null = null;
    let attempts = 0;
    while (!finalUrl && attempts < 300) { // 300 * 2s = 600s = 10 minute timeout (I2I can be slow)
        await new Promise(r => setTimeout(r, 2000));
        attempts++;

        const statusRes = await fetch(`${targetEndpointStatus}/${jobId}`, {
            headers: { 'Authorization': `Bearer ${CONFIG.RUNPOD_API_KEY}` }
        });

        if (!statusRes.ok) continue;

        const statusData: any = await statusRes.json();
        const status = statusData.status;

        if (status === 'COMPLETED') {
            finalUrl = statusData.output?.image_url || statusData.output?.url || statusData.output?.result?.image_url;
        } else if (status === 'FAILED') {
            throw new Error(`Image Gen Failed: ${JSON.stringify(statusData.error)}`);
        }
    }

    if (!finalUrl) {
        throw new Error("Image Gen Timeout");
    }

    return { image_url: finalUrl, jobId };
}
