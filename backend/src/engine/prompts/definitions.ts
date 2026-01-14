
// Extracted from 'n8n nodes/Express Keyframe.json'
export const VISUAL_STYLES: Record<string, string> = {
    "photorealistic": "Ultra-realistic 8k photograph, highly detailed textures, sharp focus",
    "cinematic": "Cinematic film still, anamorphic lens, high production value, shallow depth of field",
    "documentary": "Raw documentary photography, 35mm film grain, authentic look",
    "anime": "Anime art style, cel-shaded, vibrant colors",
    "pixar-style": "3D animation style, Pixar-inspired, smooth rendering",
    "watercolor": "Watercolor painting, soft edges, artistic brushstrokes",
    "comic-book": "Comic book art style, bold black outlines, halftone patterns",
    "noir": "Film noir style, high contrast black and white, dramatic shadows",
    "stop motion (claymation)": "Stop motion claymation, clay texture, handmade feel",

    // Legacy/Synonyms
    "default": "Cinematic lighting, photorealistic, highly detailed, 4k"
};

export const CAMERA_ANGLES: Record<string, string> = {
    "standard": "Eye-level shot",
    "heroic": "Low-angle shot from below, emphasizing stature",
    "vulnerable": "High-angle shot from above",
    "wide / establishing": "Wide-angle environmental shot, full body visibility",
    "wide": "Wide-angle environmental shot, full body visibility",
    "close & intimate": "Extreme close-up shot, shallow depth of field",
    "close up": "Extreme close-up shot, shallow depth of field",
    "chaos / action": "Dutch angle, dynamic tilted",
    "over-the-shoulder": "Over-the-shoulder shot",
    "side profile": "Side profile view",
    "top down": "Directly from above"
};

export const mapStyle = (key?: string) => VISUAL_STYLES[key?.toLowerCase() || "default"] || VISUAL_STYLES["default"];
export const mapCamera = (key?: string) => CAMERA_ANGLES[key?.toLowerCase() || "standard"] || key || "";
