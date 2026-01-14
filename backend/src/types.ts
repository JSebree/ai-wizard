/**
 * Core Types for AI Wizard
 */
export interface ProjectPayload {
    // Core Metadata
    title?: string;
    userId: string;
    vodId?: string;

    // "The Talent" (Driver)
    driver: 'character' | 'narrator';
    characterName?: string;
    characterDescription?: string; // from 'character' input
    voiceId?: string;
    voiceUrl?: string; // For cloned voices
    characterImage?: string; // For img2img keyframe generation

    // "The Set"
    settingDescription?: string; // from 'setting' input
    settingImage?: string; // URL if they picked a preset

    // "Content"
    sceneDescription?: string; // 'scene'
    actionDescription?: string; // 'action'
    script?: string; // 'referenceText'

    // Config
    durationSec?: number;
    aspectRatio?: string; // e.g. "9:16"
    route?: 'aroll' | 'broll' | 'combo'; // Generation pipeline selection

    // Options
    wantsMusic?: boolean;
    doMusic?: boolean;
    musicPrompt?: string;
    musicTags?: string;
    musicCategory?: string;
    musicCategoryLabel?: string; // UI label like "Cinematic", "Upbeat"

    wantsCaptions?: boolean;
    doCaptions?: boolean;
    captionStyle?: any;

    doUpscale?: boolean;
    webhookUrl?: string;

    research?: boolean; // Enable Agentic Research
    stylePreset?: string; // Visual style guidelines (e.g. 'Cinematic', 'Anime')
    cameraAngle?: string; // Camera angle for A-Roll (e.g. 'Medium Shot', 'Close Up')

    // Internal State (Persisted in BullMQ)
    status?: GenerationStatus;
}

export interface GenerationStatus {
    stage: 'queued' | 'researching' | 'scripting' | 'visuals' | 'audio' | 'animation' | 'assembling' | 'completed' | 'failed';
    progress: number; // 0-100
    message: string;
    error?: string;
    output?: any;
    artifacts?: {
        script?: any;
        images?: string[];
        videoUrl?: string;
    };
}
