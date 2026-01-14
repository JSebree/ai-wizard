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

            // Ensure job_id is linked (idempotent update)
            updatePayload.job_id = job.id;

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
                // Debug: Log what music style was received
                const mappedStyle = mapMusicStyle(payload.musicCategoryLabel);
                console.log(`[Music] Category received: "${payload.musicCategoryLabel}" -> Mapped prompt: "${mappedStyle?.substring(0, 60)}..."`);

                const musicOut = await generateMusic({
                    prompt: mappedStyle || payload.musicPrompt || "Cinematic background music",
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
                        volume: 0.07, // Set to 7% (subtle but audible background)
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
        "Rock Instrumental": "rock instrumental, electric guitar riffs, distorted guitar, bass guitar, drums, energetic, 140 bpm, live concert feel",
        "Jazz Instrumental": "jazz instrumental, acoustic piano, upright bass, saxophone, brush drums, swing rhythm, smooth, 90 bpm, lounge vibe",
        "Hip-Hop / Trap Beat": "hip hop instrumental, trap beat, 808 bass, hi hats, snare, kick drum, synth pads, 140 bpm, dark, atmospheric, street vibe",
        "Orchestral / Cinematic": "orchestral instrumental, strings, violins, cellos, brass, woodwinds, timpani, cinematic, majestic, 70 bpm, dramatic",
        "Lo-Fi / Chillhop": "lofi instrumental, chillhop, jazzy chords, dusty vinyl crackle, mellow piano, soft synths, laid-back drums, 80 bpm, relaxing, study vibe",
        "EDM / House": "edm instrumental, deep house, synth bass, kick drum four on the floor, hi hats, synth plucks, 128 bpm, dance club, hypnotic",
        "Ambient / Soundscape": "ambient instrumental, drones, evolving textures, synth pads, slow tempo, atmospheric, meditative, 60 bpm, ethereal",
        "Reggae / Dub": "reggae instrumental, dub groove, offbeat guitar skank, bass groove, drums, echo effects, relaxed, 85 bpm, island vibe",
        "Funk / Groove": "funk instrumental, slap bass, electric guitar, clavinet, brass stabs, groovy drums, upbeat, 110 bpm, danceable",
        "Country / Folk": "country instrumental, acoustic guitar, banjo, fiddle, upright bass, light percussion, warm, 95 bpm, rustic, storytelling vibe",
        "Blues": "blues instrumental, electric guitar, walking bass, harmonica, shuffle drums, soulful, 85 bpm, smoky bar vibe",
        "Metal": "metal instrumental, distorted guitars, double kick drums, bass, aggressive riffs, fast tempo, 180 bpm, heavy and dark",
        "Techno": "techno instrumental, pounding kick, arpeggiated synths, dark bassline, industrial, 125 bpm, underground rave vibe",
        "Latin / Salsa": "latin instrumental, salsa rhythm, congas, bongos, brass, piano montuno, bass, upbeat, 95 bpm, lively",
        "R&B / Soul": "r&b instrumental, electric piano, smooth bass, soulful guitar, mellow drums, romantic, 85 bpm, groovy",
        "Gospel": "gospel instrumental, organ, piano, choir pads, clapping rhythm, uplifting, 80 bpm, soulful, church vibe",
        "Indian Classical / Sitar": "indian instrumental, sitar, tabla, tanpura drone, meditative, 70 bpm, spiritual, raga inspired",
        "African Percussion": "african instrumental, djembe, talking drum, congas, rhythmic ensemble, tribal, 100 bpm, primal, energetic",
        "Celtic / Folk": "celtic instrumental, flute, bagpipes, fiddle, harp, bodhran, traditional, 95 bpm, mystical",
        "Synthwave / Retro": "synthwave instrumental, retro synths, arpeggios, electronic drums, nostalgic, 100 bpm, 1980s vibe"
    };
    return map[style] || style;
}
