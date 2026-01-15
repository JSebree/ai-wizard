// Helper: Rewrite URL to use local proxy if it's from digitaloceanspaces
export const getProxiedUrl = (url) => {
    if (!url || typeof url !== 'string') return url;

    // [v74] Standardizing on non-cdn proxies for reliability on localhost
    if (url.includes('digitaloceanspaces.com')) {
        // Match any [bucket].nyc3.[optional cdn.]digitaloceanspaces.com
        if (url.includes('media-catalog.nyc3')) {
            return url.replace(/https:\/\/media-catalog\.nyc3\.(cdn\.)?digitaloceanspaces\.com\/?/, '/media-proxy/');
        }
        if (url.includes('video-generations.nyc3')) {
            return url.replace(/https:\/\/video-generations\.nyc3\.(cdn\.)?digitaloceanspaces\.com\/?/, '/generations-proxy/');
        }
        if (url.includes('a-roll-output.nyc3')) {
            return url.replace(/https:\/\/a-roll-output\.nyc3\.(cdn\.)?digitaloceanspaces\.com\/?/, '/last-frames-proxy/');
        }
        if (url.includes('voice-generations.nyc3')) {
            return url.replace(/https:\/\/voice-generations\.nyc3\.(cdn\.)?digitaloceanspaces\.com\/?/, '/voice-proxy/');
        }

        // Fallback to general video-proxy
        return url.replace(/https:\/\/([a-zA-Z0-9-]+\.)?nyc3\.(cdn\.)?digitaloceanspaces\.com\/?/, '/video-proxy/');
    }

    return url;
};

export const API_CONFIG = {
    // Shared Asset Generation (Characters & Settings)
    // Maps to "Visual Architect" Agent in n8n
    GENERATE_ASSET_PREVIEW: "https://n8n.simplifies.click/webhook/generate-character-preview",

    // Registration & Expansion
    REGISTER_CHARACTER: "https://n8n.simplifies.click/webhook/webhook/register-character",
    GENERATE_CHARACTER_EXPANSION: "https://n8n.simplifies.click/webhook/generate-character-expansion",

    REGISTER_SETTING: "https://n8n.simplifies.click/webhook/webhook/register-setting",
    GENERATE_SETTING_EXPANSION: "https://n8n.simplifies.click/webhook/generate-setting-expansion",

    UPLOAD_REFERENCE_IMAGE: "https://n8n.simplifies.click/webhook/upload-reference-image",

    // Scene Studio
    GENERATE_SCENE_PREVIEW: "/api/generate-keyframe",

    // Clip Studio
    GENERATE_VOICE_PREVIEW: "/api/generate-voice",
    GENERATE_VIDEO_PREVIEW: "/api/generate-video",
    // LipSync goes directly to n8n (long-running, needs async/callback handling)
    GENERATE_LIPSYNC_PREVIEW: "https://n8n.simplifies.click/webhook/generate-lipsync-preview",

    // Production (Render)
    GENERATE_RENDER_SCENE: "https://n8n.simplifies.click/webhook/render-scene",

    // Voice Conversion
    SEED_VC_ENDPOINT: "/seed-vc-proxy/run",

    // Video-to-Video (InfCam)
    INFCAM_ENDPOINT: "/infcam-proxy",

    // Music Generation
    GENERATE_MUSIC: "https://n8n.simplifies.click/webhook/generate-music",

    // Foley SFX
    FOLEY_ENDPOINT: "/foley-proxy/run",
};
