
import { CONFIG } from './config';

// Webhook URLs (Hardcoded for now as they are in the frontend config)
const API_CONFIG = {
    GENERATE_SCENE: "https://n8n.simplifies.click/webhook/generate-scene-preview",
    GENERATE_VOICE: "https://n8n.simplifies.click/webhook/generate-voice-preview",
    GENERATE_VIDEO: "https://n8n.simplifies.click/webhook/generate-video-preview",
    GENERATE_LIPSYNC: "https://n8n.simplifies.click/webhook/generate-lipsync-preview",
};

export interface SceneGenPayload {
    prompt: string;
    name: string;
    setting_image_url?: string;
    character_image_url?: string;
    setting_id?: string;
    character_id?: string;
    user_id: string;
    asset_type: "scene_creation";
}

export interface VoiceGenPayload {
    text: string;
    speaker: string;
    voice_id: string;
    pause_duration?: number;
}

export interface VideoGenPayload {
    clip_name: string;
    prompt: string;
    image_url: string;
    audio_url: string;
    motion?: string;
    num_frames: number;
    segments: any[]; // For lip-sync
    user_id: string;
}

// --- Image Generation ---
export async function generateSceneImage(payload: SceneGenPayload): Promise<string> {
    console.log(`[Asset] Generating Scene: ${payload.name}`);

    // Fallback if user_id is missing to start (could use a dev ID)
    const body = {
        ...payload,
        asset_type: "scene_creation",
        // Ensure defaults for n8n
        visual_style: "Cinematic",
        camera_angle: "Standard",
        color_grade: "Standard (None)",
    };

    const res = await fetch(API_CONFIG.GENERATE_SCENE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        throw new Error(`Scene Generation Failed: ${res.statusText}`);
    }

    const data: any = await res.json();
    // n8n usually returns { image_url: "..." } or { url: "..." }
    const url = data.image_url || data.url || (Array.isArray(data) ? data[0]?.url : null);

    if (!url) throw new Error("No image URL returned from Scene Generator");
    return url;
}

// --- Audio Generation ---
export async function generateVoice(payload: VoiceGenPayload): Promise<{ audioUrl: string, duration: number }> {
    console.log(`[Asset] Generating Voice for ${payload.speaker}: "${payload.text.substring(0, 20)}..."`);

    const body = {
        dialogue: [{
            text: payload.text,
            speaker: payload.speaker,
            voice_id: payload.voice_id || "en_us_001",
            pause_duration: payload.pause_duration || 0.5
        }]
    };

    const res = await fetch(API_CONFIG.GENERATE_VOICE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`Voice Generation Failed: ${res.statusText}`);

    const data: any = await res.json();

    // Handle array or object response
    const item = Array.isArray(data) ? data[0] : data;
    const audioUrl = item.output?.url || item.url || item.audio_url;

    // Simplistic duration calculation if not provided (samples / rate)
    let duration = 3.0;
    if (item.output?.duration_samples && item.output?.sampling_rate) {
        duration = item.output.duration_samples / item.output.sampling_rate;
    } else if (item.duration) {
        duration = item.duration;
    }

    if (!audioUrl) throw new Error("No audio URL returned from Voice Generator");

    return { audioUrl, duration };
}

// --- Video Generation ---
export async function generateVideo(payload: VideoGenPayload): Promise<string> {
    console.log(`[Asset] Generating Video: ${payload.clip_name}`);

    // Choose endpoint: If we have dialogue segments, might be lipsync?
    // Frontend logic: shot.speakerType === "on_screen" ? LIPSYNC : I2V
    // For now, let's assume I2V unless told otherwise, but Director likely wants speaking.
    // Let's use I2V_WEBHOOK (GENERATE_VIDEO) as default for "Action" shots.

    // TODO: Determine if we need LipSync based on payload.
    // For now, use the Video Generation webhook.

    const res = await fetch(API_CONFIG.GENERATE_VIDEO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`Video Generation Failed: ${res.statusText}`);

    const data: any = await res.json();
    const url = data.video_url || data.url || data.output; // Check payload return 

    if (!url) throw new Error("No video URL returned from Video Generator");
    return url;
}

// Re-export specific engine assets
export { generateMusic } from './engine/assets/music';
export { generateCaptions } from './engine/assets/captions';
export { generateUpscale } from './engine/assets/upscaler';
