
// Shared types for the video generation engine

// --- Script Generation Types ---

export interface ScriptInput {
    style: string;
    duration: number;
    topic: string; // or "referenceText"
    characterOrNarrator: string;
    characterName?: string; // e.g., "Baby Zuck" - used for dialogue self-reference
    setting: string;
    action: string;
    route: 'aroll' | 'broll' | 'combo';
}

export interface ScriptSegment {
    segId: string;
    dialogue?: string; // Spoken text
    visual?: string; // B-roll visual description or Scene description
    visuals?: string[]; // Multiple visuals for sub-segmentation
    character?: string; // Character name/desc for A-roll
    action?: string; // A-roll action or B-roll motion
    duration?: number;
    track?: 'aroll' | 'broll'; // Explicit track if known
}

export interface ScriptOutput {
    title: string;
    segments: ScriptSegment[];
    estimatedDuration: number;
}

// --- Orchestration & EDL Types ---

export interface RenderPlan {
    sessionId: string;
    script: ScriptOutput;
    settings: RenderSettings;
}

export interface RenderSettings {
    width: number;
    height: number;
    fps: number;
    aspectRatio: string;
    characterImage?: string;
    settingImage?: string;
    voiceId?: string;
    voiceUrl?: string;
    style?: string; // e.g. "Cinematic", "Anime"
    cameraAngle?: string; // e.g. "Close Up"
    route?: 'aroll' | 'broll' | 'combo' | string;
}

export interface Shot {
    id: string; // "S01"
    segId: string; // "SEG-01"
    beatId?: string;
    shotKey: string; // "SEG-01-B01-S01"
    prompt: string; // Visual prompt for Image Gen
    negative_prompt?: string;
    durationSec: number;
    type: 'aroll' | 'broll';

    // Derived from ScriptSegment
    dialogue?: string;
    voiceDurationSec?: number; // Actual audio length (may differ from shot duration)

    // Asset references
    voiceUrl?: string;
    imageUrl?: string;
    videoUrl?: string;
}

export interface EDL {
    tracks: {
        video: Track[];
        audio: Track[];
        images?: Track[];
    };
    durationSec: number;
    length_sec?: number;
    fps: number;
    resolution: { width: number, height: number };
    _meta?: any;
}

export interface Track {
    name: string; // "aroll", "broll", "music", "narration"
    clips: Clip[];
}

export interface Clip {
    id: string;
    src: string;
    in: number;
    out: number;
    timelineStart: number;
    timelineEnd: number;
    type: 'video' | 'audio' | 'image';
    segId?: string; // linkage back to segment
    volume?: number;
    meta?: any;
    _meta?: any;
}
