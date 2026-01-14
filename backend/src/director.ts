import { Job } from 'bullmq';
import { generateSceneImage, generateVoice, generateVideo, generateMusic, generateCaptions, generateUpscale } from './assets';
import path from 'path';
import { ProjectPayload, GenerationStatus } from './types'; // Types import
import { generateScript } from './engine/scripts/generator';
import { VideoOrchestrator } from './engine/orchestrator';
import { RenderPlan, ScriptInput } from './engine/common/types';
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from './config';

// Instantiate Supabase Client (Service Role needed for some ops, but Anon might suffice if RLS allows)
// Using Service Role if available, else Anon (from CONFIG)
const supabase = createClient(CONFIG.SUPABASE_URL!, CONFIG.SUPABASE_KEY!);

// Update Supabase with status and progress
async function updateStatus(job: Job<ProjectPayload>, status: GenerationStatus, onStatusUpdate?: (status: GenerationStatus) => Promise<void>) {
    // Audit Log for Debugging
    console.log(`[JobStatus] ${status.stage} (${status.progress}%): ${status.message}`);

    // 0. Use Mock Logger if provided (Test Mode)
    if (onStatusUpdate) {
        await onStatusUpdate(status);
        return; // Skip Supabase in test mode
    }

    const vodId = job.data.vodId;
    // Update Supabase if vodId is present
    if (vodId && supabase) {
        try {
            // 1. Fetch current settings to preserve existing data
            const { data: currentData, error: fetchError } = await supabase
                .from('express_vods')
                .select('settings')
                .eq('id', vodId)
                .single();

            if (fetchError) {
                console.warn(`Supabase fetch failed for ${vodId}:`, fetchError.message);
                return;
            }

            const currentSettings = currentData?.settings || {};
            // Handle if settings is stringified JSON
            const parsedSettings = typeof currentSettings === 'string'
                ? JSON.parse(currentSettings)
                : currentSettings;

            // 2. Merge new status info
            const newSettings = {
                ...parsedSettings,
                stage: status.stage,
                progress: status.progress,
                last_message: status.message
            };

            const updatePayload: any = {
                status: status.stage === 'completed' ? 'completed' : status.stage === 'failed' ? 'failed' : 'processing',
                settings: newSettings
            };

            if (status.stage === 'completed' && status.output?.videoUrl) {
                updatePayload.video_url = status.output.videoUrl;
            }

            // Capture actual duration if available
            if (status.stage === 'completed' && status.output?.edl?.durationSec) {
                newSettings.actualDuration = status.output.edl.durationSec;
            }

            // Persist EDL for export
            if (status.stage === 'completed' && status.output?.edl) {
                newSettings.edl = status.output.edl;
            }

            const { error } = await supabase
                .from('express_vods')
                .update(updatePayload)
                .eq('id', vodId);

            if (error) console.warn(`Supabase update failed for ${vodId}:`, error.message);
        } catch (err) {
            console.error("Error updating Supabase:", err);
        }
    }
}

export async function processVideoJob(job: Job<ProjectPayload>, onStatusUpdate?: (status: GenerationStatus) => Promise<void>) {
    const payload = job.data;
    const jobId = job.id || 'unknown';
    const vodId = payload.vodId; // UUID from Frontend

    try {
        await updateStatus(job, { stage: 'scripting', progress: 10, message: 'Starting AI Director...' }, onStatusUpdate);

        // 1. Research Step (Optional)
        let researchTopic = payload.sceneDescription || payload.title || "Viral video";

        if (payload.research) {
            await updateStatus(job, { stage: 'researching', progress: 5, message: `Researching: ${researchTopic}...` }, onStatusUpdate);
            try {
                const { runAgenticResearch } = await import('./engine/researcher');
                const researchResult = await runAgenticResearch(researchTopic);
                researchTopic = researchResult; // Overwrite topic with synthesized research
            } catch (e) {
                console.error("Research failed, falling back to original topic", e);
            }
        }

        // 2. Map Payload to Engine Input
        // Route logic: Use explicit route if provided, otherwise infer from driver
        let route: 'aroll' | 'broll' | 'combo' = payload.route || (payload.driver === 'character' ? 'aroll' : 'broll');

        const scriptInput: ScriptInput = {
            topic: researchTopic, // Use researched or original topic
            duration: payload.durationSec || 30,
            style: "Cinematic, viral, high retention", // Default style
            characterOrNarrator: payload.characterDescription || "Narrator",
            characterName: payload.characterName || payload.title || "Narrator", // For dialogue self-reference
            setting: payload.settingDescription || "Studio",
            action: payload.actionDescription || "Talking head",
            route: route
        };

        // 2. Generate Script
        const scriptOutput = await generateScript(scriptInput);

        await updateStatus(job, {
            stage: 'visuals',
            progress: 30,
            message: 'Script generated. Visualizing scenes...',
            artifacts: { script: scriptOutput }
        }, onStatusUpdate);

        // 3. Orchestrate Assets & EDL
        const plan: RenderPlan = {
            sessionId: jobId,
            script: scriptOutput,
            settings: {
                width: 1024, // Standard 16:9 SDXL (Divisible by 64)
                height: 576,
                fps: 30,
                aspectRatio: payload.aspectRatio || "16:9",
                characterImage: payload.characterImage,
                settingImage: payload.settingImage,
                voiceId: payload.voiceId,
                voiceUrl: payload.voiceUrl,
                style: payload.stylePreset, // Pass style to Orchestrator
                cameraAngle: payload.cameraAngle, // Pass camera angle (A-Roll only)
                route: route // Explicitly pass route
            }
        };

        if (plan.settings.aspectRatio === "9:16") {
            plan.settings.width = 576;
            plan.settings.height = 1024;
        }

        const orchestrator = new VideoOrchestrator(plan, async (prog, msg) => {
            await updateStatus(job, {
                stage: prog < 50 ? 'visuals' : 'animation',
                progress: prog,
                message: msg
            }, onStatusUpdate);
        });
        const edl = await orchestrator.execute();

        // 3.5 Music Generation (NEW)
        if (payload.doMusic || payload.wantsMusic) {
            await updateStatus(job, { stage: 'assembling', progress: 85, message: 'Generating Music...' }, onStatusUpdate);
            try {
                const musicOut = await generateMusic({
                    prompt: mapMusicStyle(payload.musicCategoryLabel) || payload.musicPrompt || "Cinematic background music",
                    duration: edl.durationSec || payload.durationSec || 30, // Use actual EDL total duration
                    tags: payload.musicTags
                });

                // Add to EDL
                if (!edl.tracks.audio) edl.tracks.audio = [];
                edl.tracks.audio.push({
                    name: "Music",
                    clips: [{
                        id: "music-1",
                        src: musicOut.audio_url,
                        in: 0,
                        out: musicOut.duration_sec,
                        timelineStart: 0,
                        timelineEnd: musicOut.duration_sec,
                        // Adjust volume
                        volume: 0.05, // Lowered from 0.08 to 0.05 per user request
                        type: 'audio'
                    }]
                });
                console.log("Music added to EDL:", musicOut.audio_url);
            } catch (e) {
                console.error("Music generation failed, proceeding without music", e);
            }
        }

        await updateStatus(job, { stage: 'assembling', progress: 90, message: 'Rendering video (Local)...' }, onStatusUpdate);

        // 4. Composition (Local)
        const { CompositionEngine } = await import('./engine/renderer/composition');
        const renderer = new CompositionEngine({
            jobId: jobId,
            outputDir: path.resolve(__dirname, `../temp/renders/${jobId}`),
            title: payload.title // For title-based output filename
        });

        // Pass payload settings into EDL meta for the renderer to use if needed
        if (!edl._meta) edl._meta = {};
        edl._meta.settings = {
            ...edl._meta.settings,
            doHD: payload.doUpscale, // Hint to renderer if needed
            music: { enabled: payload.doMusic }
        };

        let currentVideoUrl = await renderer.render(edl);
        console.log("Remote Render URL:", currentVideoUrl);

        // 5. Captions
        if (payload.doCaptions || payload.wantsCaptions) {
            await updateStatus(job, { stage: 'assembling', progress: 95, message: 'Generating Captions...' }, onStatusUpdate);
            try {
                const capOut = await generateCaptions({
                    video_url: currentVideoUrl,
                    requestId: jobId,
                    style: payload.captionStyle,
                    doUpscale: payload.doUpscale // Pass to n8n
                });
                currentVideoUrl = capOut.captioned_video_url;
                console.log("Captioned URL:", currentVideoUrl);
            } catch (e) {
                console.error("Captions failed", e);
            }
        }

        // 6. Upscale
        if (payload.doUpscale) {
            await updateStatus(job, { stage: 'assembling', progress: 98, message: 'Upscaling video...' }, onStatusUpdate);
            try {
                const upOut = await generateUpscale({
                    video_url: currentVideoUrl,
                    doHD: true,
                    title: payload.title
                });
                currentVideoUrl = upOut.upscaled_video_url;
                console.log("Upscaled URL:", currentVideoUrl);
            } catch (e) {
                console.error("Upscale failed", e);
            }
        }

        await updateStatus(job, {
            stage: 'completed',
            progress: 100,
            message: 'Video Ready!',
            output: { edl, videoUrl: currentVideoUrl },
            artifacts: { videoUrl: currentVideoUrl }
        }, onStatusUpdate);

        return { success: true, edl, videoUrl: currentVideoUrl };

    } catch (err: any) {
        console.error("Job Failed", err);
        await updateStatus(job, { stage: 'failed', progress: 0, message: err.message, error: err.toString() }, onStatusUpdate);
        throw err;
    }
}

// Helper to map UI music styles to rich prompts
function mapMusicStyle(style: string | undefined): string | null {
    if (!style) return null;
    const map: Record<string, string> = {
        'Cinematic': 'Epic cinematic orchestral score, hans zimmer style, deep and emotional',
        'Upbeat': 'Energetic upbeat pop corporate background music, happy and positive',
        'Lo-Fi': 'Chill lo-fi hip hop beats to relax/study to, smooth jazz vibes',
        'Rock': 'High energy rock background track, electric guitars and drums',
        'Ambient': 'Deep ambient soundscape, Eno-style drone, atmospheric, meditative, no drums'
    };
    return map[style] || style;
}
