import { RenderPlan, EDL, Shot, Clip, ScriptSegment } from './common/types';
import { generateKeyframe } from './assets/images';
import { generateVoice } from './assets/voice';
import { generateARollVideo, generateBRollVideo } from './assets/video';
import { mapStyle, mapCamera } from './prompts/definitions';

export class VideoOrchestrator {
    private plan: RenderPlan;
    private onProgress?: (progress: number, message: string) => void;

    constructor(plan: RenderPlan, onProgress?: (progress: number, message: string) => void) {
        this.plan = plan;
        this.onProgress = onProgress;
    }

    private shouldEnforceSolo(seg: ScriptSegment): boolean {
        const combinedText = `${seg.character} ${seg.action} ${seg.visual} ${(seg as any).notes || ''}`.toLowerCase();
        const multiSubjectKeywords = [
            'group', 'crowd', 'people', 'team', 'friends', 'couple', 'twins',
            'interview', 'audience', 'class', 'students', 'family',
            'two', 'three', 'multiple', 'several', 'together', 'beside', 'next to',
            'background character', 'background person', 'with a'
        ];

        return !multiSubjectKeywords.some(keyword => combinedText.includes(keyword));
    }

    public async execute(): Promise<EDL> {
        console.log(`[Orchestrator] Starting job for session: ${this.plan.sessionId}`);
        this.onProgress?.(35, "Analyzing script segments..."); // Start slightly above 30%

        // 1. Expand Segments into Shots
        const allShots: Shot[] = this.plan.script.segments.flatMap((seg, index) => {
            // DEBUG: Log segment dialogue values
            console.log(`[Orchestrator] Segment ${seg.segId || index}: track=${seg.track}, dialogue="${(seg.dialogue || '').slice(0, 50)}..." (${(seg.dialogue || '').length} chars)`);

            // Determine shot type logic
            let shotType: 'aroll' | 'broll' = 'broll'; // default
            const route = this.plan.settings.route || 'broll';

            if (route === 'aroll') shotType = 'aroll';
            else if (route === 'combo') shotType = (seg.track?.toLowerCase() || 'broll') as 'aroll' | 'broll';

            const isARoll = shotType === 'aroll';
            const segDuration = seg.duration || 4;

            // Check for Sub-Segmentation (Visual Fan-out)
            if (!isARoll && seg.visuals && seg.visuals.length > 1) {
                // B-Roll Fan-out (LLM provided multiple visuals)
                const subCount = seg.visuals.length;
                const subDur = segDuration / subCount;

                return seg.visuals.map((visualPrompt, subIndex) => {
                    return {
                        id: `S${(index + 1).toString().padStart(2, '0')}-${subIndex + 1}`,
                        segId: seg.segId || `SEG-${(index + 1).toString().padStart(2, '0')}`,
                        shotKey: `${seg.segId}-S${index}-sub${subIndex}`,
                        prompt: `Style: ${mapStyle(this.plan.settings.style)}. ` + (visualPrompt || "Cinematic b-roll"),
                        dialogue: subIndex === 0 ? seg.dialogue : undefined, // Only first sub-shot owns audio
                        durationSec: subDur,
                        type: 'broll'
                    };
                });
            }

            // AUTO-SPLIT: Long B-Roll segments without visuals array
            // ONLY for pure 'broll' route - do NOT touch 'combo' route logic
            if (route === 'broll' && !isARoll && segDuration > 4 && (!seg.visuals || seg.visuals.length <= 1)) {
                const targetShotDuration = 3; // Target ~3s per B-Roll shot
                const numShots = Math.max(2, Math.ceil(segDuration / targetShotDuration));
                const subDur = segDuration / numShots;
                const baseVisual = seg.visual || "Cinematic b-roll";

                console.log(`[Orchestrator] Auto-splitting ${segDuration}s B-Roll into ${numShots} shots (~${subDur.toFixed(1)}s each)`);

                // Generate varied prompts for each sub-shot
                const shotVariants = [
                    "establishing wide shot",
                    "medium shot, detailed view",
                    "close-up, intimate detail",
                    "dynamic angle, movement",
                    "atmospheric mood shot"
                ];

                return Array.from({ length: numShots }, (_, subIndex) => {
                    const variant = shotVariants[subIndex % shotVariants.length];
                    return {
                        id: `S${(index + 1).toString().padStart(2, '0')}-${subIndex + 1}`,
                        segId: seg.segId || `SEG-${(index + 1).toString().padStart(2, '0')}`,
                        shotKey: `${seg.segId || 'SEG01'}-S${index}-sub${subIndex}`,
                        prompt: `Style: ${mapStyle(this.plan.settings.style)}. ${variant} of ${baseVisual}`,
                        dialogue: subIndex === 0 ? seg.dialogue : undefined, // Only first sub-shot owns audio
                        durationSec: subDur,
                        type: 'broll'
                    };
                });
            }

            // Standard 1:1 Mapping
            const enforceSolo = this.shouldEnforceSolo(seg);
            const safetyRail = enforceSolo ? "Single solo subject, centered in frame." : "Primary subject in focus.";

            // Build A-Roll prompt: Camera first, then style, then action, end with identity cue
            const arollPrompt = [
                mapCamera(this.plan.settings.cameraAngle), // e.g. "Eye-level shot"
                mapStyle(this.plan.settings.style), // e.g. "Ultra-realistic 8k photograph..."
                `${safetyRail} Add ${seg.action || 'character in scene'}.`,
                "Neutral unobtrusive face" // Identity preservation cue for I2I
            ].filter(Boolean).join(' ');

            return [{
                id: `S${(index + 1).toString().padStart(2, '0')}`,
                segId: seg.segId || `SEG-${(index + 1).toString().padStart(2, '0')}`,
                shotKey: `${seg.segId || 'SEG01'}-S${(index + 1).toString().padStart(2, '0')}`,
                prompt: isARoll ? arollPrompt : (seg.visual || "Cinematic b-roll"),
                dialogue: seg.dialogue,
                durationSec: segDuration,
                type: isARoll ? 'aroll' : 'broll'
            }];
        });

        console.log(`[Orchestrator] Processing ${allShots.length} shots (from ${this.plan.script.segments.length} segments)...`);

        // 2. Parallel Phase 1: Voice + Images
        const voicePromises = allShots.map(async (shot) => {
            // Generate voice for ANY shot that has dialogue (A-Roll or B-Roll)
            if (shot.dialogue) {
                // Generate Voice
                const voiceOut = await generateVoice({
                    text: shot.dialogue,
                    // Use user override if present (settings), otherwise default
                    voiceId: this.plan.settings.voiceId || "fe3b2cea-969a-4b5d-bc90-fde8578f1dd5",
                    voice_ref_url: this.plan.settings.voiceUrl
                });
                shot.voiceUrl = voiceOut.audio_url;
                shot.voiceDurationSec = voiceOut.duration_sec;
                console.log(`[Orchestrator] Voice Gen Complete for ${shot.id}: voiceUrl=${shot.voiceUrl}, voiceDur=${shot.voiceDurationSec}`);

                // FIX: Distribute this new duration across all sub-shots (siblings) in this segment
                // Find all shots belonging to this same segment
                const siblings = allShots.filter(s => s.segId === shot.segId);
                const subCount = siblings.length;
                const newSubDur = voiceOut.duration_sec / subCount;

                // Update ALL siblings
                siblings.forEach(sibling => {
                    sibling.durationSec = newSubDur;
                });
            }
        });

        // --- Master A-Roll Keyframe Strategy ---
        // Goal: Use ONE consistent image for all A-roll talking head shots.
        // When both characterImage AND settingImage exist, combine them via I2I generation.
        let masterARollPromise: Promise<string | null>;

        const hasCharacter = !!this.plan.settings.characterImage;
        const hasSetting = !!this.plan.settings.settingImage;
        const firstARoll = allShots.find(s => s.type === 'aroll');

        // Determine if creative edit mode (non-photorealistic styles)
        const styleKey = (this.plan.settings.style || '').toLowerCase();
        const isPhotorealistic = styleKey.includes('photorealistic') || styleKey.includes('ultra-realistic') || styleKey === '' || styleKey === 'default';
        const isCreativeEdit = !isPhotorealistic;

        console.log(`[Orchestrator] Style: "${this.plan.settings.style}" -> isCreativeEdit: ${isCreativeEdit}`);

        if (hasCharacter || hasSetting) {
            // Combine both images for I2I generation (setting first, then character)
            const referenceImages = [
                this.plan.settings.settingImage,
                this.plan.settings.characterImage
            ].filter((url): url is string => !!url);

            console.log(`[Orchestrator] Generating Master A-Roll with I2I. References: ${referenceImages.length} image(s)`);

            // Use first A-Roll prompt if available, else build minimal prompt
            const prompt = firstARoll?.prompt ||
                `Style: ${mapStyle(this.plan.settings.style)}. Camera: ${mapCamera(this.plan.settings.cameraAngle)}. Character in setting.`;

            masterARollPromise = generateKeyframe({
                prompt,
                width: this.plan.settings.width,
                height: this.plan.settings.height,
                image_urls: referenceImages,
                strength: 0.7, // Balance between reference fidelity and prompt adherence
                isCreativeEdit // Pass to control creative_edit, identity_emphasis, true_guidance_scale
            }).then(res => {
                console.log(`[Orchestrator] Master A-Roll Generated (I2I): ${res.image_url}`);
                return res.image_url;
            }).catch(e => {
                console.error("Master A-Roll Gen Failed", e);
                // Fallback to characterImage if generation fails
                return this.plan.settings.characterImage || null;
            });
        } else if (firstARoll) {
            // No reference images - generate purely from prompt (T2I)
            console.log(`[Orchestrator] Generating Master A-Roll image from Shot ${firstARoll.id} (T2I)...`);
            masterARollPromise = generateKeyframe({
                prompt: firstARoll.prompt,
                width: this.plan.settings.width,
                height: this.plan.settings.height
            }).then(res => {
                console.log(`[Orchestrator] Master A-Roll Generated (T2I): ${res.image_url}`);
                return res.image_url;
            }).catch(e => {
                console.error("Master A-Roll Gen Failed", e);
                return null;
            });
        } else {
            masterARollPromise = Promise.resolve(null); // No A-Roll in this video
        }


        // Throttle Image Generation (Concurrency: 2)
        const imageResults: any[] = [];
        const batchSize = 1; // Reduced to 1 (Serial) to prevent CUDA OOM
        for (let i = 0; i < allShots.length; i += batchSize) {
            const batch = allShots.slice(i, i + batchSize);
            await Promise.all(batch.map(async (shot) => {
                if (shot.type === 'aroll') {
                    // A-Roll: Wait for Master
                    const masterUrl = await masterARollPromise;
                    if (masterUrl) {
                        shot.imageUrl = masterUrl;
                    } else {
                        // Fallback (should rarely happen): Generate unique
                        const out = await generateKeyframe({ prompt: shot.prompt, width: this.plan.settings.width, height: this.plan.settings.height });
                        shot.imageUrl = out.image_url;
                    }
                } else {
                    // B-Roll: Generate Unique
                    // Only apply setting image if route is 'broll' (User Rule)
                    const route = this.plan.settings.route;
                    const useSetting = route === 'broll';
                    const referenceImages = useSetting ? [this.plan.settings.settingImage].filter((url): url is string => !!url) : [];
                    const imgOut = await generateKeyframe({
                        prompt: shot.prompt,
                        width: this.plan.settings.width,
                        height: this.plan.settings.height,
                        image_urls: referenceImages.length > 0 ? referenceImages : undefined,
                        strength: referenceImages.length > 0 ? 0.75 : undefined
                    });
                    shot.imageUrl = imgOut.image_url;
                }
                imageResults.push(shot);
            }));
        }

        // Music Generation moved to Director level
        const musicPromise = Promise.resolve(null);

        const [_, musicResult] = await Promise.all([
            Promise.all(voicePromises),
            musicPromise
        ]);
        console.log(`[Orchestrator] Phase 1 complete.`);

        // 3. Phase 2: Video Generation (Parallel)
        // Optimization: Lip Sync and I2V run on separate queues, so we can run them concurrently.
        console.log(`[Orchestrator] Phases 1 complete. Starting Phase 2 (Video Generation)...`);

        const videoPromises = allShots.map(async (shot) => {
            // A-Roll LipSync
            if (shot.type === 'aroll' && shot.imageUrl && shot.voiceUrl) {
                console.log(`[Orchestrator] Generating A-Roll LipSync for ${shot.id}...`);
                const vidOut = await generateARollVideo({
                    image_url: shot.imageUrl,
                    audio_url: shot.voiceUrl,
                    duration_sec: shot.durationSec
                });
                shot.videoUrl = vidOut.video_url;
            } else if (shot.type === 'broll' && shot.imageUrl) {
                // B-Roll I2V (LTX/Hunyuan)
                console.log(`[Orchestrator] Generating B-Roll Video for ${shot.id}...`);
                const vidOut = await generateBRollVideo({
                    image_url: shot.imageUrl,
                    prompt: shot.prompt, // Prompt describes the visual action
                    duration_sec: shot.durationSec
                });
                shot.videoUrl = vidOut.video_url;
            } else {
                console.log(`[Orchestrator] Skipping Video Gen for ${shot.id} (Fallback to Static). Reason: Type=${shot.type}, HasImage=${!!shot.imageUrl}, HasVoice=${!!shot.voiceUrl}`);
                shot.videoUrl = shot.imageUrl; // Fallback to static
            }
        });

        await Promise.all(videoPromises);
        console.log(`[Orchestrator] Phase 2 complete.`);

        // 4. Build EDL
        const edl = this.buildEDL(allShots);

        // Add Music Track if generated
        // Music is now added by Director
        // if (musicResult) { ... }

        return edl;
    }

    private buildEDL(shots: Shot[]): EDL {
        const videoClips: Clip[] = [];
        const audioClips: Clip[] = [];

        let timelineCursor = 0;

        shots.forEach(shot => {
            const dur = shot.durationSec;

            // Video Track
            videoClips.push({
                id: shot.id,
                src: shot.videoUrl || shot.imageUrl || "",
                in: 0,
                out: dur,
                timelineStart: timelineCursor,
                timelineEnd: timelineCursor + dur,
                type: shot.videoUrl ? 'video' : 'image',
                segId: shot.segId // Track which segment this belongs to
            });

            // Audio Track
            // Only add audio clip if this shot actually OWNS the voice file (Shot 1 of N)
            // AND (It's B-Roll OR It's A-Roll Fallback/Image-Only)
            const isARollFallback = shot.type === 'aroll' && !shot.videoUrl;
            if ((shot.type === 'broll' || isARollFallback) && shot.voiceUrl && shot.voiceDurationSec) {
                console.log(`[Orchestrator] buildEDL: Adding Audio Clip for ${shot.id} (Type=${shot.type}, Voice=${shot.voiceUrl}, Dur=${shot.voiceDurationSec})`);
                audioClips.push({
                    id: `${shot.id}_audio`,
                    src: shot.voiceUrl,
                    in: 0,
                    out: shot.voiceDurationSec, // Play full audio
                    timelineStart: timelineCursor, // Start aligned with this video clip
                    timelineEnd: timelineCursor + shot.voiceDurationSec,
                    type: 'audio',
                    segId: shot.segId
                });
            } else if (shot.type === 'aroll') {
                // A-Roll audio is embedded; usually don't need separate audio track
                // unless we want to normalize volume etc.
            } else if (shot.type === 'broll') {
                // Debug: Why was B-Roll audio not added?
                console.log(`[Orchestrator] buildEDL: Skipping Audio for B-Roll ${shot.id}: voiceUrl=${shot.voiceUrl}, voiceDur=${shot.voiceDurationSec}`);
            }

            timelineCursor += dur;
        });

        console.log(`[Orchestrator] EDL Built. Video Clips: ${videoClips.length}, Audio Clips: ${audioClips.length}`);

        return {
            tracks: {
                video: [{ name: "main", clips: videoClips }],
                audio: [{ name: "narration", clips: audioClips }]
            },
            durationSec: timelineCursor,
            fps: this.plan.settings.fps,
            resolution: { width: this.plan.settings.width, height: this.plan.settings.height }
        };
    }
}
