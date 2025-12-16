import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from "../libs/supabaseClient";
import { API_CONFIG } from "../config/api";
import { v4 as uuidv4 } from 'uuid';
import ClipCard from "./components/ClipCard";

// n8n Webhooks
const TTS_WEBHOOK = API_CONFIG.GENERATE_VOICE_PREVIEW;
const I2V_WEBHOOK = API_CONFIG.GENERATE_VIDEO_PREVIEW;
const LIPSYNC_WEBHOOK = API_CONFIG.GENERATE_LIPSYNC_PREVIEW;

// Helper to prefix IDs for local vs saved items
const prefixId = (id) => (typeof id === 'string' && id.startsWith('saved_')) ? id : `local_${id}`;

// Helper: Blob to Base64
const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result.split(',')[1]; // Remove data:audio/wav;base64,...
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export default function ClipStudioDemo() {
    const [keyframes, setKeyframes] = useState([]);
    const [characters, setCharacters] = useState([]);
    const [registryVoices, setRegistryVoices] = useState([]);
    const [selectedKeyframe, setSelectedKeyframe] = useState(null);
    const [shotList, setShotList] = useState(() => {
        try {
            const saved = localStorage.getItem("sceneme.shotList");
            if (!saved) return [];

            const parsed = JSON.parse(saved);
            // "Heal" stuck states on reload. If it was rendering, we lost the socket/callback.
            // So default it back to idle or error so the user can retry.
            return parsed.map(shot => {
                if (shot.status === 'rendering' || shot.status === 'generating') {
                    // Check if we arguably have a videoUrl from a previous run
                    if (shot.videoUrl) return { ...shot, status: 'preview_ready' };
                    // Otherwise reset to allowable retry state
                    return { ...shot, status: 'idle' };
                }
                return shot;
            });
        } catch (e) {
            console.error("Failed to load shotList draft:", e);
            return [];
        }
    }); // Array of shots being drafted
    const [savedClips, setSavedClips] = useState([]); // Array of saved clips
    const [previewShot, setPreviewShot] = useState(null); // For modal preview
    const [clipToDelete, setClipToDelete] = useState(null); // Custom delete workflow
    const [isDeleting, setIsDeleting] = useState(false);

    // --- Data Fetching ---
    useEffect(() => {
        const fetchData = async () => {
            // Load LocalStorage Mock Data first (for demo robustness)
            try {
                const localScenes = JSON.parse(localStorage.getItem("sceneme.keyframes") || "[]");
                if (localScenes.length > 0) setKeyframes(localScenes);
                const localChars = JSON.parse(localStorage.getItem("sceneme.characters") || "[]");
                if (localChars.length > 0) setCharacters(localChars);
                // [Persistence] Restore Clips
                const localClips = JSON.parse(localStorage.getItem("sceneme.clips") || "[]");
                if (localClips.length > 0) setSavedClips(localClips);
            } catch (e) { }

            // Load Voice Registry
            fetch('/voices.json')
                .then(res => res.json())
                .then(data => {
                    const list = Array.isArray(data) ? data : data.voices || [];
                    setRegistryVoices(list.map(v => ({
                        id: v.id || v.voice_id,
                        name: v.name,
                        previewUrl: v.preview_url || v.audio_url || v.url
                    })).filter(v => v.id));
                })
                .catch(console.error);

            if (!supabase) return;

            // Fetch keyframes from DB
            const { data: scenesData, error: scenesError } = await supabase.from('keyframes').select('*').order('created_at', { ascending: false });
            if (scenesError) {
                console.error("Error fetching keyframes:", scenesError);
            }
            if (scenesData) {
                setKeyframes(scenesData
                    .filter(s => {
                        // Filter out pending or error states
                        const isPending = s.status === 'pending' || s.image_url === "https://r2.sceneme.ai/assets/pending_placeholder.png" || s.image_url === "PENDING";
                        return !isPending && s.image_url;
                    })
                    .map(s => ({
                        id: s.id,
                        name: s.name,
                        image_url: s.image_url,
                        characterId: s.character_id,
                        setting_id: s.setting_id, // Explicitly map setting_id
                        description: s.prompt,
                        cameraLabel: s.camera_angle // Captured for validation
                    })));
            }

            // Fetch characters
            const { data: charactersData } = await supabase.from('characters').select('*');
            if (charactersData) {
                // SANITIZATION: Fix corrupted voice IDs that look like query strings
                // e.g. "/speakers?id=eq.en_us_001&select=*" -> "en_us_001"
                const cleanChars = charactersData.map(c => {
                    const cleanId = (val) => {
                        if (typeof val !== 'string') return val;
                        if (val.includes('?id=eq.')) {
                            const match = val.match(/id=eq\.([^&]+)/);
                            return match ? match[1] : val;
                        }
                        return val;
                    };

                    return {
                        ...c,
                        voice_id: cleanId(c.voice_id),
                        voiceId: cleanId(c.voiceId) // Handle both casing conventions
                    };
                });
                setCharacters(cleanChars);

                // Update local cache with clean data
                localStorage.setItem("sceneme.characters", JSON.stringify(cleanChars));
            }

            // Fetch saved clips from new table
            const { data: clipsData, error: clipsError } = await supabase.from('clips').select('*').order('created_at', { ascending: false });
            if (clipsError) console.error("Error loading clips:", clipsError);
            if (clipsData) {
                console.log("Loaded clips:", clipsData);
                // Parse JSON fields (dialogue_blocks is stored as string)
                const parsedClips = clipsData.map(c => {
                    try {
                        let parsedBlocks = c.dialogue_blocks;
                        if (typeof parsedBlocks === 'string') {
                            parsedBlocks = JSON.parse(parsedBlocks);
                        }
                        // Ensure it's always an array
                        if (!Array.isArray(parsedBlocks)) {
                            parsedBlocks = [];
                        }

                        // SANITIZATION: Fix blocks
                        const cleanBlocks = parsedBlocks.map(b => ({
                            ...b,
                            voice_id: (b.voice_id && b.voice_id.includes('?id=eq')) ? "en_us_001" : b.voice_id,
                            characterId: (b.characterId && b.characterId.includes('?id=eq')) ? "" : b.characterId // Clear corrupted char IDs
                        }));

                        return {
                            ...c,
                            dialogue_blocks: cleanBlocks
                        };
                    } catch (e) {
                        console.error("Failed to parse clip JSON:", c.id, e);
                        return { ...c, dialogue_blocks: [] }; // Fallback to empty array
                    }
                });

                // [Persistence] Safe Merge Strategy
                setSavedClips(prevClips => {
                    const dbMap = new Map(parsedClips.map(c => [c.id, c]));

                    // Rescue recent local pending/rendering items (buffer 5 mins for rendering)
                    const localPending = prevClips.filter(c =>
                        (c.status === 'pending' || c.status === 'rendering') &&
                        !dbMap.has(c.id) &&
                        (Date.now() - new Date(c.created_at || Date.now()).getTime() < 300000) // 5 mins
                    );

                    return [...localPending, ...parsedClips];
                });
            }
        };
        fetchData();
    }, []);

    // PERSIST SHOTLIST
    useEffect(() => {
        try {
            localStorage.setItem("sceneme.shotList", JSON.stringify(shotList));
        } catch (e) {
            console.error("Failed to save shotList draft:", e);
        }
    }, [shotList]);

    // [Persistence] Save Clips to Local (for refresh safety)
    useEffect(() => {
        try {
            localStorage.setItem("sceneme.clips", JSON.stringify(savedClips));
        } catch (e) { console.error("Failed to save clips locally:", e); }
    }, [savedClips]);

    // --- Shot Management ---
    const addShot = useCallback((explicitKeyframe = null) => {
        // Safe check: If invoked via onClick, explicitKeyframe is an Event object, not a Scene.
        const isScene = explicitKeyframe && explicitKeyframe.id;
        const targetScene = isScene ? explicitKeyframe : selectedKeyframe;

        console.log("addShot called. Explicit:", isScene ? "Scene Object" : "Event/Null", "Target:", targetScene);

        if (!targetScene) {
            alert("Please select a keyframe first.");
            return;
        }
        const newShot = {
            tempId: Date.now(), // Unique ID for local management
            name: "", // Individual Clip Name
            sceneId: targetScene.id,
            sceneImageUrl: targetScene.image_url || targetScene.imageUrl,

            // Validation Props (Persisted from Scene)
            cameraLabel: targetScene.cameraLabel,
            characterId: targetScene.characterId,

            prompt: "",
            motion: "static",
            manualDuration: 3, // Default duration
            dialogueBlocks: [{ id: uuidv4(), characterId: targetScene.characterId || "", text: "", audioUrl: "", duration: 0, pauseDuration: 0.5, isGenerating: false }],
            speakerType: "on_screen", // Default speaker type
            status: "draft", // draft, generating, preview_ready, completed
            videoUrl: "",
            error: "",
            useSeedVC: false,
            isRecording: false, // UI State
            inputMode: "text", // "text" | "mic"
        };
        setShotList(prev => {
            console.log("Updating Shot List. Previous Length:", prev.length);
            return [newShot, ...prev]; // Prepend to top
        });
    }, [selectedKeyframe]);

    const updateShot = useCallback((tempId, updates) => {
        setShotList(prev => prev.map(shot =>
            shot.tempId === tempId ? { ...shot, ...updates } : shot
        ));
    }, []);

    const removeShot = useCallback((tempId) => {
        setShotList(prev => prev.filter(shot => shot.tempId !== tempId));
    }, []);

    // --- Dialogue Block Management ---
    const addBlock = useCallback((shotTempId) => {
        setShotList(prev => prev.map(shot =>
            shot.tempId === shotTempId
                ? {
                    ...shot,
                    dialogueBlocks: [...shot.dialogueBlocks, { id: uuidv4(), characterId: "", text: "", audioUrl: "", duration: 0, pauseDuration: 0.5, isGenerating: false }]
                }
                : shot
        ));
    }, []);

    const updateBlock = useCallback((shotTempId, blockId, field, value) => {
        setShotList(prev => prev.map(shot =>
            shot.tempId === shotTempId
                ? {
                    ...shot,
                    dialogueBlocks: shot.dialogueBlocks.map(block =>
                        block.id === blockId ? { ...block, [field]: value } : block
                    )
                }
                : shot
        ));
    }, []);

    const removeBlock = useCallback((shotTempId, blockId) => {
        setShotList(prev => prev.map(shot =>
            shot.tempId === shotTempId
                ? {
                    ...shot,
                    dialogueBlocks: shot.dialogueBlocks.filter(block => block.id !== blockId)
                }
                : shot
        ));
    }, []);

    // --- Audio Recording & STS Conversion ---
    const handleConvertRecording = useCallback(async (shotTempId, blob) => {
        const shot = shotList.find(s => s.tempId === shotTempId);
        if (!shot) return;

        try {
            // 1. Identify Target Voice (Same logic as TTS-to-STS)
            const primaryBlock = shot.dialogueBlocks[0];
            let targetVoiceUrl = null;

            console.log("[STS] Lookup Debug:", {
                lookingForId: primaryBlock.characterId,
                availableCharIds: characters.map(c => c.id),
                availableRegistryIds: registryVoices.map(v => v.id)
            });

            if (primaryBlock) {
                // Ensure ID comparison is safe (string vs number)
                const char = characters.find(c => String(c.id) === String(primaryBlock.characterId));
                const narrator = registryVoices.find(v => String(v.id) === String(primaryBlock.characterId));

                if (narrator) {
                    targetVoiceUrl = narrator.previewUrl;
                } else if (char) {
                    // Check for cloned voice/recording ref
                    if ((char.voice_id === "recording" || char.voiceId === "recording") && (char.voice_ref_url || char.voiceRefUrl)) {
                        targetVoiceUrl = char.voice_ref_url || char.voiceRefUrl;
                    } else {
                        // Check for registry voice
                        const assignedVoiceId = char.voice_id || char.voiceId;
                        const foundVoice = registryVoices.find(v => v.id === assignedVoiceId);
                        if (foundVoice) {
                            targetVoiceUrl = foundVoice.previewUrl;
                        } else {
                            console.warn(`[STS] Character '${char.name}' has voice_id '${assignedVoiceId}' but it was not found in registry. Registry size: ${registryVoices.length}`);
                        }
                    }
                } else {
                    console.warn(`[STS] Character ID '${primaryBlock.characterId}' not found in Characters or Registry.`);
                }
            }

            if (!targetVoiceUrl) {
                console.error("[STS] Voice Selection Failed. Primary Block:", primaryBlock);
                throw new Error("No target voice selected. Please assign a character with a valid voice to the first block.");
            }

            // 2. Prepare Payload
            const base64Audio = await blobToBase64(blob);

            console.log("[STS] Sending Audio to Seed VC...");

            const seedRes = await fetch(API_CONFIG.SEED_VC_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${API_CONFIG.RUNPOD_API_KEY}`
                },
                body: JSON.stringify({
                    input: {
                        source_audio: base64Audio, // Base64 input supported by our new handler
                        target_audio_url: targetVoiceUrl,
                        diffusion_steps: 25,
                        length_adjust: 1.0,
                        inference_cfg_rate: 0.7,
                        auto_f0_adjust: false
                    }
                })
            });

            if (!seedRes.ok) {
                const errorText = await seedRes.text();
                throw new Error(`API Error ${seedRes.status}: ${errorText}`);
            }

            let seedData = await seedRes.json();
            console.log("[STS] Initial Response:", seedData);

            // Handle Async/Queue Response (RunPod Cold Start)
            if (seedData.status === "IN_QUEUE" || seedData.status === "IN_PROGRESS") {
                const jobId = seedData.id;
                console.log(`[STS] Job Queued (${jobId}). Polling for completion...`);

                // Polling Loop
                while (true) {
                    await new Promise(r => setTimeout(r, 2000)); // Wait 2s

                    const statusRes = await fetch(`${API_CONFIG.SEED_VC_ENDPOINT.replace('/run', '')}/status/${jobId}`, {
                        headers: { "Authorization": `Bearer ${API_CONFIG.RUNPOD_API_KEY}` }
                    });

                    if (!statusRes.ok) throw new Error("Failed to poll status");

                    seedData = await statusRes.json();
                    console.log("[STS] Poll Status:", seedData.status);

                    if (seedData.status === "COMPLETED") break;
                    if (seedData.status === "FAILED") throw new Error("RunPod Job Failed");
                }
            }

            let audioUrl = "";
            if (seedData.output && seedData.output.audio_url) {
                audioUrl = seedData.output.audio_url;
            } else if (seedData.audio_url) { // Handler direct return
                audioUrl = seedData.audio_url;
            } else if (seedData.output && seedData.output.audio) {
                audioUrl = `data:audio/wav;base64,${seedData.output.audio}`;
            } else if (seedData.audio) {
                audioUrl = `data:audio/wav;base64,${seedData.audio}`;
            } else {
                throw new Error(`Unexpected Response: ${JSON.stringify(seedData).substring(0, 100)}...`);
            }

            // 3. Update Shot
            // We'll update the first block's audioUrl (and stitchedAudioUrl)
            const updatedBlocks = shot.dialogueBlocks.map((b, i) => i === 0 ? { ...b, audioUrl: audioUrl } : b);

            updateShot(shotTempId, {
                dialogueBlocks: updatedBlocks,
                stitchedAudioUrl: audioUrl,
                status: "draft",
                isAudioLocked: true,
                totalAudioDuration: 0 // Will auto-update on load
            });

        } catch (err) {
            console.error("STS Failed:", err);
            updateShot(shotTempId, { status: "draft", error: `Voice Conversion Failed: ${err.message}` });
        }
    }, [shotList, characters, registryVoices, updateShot]);
    const handleStartRecording = useCallback(async (shotTempId) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            const chunks = [];

            mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
            mediaRecorder.onstop = async () => {
                const blob = new Blob(chunks, { type: 'audio/webm' }); // Browsers record in webm or ogg usually
                await handleConvertRecording(shotTempId, blob);

                // Cleanup stream
                stream.getTracks().forEach(track => track.stop());
            };

            // Store recorder instance in a way we can access to stop it
            // Ideally we'd use a ref per shot, but for this demo list we'll just attach to window or a simplified map
            // HACK: Attaching to window for simplicity in this function-based list without complex refs
            window[`recorder_${shotTempId}`] = mediaRecorder;

            mediaRecorder.start();
            updateShot(shotTempId, { isRecording: true, error: "" });

        } catch (err) {
            console.error("Mic Error:", err);
            updateShot(shotTempId, { error: "Could not access microphone." });
        }
    }, [updateShot, handleConvertRecording]);

    const handleStopRecording = useCallback((shotTempId) => {
        const recorder = window[`recorder_${shotTempId}`];
        if (recorder && recorder.state !== 'inactive') {
            recorder.stop();
            updateShot(shotTempId, { isRecording: false, status: "generating_seedvc" });
        }
    }, [updateShot]);


    // --- Audio Generation (TTS) ---
    const generateAllDialogue = useCallback(async (shotTempId, force = false) => {
        const shotToGenerate = shotList.find(s => s.tempId === shotTempId);
        if (!shotToGenerate) return;

        updateShot(shotTempId, { status: "generating", error: "" });

        // Valdiation: Check for empty text
        const hasEmptyText = shotToGenerate.dialogueBlocks.some(b => !b.text || !b.text.trim());
        if (hasEmptyText) {
            updateShot(shotTempId, { status: "draft", error: "Please enter text for all dialogue blocks." });
            return;
        }

        try {
            // Construct Multi-Speaker Payload
            const dialoguePayload = shotToGenerate.dialogueBlocks.map(block => {
                const char = characters.find(c => c.id === block.characterId);
                const narrator = registryVoices.find(v => v.id === block.characterId);

                let turn = {
                    text: block.text,
                    speaker: "Unknown",
                    voice_id: null, // Default to null to allow Clone priorities
                    pause_duration: block.pauseDuration || 0.5
                };

                if (narrator) {
                    // 1. Narrator (Directly from Voice Registry)
                    turn.speaker = "Narrator";
                    turn.voice_id = narrator.id;
                } else if (char) {
                    // 2. Character (On-Screen OR Narrator-as-Character)
                    turn.speaker = char.name;

                    // STRICT LOGIC: Check Character Table First
                    const dbVoiceId = char.voice_id || char.voiceId;
                    const dbRefUrl = char.voice_ref_url || char.voiceRefUrl;

                    console.log(`[Voice Logic] Char: ${char.name}, ID: ${dbVoiceId}, Ref: ${dbRefUrl}`);

                    if (dbVoiceId === "recording") {
                        // Case A: Cloned Voice
                        if (dbRefUrl) {
                            turn.ref_audio_urls = [dbRefUrl];
                            delete turn.voice_id; // Use Clone Only
                        } else {
                            console.warn(`[Voice Logic] Character ${char.name} marked as recording but missing ref URL.`);
                        }
                    } else if (dbVoiceId && dbVoiceId !== "None") {
                        // Case B: Pre-set Registry ID in Character Table
                        turn.voice_id = dbVoiceId;
                    }
                    // Case C: Null/None -> Fallback
                }

                // Global Fallback
                if (!turn.voice_id && !turn.ref_audio_urls) {
                    console.log("[Voice Logic] No voice resolved, using default en_us_001");
                    turn.voice_id = "en_us_001";
                }

                return turn;
            });

            console.log("PAYLOAD_DEBUG:", JSON.stringify(dialoguePayload, null, 2));

            // n8n Webhook Call (Single Request)
            const res = await fetch(TTS_WEBHOOK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dialogue: dialoguePayload
                })
            });

            if (!res.ok) throw new Error("TTS Generation Failed");

            const data = await res.json();
            console.log("n8n Response:", data);

            // Parse URL (robust check)
            let audioUrl = "";
            if (Array.isArray(data) && data.length > 0) {
                audioUrl = data[0].output?.url || data[0].url || data[0].audio_url || data[0].image_url;
            } else {
                audioUrl = data.url || data.audio_url || data.output?.url || data.image_url || (typeof data.output === 'string' ? data.output : "");
            }

            if (!audioUrl) throw new Error("No audio URL in response");

            // --- Seed VC Integration ---
            if (shotToGenerate.useSeedVC) {
                console.log("[Seed VC] Post-processing enabled. Starting conversion...");
                updateShot(shotTempId, { status: "generating_seedvc", error: "" }); // Optional: Add new status or keep "generating"

                // 1. Identify Target Voice
                // Strategy: Use the first block's character/voice as the target for the whole clip
                // (Limitation of single-file stitch)
                const primaryBlock = shotToGenerate.dialogueBlocks[0];
                let targetVoiceUrl = null;

                if (primaryBlock) {
                    const char = characters.find(c => c.id === primaryBlock.characterId);
                    const narrator = registryVoices.find(v => v.id === primaryBlock.characterId);

                    if (narrator) {
                        targetVoiceUrl = narrator.previewUrl;
                    } else if (char) {
                        // Check if char has a reliable preview URL
                        // If it's a clone ("recording"), use the ref URL
                        if ((char.voice_id === "recording" || char.voiceId === "recording") && (char.voice_ref_url || char.voiceRefUrl)) {
                            targetVoiceUrl = char.voice_ref_url || char.voiceRefUrl;
                        } else {
                            // If it's a registry voice assigned to a char, we need to find that registry voice's preview URL
                            const assignedVoiceId = char.voice_id || char.voiceId;
                            const foundVoice = registryVoices.find(v => v.id === assignedVoiceId);
                            if (foundVoice) targetVoiceUrl = foundVoice.previewUrl;
                        }
                    }
                }

                if (!targetVoiceUrl) {
                    console.warn("[Seed VC] Could not determine target voice URL from primary speaker. Skipping conversion.");
                } else {
                    console.log("[Seed VC] Converting using target:", targetVoiceUrl);

                    try {
                        const seedRes = await fetch(API_CONFIG.SEED_VC_ENDPOINT, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${API_CONFIG.RUNPOD_API_KEY || ""}` // Add if needed, though mostly standard endpoint
                            },
                            body: JSON.stringify({
                                input: {
                                    source_audio_url: audioUrl,
                                    target_audio_url: targetVoiceUrl,
                                    diffusion_steps: 25,
                                    length_adjust: 1.0,
                                    inference_cfg_rate: 0.7,
                                    auto_f0_adjust: false
                                }
                            })
                        });

                        const seedData = await seedRes.json();
                        console.log("[Seed VC] Response:", seedData);

                        if (seedData.output && seedData.output.audio_url) {
                            audioUrl = seedData.output.audio_url; // Override with converted audio
                            console.log("[Seed VC] Success! New Audio URL:", audioUrl);
                        } else if (seedData.output && seedData.output.audio) {
                            // Handle Base64 output if that's what returns (though we prefer URL)
                            // Ideally we want a URL. If it's base64, we might need to upload it or use data URI
                            // For now assuming the handler returns audio_url as requested in user prompt
                            // But let's support data URI just in case
                            audioUrl = `data:audio/wav;base64,${seedData.output.audio}`;
                        } else if (seedData.error) {
                            throw new Error("Seed VC Error: " + seedData.error);
                        }

                    } catch (seedErr) {
                        console.error("[Seed VC] Conversion Failed:", seedErr);
                        // We do NOT fail the whole generation, we just fall back to valid generic TTS
                        // But we might want to alert the user
                        // updateShot(shotTempId, { error: "Seed VC Failed, using standard TTS." });
                    }
                }
            }
            // ---------------------------

            // Calculate Accurate Duration
            let totalDuration = 3.0; // Fallback
            if (data && data.output && data.output.duration_samples && data.output.sampling_rate) {
                totalDuration = data.output.duration_samples / data.output.sampling_rate;
            } else if (data.duration) {
                totalDuration = data.duration;
            } else if (Array.isArray(data) && data[0]?.output?.duration_samples) {
                // Update All Blocks (Single stitched file covers all)
                totalDuration = data[0].output.duration_samples / data[0].output.sampling_rate;
            }

            const updatedBlocks = shotToGenerate.dialogueBlocks.map(block => ({
                ...block,
                isGenerating: false,
                // We don't have individual block duration from stitched file easily without timestamps
                // So we set it to 0 or null and rely on total shot duration
                duration: 0,
                audioUrl: audioUrl
            }));

            updateShot(shotTempId, {
                dialogueBlocks: updatedBlocks,
                stitchedAudioUrl: audioUrl,
                totalAudioDuration: totalDuration,
                status: "draft", // Ready for review
                isAudioLocked: true,
            });

        } catch (err) {
            console.error(err);
            updateShot(shotTempId, { status: "draft", error: `Generation Failed: ${err.message} ` });
        }
    }, [shotList, updateShot, characters, registryVoices]);

    // --- Save to Bin ---
    const saveToBin = useCallback(async (shot, shouldRemove = true) => {
        console.log("Saving Shot to Bin:", shot);
        try {
            // Use totalAudioDuration if locked, ensuring we capture the full stitched length + delay
            const finalDuration = shot.isAudioLocked
                ? ((shot.totalAudioDuration || 0) + (shot.startDelay || 0))
                : shot.manualDuration;

            // Enrich dialogue blocks with names for the "Script" view
            const enrichedBlocks = (shot.dialogueBlocks || []).map(b => {
                const char = characters.find(c => c.id === b.characterId);
                const regVoice = registryVoices.find(v => v.id === b.characterId);
                return {
                    ...b,
                    characterName: char?.name || regVoice?.name || "Unknown Speaker"
                };
            });

            // Optimistic / Demo Save
            const payload = {
                id: shot.id, // Prefer existing ID (for updates)
                name: shot.name || `Clip ${new Date().toLocaleTimeString()} `,
                scene_id: shot.sceneId || selectedKeyframe?.id,
                scene_name: shot.sceneName || selectedKeyframe?.name || "Unknown Scene",
                character_id: shot.dialogueBlocks?.[0]?.characterId || shot.characterId || selectedKeyframe?.characterId || null,
                thumbnail_url: shot.sceneImageUrl || selectedKeyframe?.image_url || selectedKeyframe?.imageUrl,
                video_url: shot.videoUrl || null, // Might be null if pending
                last_frame_url: shot.lastFrameUrl || null, // Last frame from n8n
                raw_video_url: shot.rawVideoUrl || shot.videoUrl,
                audio_url: shot.stitchedAudioUrl || null,
                prompt: shot.prompt,
                motion_type: shot.motion,
                duration: parseFloat(finalDuration),
                dialogue_blocks: shot.dialogueBlocks || [],
                speaker_type: shot.speakerType,
                status: shot.status || "completed", // Allow passing 'rendering'
                created_at: new Date().toISOString(),
                start_delay: shot.startDelay || 0,
                has_audio: !!shot.stitchedAudioUrl // Explicit flag
            };

            let finalClip = { ...payload }; // Local state version

            if (supabase) {
                // DATA CLEANUP: Remove fields not in DB schema
                const dbPayload = { ...payload };
                delete dbPayload.audio_url;
                delete dbPayload.raw_video_url;
                delete dbPayload.scene_name;

                // Add schema-specific fields
                dbPayload.stitched_audio_url = shot.stitchedAudioUrl;
                dbPayload.start_delay = shot.startDelay;
                dbPayload.dialogue_blocks = JSON.stringify(enrichedBlocks);
                dbPayload.shot_type = shot.speakerType === 'on_screen' ? 'lipsync' : 'cinematic';

                // CRITICAL FIX: Ensure video_url is present if available
                if (shot.videoUrl) {
                    dbPayload.video_url = shot.videoUrl;
                }

                // If we have a known DB ID, use it. Otherwise, use the shot.id if it looks like a valid UUID, or generate new.
                const validId = (shot.dbId && shot.dbId.length > 10) ? shot.dbId : (shot.id && shot.id.length > 10 && !shot.id.startsWith("saved_") ? shot.id : uuidv4());
                dbPayload.id = validId;

                // [Persistence] Inject User ID for RLS
                const { data: { user } } = await supabase.auth.getUser();
                dbPayload.user_id = user?.id;

                console.log("[saveToBin] DB Upsert Payload:", JSON.stringify(dbPayload, null, 2));

                const { data, error } = await supabase
                    .from("clips")
                    .upsert(dbPayload)
                    .select()
                    .single();

                if (error) {
                    console.error("[saveToBin] SUPABASE ERROR:", error);
                    throw error;
                }

                if (data) {
                    console.log("[saveToBin] SAVE SUCCESS. ID:", data.id);
                    finalClip = {
                        ...finalClip,
                        ...data,
                        // Restore local props
                        dialogue_blocks: enrichedBlocks,
                        videoUrl: data.video_url || finalClip.videoUrl // Sync back
                    };
                }
            }

            // Update Local State (Merge if exists, else prepend)
            setSavedClips(prev => {
                const exists = prev.find(c => c.id === finalClip.id);
                if (exists) return prev.map(c => c.id === finalClip.id ? finalClip : c);
                return [finalClip, ...prev];
            });

            if (shouldRemove) {
                removeShot(shot.tempId);
                setPreviewShot(null);
                setSelectedKeyframe(null);
            }

            return finalClip; // Return for chaining

        } catch (err) {
            console.error("Save to Bin Execution Error:", err);
            alert("Unexpected error saving clip: " + err.message);
        }
    }, [updateShot, removeShot, selectedKeyframe, savedClips.length, characters, registryVoices]);

    // --- Video Rendering ---
    // --- Video Rendering ---
    const renderClip = useCallback(async (shot) => {
        updateShot(shot.tempId, { status: "rendering", error: "" });

        const webhookUrl = shot.speakerType === "on_screen" ? LIPSYNC_WEBHOOK : I2V_WEBHOOK;

        // [Persistence] Fetch User for Payload
        const { data: { user } } = await supabase.auth.getUser();

        try {
            // 1. Create Initial DB Record (Pending/Rendering)
            console.log("Creating initial pending record...");
            const pendingShot = {
                ...shot,
                status: 'rendering',
                videoUrl: "" // No video yet
            };
            console.log("[renderClip] Step 1: Initial Save (Status: rendering)");
            const dbRecord = await saveToBin(pendingShot, false); // Returns the saved record (with ID)
            const dbId = dbRecord?.id;

            console.log("[renderClip] Step 1 Result: DB ID =", dbId);

            if (dbId) {
                // Attach DB ID to workshop shot so we can update it later
                updateShot(shot.tempId, { dbId: dbId, status: 'rendering' });
            } else {
                console.error("WARNING: Initial saveToBin did not return an ID. Update will fail.");
            }

            // Determine duration and frames
            const duration = shot.isAudioLocked
                ? ((shot.totalAudioDuration || 0) + (shot.startDelay || 0))
                : shot.manualDuration;

            // FramePack expects integer frames (e.g. 300 for 10s @ 30fps)
            const numFrames = Math.ceil((duration || 3) * 30);

            // 2. Construct & Sanitize Payload
            const rawPayload = {
                clip_name: shot.name,
                // Safety Truncation: FramePack has a 75 token limit
                prompt: (shot.prompt || "").slice(0, 280),
                image_url: shot.sceneImageUrl,
                audio_url: shot.stitchedAudioUrl,
                motion: shot.motion || "static",
                num_frames: numFrames, // Explicit frame count for I2V
                // Passing dialogue structure in case backend supports multi-speaker face mapping
                dialogue: shot.dialogueBlocks.map(b => ({
                    speaker_id: b.characterId,
                    text: b.text,
                    duration: b.duration || 0,
                    character_name: b.characterName || "Unknown"
                })),

                // [Persistence v2.0] Inject IDs for Server-Side Update
                id: dbId,
                clip_id: dbId, // Alias
                user_id: user?.id || null,
                scene_id: shot.sceneId || null,
                character_id: shot.characterId || null,
                setting_id: shot.setting_id || null
            };

            // Global Sanitizer (Recursively convert "" to null)
            const sanitizePayload = (obj) => {
                const clean = {};
                Object.keys(obj).forEach(key => {
                    const val = obj[key];
                    if (val === "" || (typeof val === 'string' && val.trim() === "")) {
                        clean[key] = null;
                    } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                        clean[key] = sanitizePayload(val);
                    } else {
                        clean[key] = val;
                    }
                });
                return clean;
            };

            const finalPayload = sanitizePayload(rawPayload);
            console.log("SANITIZED N8N PAYLOAD:", JSON.stringify(finalPayload, null, 2));

            const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalPayload)
            });

            if (!res.ok) throw new Error("Video rendering failed.");

            const data = await res.json();
            console.log("Rendering Response Data:", JSON.stringify(data, null, 2));

            // Robust Recursive URL Finder
            const findVideoUrl = (obj) => {
                if (!obj) return null;
                if (Array.isArray(obj)) {
                    for (let item of obj) {
                        const found = findVideoUrl(item);
                        if (found) return found;
                    }
                    return null;
                }
                if (typeof obj === 'object') {
                    // Check likely keys first
                    const candidates = [
                        obj.s3_url, obj.video_url, obj.url, obj['final-url'],
                        obj.output?.s3_url, obj.output?.video_url, obj.output?.url,
                        obj.artifacts?.video_url, obj.output?.artifacts?.video_url
                    ];
                    for (let c of candidates) {
                        if (c && typeof c === 'string' && (c.startsWith('http'))) return c;
                    }
                    // Deep search for any mp4
                    for (let key in obj) {
                        if (typeof obj[key] === 'object') {
                            const found = findVideoUrl(obj[key]);
                            if (found) return found;
                        } else if (typeof obj[key] === 'string' && obj[key].match(/\.mp4(\?.*)?$/i) && obj[key].startsWith('http')) {
                            return obj[key];
                        }
                    }
                }
                return null;
            };

            const videoUrl = findVideoUrl(data);
            console.log("Extracted Video URL:", videoUrl);

            if (!videoUrl) {
                throw new Error("No video URL found in response.");
            }

            // Extract last frame URL if present
            const lastFrameUrl = data?.last_frame_url || data?.lastFrameUrl || data?.output?.last_frame_url || null;
            console.log("Extracted Last Frame URL:", lastFrameUrl);

            const updatedShot = {
                ...shot,
                dbId: dbId, // Pass the ID to perform an Update
                videoUrl: videoUrl,
                lastFrameUrl: lastFrameUrl, // Add last frame URL
                status: "preview_ready", // In Workshop
                manualDuration: shot.isAudioLocked ? shot.totalAudioDuration : shot.manualDuration
            };

            updateShot(shot.tempId, updatedShot);

            // 2. Update DB Record with Final URL
            console.log("[renderClip] Step 2: Final Save starting...");
            console.log("   - DB ID:", dbId);
            console.log("   - Video URL:", videoUrl);

            // Construct explicit final object to avoid stale state references
            const finalSaveObj = {
                ...updatedShot,
                videoUrl: videoUrl, // Explicit override
                status: 'completed'
            };

            const finalRecord = await saveToBin(finalSaveObj, false);

            if (!finalRecord) {
                console.error("[renderClip] CRITICAL: Final SaveToBin returned null/undefined!");
                throw new Error("Failed to save final video URL to database.");
            }

            console.log("[renderClip] Step 2 Result: Success. Record:", finalRecord);

        } catch (err) {
            console.error("Render Error:", err);
            updateShot(shot.tempId, { status: "draft", error: `Rendering failed: ${err.message} ` });
        }
    }, [updateShot, saveToBin]);
    // Ideally we add saveToBin to dependency array, assuming saveToBin is stable (useCallback).
    // We will add it below in the tool call for correctness if possible, but let's stick to simple text replace first.




    // DELETE LOGIC
    // DELETE LOGIC
    const handleDeleteClip = (clip) => {
        setClipToDelete(clip);
    };

    const handleConfirmDelete = async () => {
        const clip = clipToDelete;
        if (!clip) return;

        setIsDeleting(true);
        try {
            const newSaved = savedClips.filter(c => c.id !== clip.id);
            setSavedClips(newSaved);

            if (supabase && clip.id && !String(clip.id).startsWith("saved_")) {
                await supabase.from("clips").delete().eq("id", clip.id);
            }
        } catch (error) {
            console.error("Delete Error:", error);
            alert("Failed to delete clip.");
        } finally {
            setIsDeleting(false);
            setClipToDelete(null);
        }
    };

    // EDIT LOGIC
    const handleEditClip = (clip) => {
        // Restore clip data to "workshop" (Story Studio context)
        // Restore clip data to "workshop" (Story Studio context)
        const scene = keyframes.find(s => s.id === clip.scene_id);
        if (scene) setSelectedKeyframe(scene);

        const restoredShot = {
            id: `restored_${Date.now()} `,
            tempId: Date.now(),
            name: clip.name ? `${clip.name} (Remix)` : "", // Auto-append Remix
            sceneId: clip.scene_id,
            sceneImageUrl: scene?.image_url || clip.thumbnail_url || clip.image_url, // Prefer live keyframe image to "heal" broken thumbnails
            prompt: clip.prompt,
            motion: clip.motion_type || "static",
            manualDuration: clip.duration || 3,
            dialogueBlocks: clip.dialogue_blocks && clip.dialogue_blocks.length > 0 ? clip.dialogue_blocks.map(b => ({
                ...b,
                isGenerating: false,
                audioUrl: "" // Clear audio to force regeneration or keep safe
            })) : [
                { id: uuidv4(), characterId: clip.character_id || "", text: "", audioUrl: "", duration: 0, pauseDuration: 0.5, isGenerating: false }
            ],
            speakerType: clip.speaker_type || "on_screen",
            status: "draft",
            videoUrl: "",
            error: "",
            stitchedAudioUrl: "",
            totalAudioDuration: 0,
            isAudioLocked: false,
            startDelay: clip.start_delay || 0,
        };

        setShotList(prev => [restoredShot, ...prev]); // Prepend restored clip
        setPreviewShot(null);
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // --- Render Logic ---
    return (
        <div className="min-h-screen bg-white">

            {/* Header */}
            <div className="text-center mb-6">
                <h2 className="text-xl font-bold mb-2">Clip Studio</h2>
                <p className="text-gray-500 text-sm">Transform keyframes into video clips with dialogue and motion.</p>
            </div>

            {/* KEYFRAME SELECTION */}
            <section className="mb-12">
                <h2 className="text-base font-bold text-gray-800 mb-4">1. Select a Keyframe</h2>
                <div className="overflow-x-auto flex gap-4 pb-4 border-b border-gray-100 min-h-[120px]">
                    {keyframes.map(scene => (
                        <div
                            key={scene.id}
                            className={`flex-shrink-0 w-48 bg-slate-50 border rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-all group flex flex-col ${selectedKeyframe?.id === scene.id ? 'border-black shadow-md ring-1 ring-black' : 'border-slate-200'}`}
                            onClick={() => setSelectedKeyframe(scene)}
                        >
                            <div className="aspect-video bg-gray-200 relative">
                                <img
                                    src={scene.image_url || scene.imageUrl || "https://placehold.co/400x300?text=No+Image"}
                                    alt={scene.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { e.target.src = "https://placehold.co/400x300?text=Error"; }}
                                />
                                {/* Lip-Sync Ready Badge */}
                                {scene.characterId && (scene.cameraLabel === "Standard" || scene.cameraLabel === "Close & Intimate") && (
                                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-green-500/90 text-white text-[9px] px-1.5 py-0.5 rounded shadow font-bold z-10 backdrop-blur-sm">
                                        <span>👄</span>
                                        <span>Ready</span>
                                    </div>
                                )}
                                {selectedKeyframe?.id === scene.id && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20 backdrop-blur-[1px]">
                                        <div className="bg-white rounded-full p-1 shadow-lg">
                                            <span className="text-blue-600 text-lg font-bold">✓</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="p-2 flex flex-col flex-1 gap-2">
                                <div className="font-bold text-xs text-slate-800 truncate" title={scene.name || "Untitled"}>{scene.name || "Untitled"}</div>
                            </div>
                        </div>
                    ))}
                </div>
                <button
                    onClick={addShot}
                    className="mt-6 px-4 py-2 bg-black text-white text-sm font-bold rounded-lg shadow-md hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!selectedKeyframe}
                >
                    + Add New Clip
                </button>
            </section>


            <section className="mb-12">
                <h2 className="text-base font-bold text-gray-800 mb-4">2. Clip Workshop</h2>
                <div className="flex flex-col gap-6">
                    {shotList.length === 0 && (
                        <div className="text-center py-12 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
                            No clips in workshop. Select a keyframe and click "+ Add New Clip" to begin.
                        </div>
                    )}
                    {shotList.map((shot, index) => {
                        // [v60] Live Metadata Lookup (Syncs with Badges)
                        const parentScene = keyframes.find(k => k.id === shot.sceneId);
                        const workingCharId = parentScene ? parentScene.characterId : shot.characterId;
                        const workingCamera = parentScene ? parentScene.cameraLabel : shot.cameraLabel;
                        const isLipSyncEligible = workingCharId && (workingCamera === "Standard" || workingCamera === "Close & Intimate");

                        const inputPlaceholder = shot.speakerType === "on_screen" ? "Enter dialogue..." : "Enter narration...";
                        const audioSectionLabel = shot.speakerType === "on_screen" ? "Dialogue" : "Narration";

                        const totalAudioDuration = shot.totalAudioDuration || 0;
                        const finalDuration = shot.isAudioLocked ? (totalAudioDuration + (shot.startDelay || 0)) : shot.manualDuration;

                        return (
                            <div key={shot.tempId} className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 relative">
                                <button
                                    onClick={() => removeShot(shot.tempId)}
                                    className="absolute top-4 right-4 text-gray-400 hover:text-red-500 text-2xl"
                                >
                                    ×
                                </button>
                                <div className="absolute top-4 left-4 text-xs font-bold text-gray-400">#{index + 1}</div>

                                {/* Shot Name Input (Workshop Level) */}
                                <div className="ml-12 mr-12 mb-4">
                                    <input
                                        type="text"
                                        placeholder="Clip Name (e.g. Hero Intro)"
                                        value={shot.name}
                                        onChange={(e) => updateShot(shot.tempId, { name: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold focus:border-black focus:ring-0 outline-none transition-colors"
                                    />
                                </div>


                                <div className="flex flex-col md:flex-row gap-8 mt-4">
                                    {/* LEFT: PREVIEW & ACTIONS */}
                                    <div className="w-full md:w-1/3 flex flex-col gap-4">
                                        <div className="aspect-video bg-gray-200 rounded-lg overflow-hidden relative group">
                                            {(shot.videoUrl && (shot.status === 'preview_ready' || shot.status === 'completed')) ? (
                                                <>
                                                    <video src={shot.videoUrl} poster={shot.thumbnail_url} className="w-full h-full object-cover" />
                                                    <button onClick={() => setPreviewShot(shot)} className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-4xl opacity-0 hover:opacity-100 transition-opacity">▶</button>
                                                </>
                                            ) : (
                                                <img src={shot.sceneImageUrl} alt="Scene" className="w-full h-full object-cover opacity-80" />
                                            )}
                                            {shot.status === 'rendering' && (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white text-center p-4">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white mb-2"></div>
                                                    <p className="text-sm font-semibold">Rendering...</p>
                                                </div>
                                            )}
                                            {(shot.status === 'generating' || shot.status === 'generating_seedvc') && (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white text-center p-4">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white mb-2"></div>
                                                    <p className="text-sm font-semibold">
                                                        {shot.status === 'generating_seedvc' ? "Converting Voice..." : "Generating Audio..."}
                                                    </p>
                                                </div>
                                            )}
                                            {shot.status === 'preview_ready' && (
                                                <div className="absolute top-2 right-2 bg-black text-white text-[10px] font-bold px-2 py-1 rounded shadow">PREVIEW READY</div>
                                            )}
                                        </div>

                                        <div className="text-center">
                                            <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">Duration</div>
                                            <div className="text-xl font-mono font-bold text-gray-800">{Number(finalDuration).toFixed(1)}s</div>
                                            {shot.isAudioLocked ? (
                                                <div className="text-[10px] text-gray-800 font-medium flex items-center justify-center gap-1">
                                                    <span>🔒 Locked to Audio</span>
                                                </div>
                                            ) : (
                                                <input
                                                    type="range" min="1" max="10" step="0.5"
                                                    value={shot.manualDuration}
                                                    onChange={e => updateShot(shot.tempId, { manualDuration: parseFloat(e.target.value) })}
                                                    className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-2"
                                                />
                                            )}
                                        </div>

                                        {shot.status === 'draft' && (
                                            <button
                                                onClick={() => renderClip(shot)}
                                                className="w-full py-3 rounded-lg bg-black text-white font-bold text-sm hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-all"
                                                disabled={
                                                    !shot.name?.trim() ||
                                                    !shot.prompt?.trim() ||
                                                    (shot.speakerType === "on_screen" && !shot.stitchedAudioUrl)
                                                }
                                            >
                                                {shot.speakerType === "narrator" ? "Render Video" : "Render LipSync"}
                                            </button>
                                        )}
                                        {(shot.status === 'preview_ready' || shot.status === 'completed') && (
                                            <div className="flex gap-2">
                                                <button onClick={() => renderClip(shot)} className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50">↻ Regenerate</button>
                                                <button onClick={() => saveToBin(shot)} className="flex-1 px-3 py-2 rounded-lg bg-black text-white text-xs font-bold hover:bg-gray-800 shadow-sm">Save to Bin</button>
                                            </div>
                                        )}
                                        {shot.error && <div className="text-xs text-red-500 font-bold text-center mt-2">{shot.error}</div>}
                                    </div>

                                    {/* RIGHT: CONTROLS */}
                                    <div className="flex flex-col gap-6 flex-1">
                                        {/* Visual Controls */}
                                        <div className="flex flex-col gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-slate-700 uppercase mb-2 block">Visual Description</label>
                                                <textarea
                                                    className="w-full bg-slate-50 border border-gray-200 rounded-lg p-3 text-sm focus:border-black outline-none transition-colors"
                                                    rows={shot.speakerType === "narrator" ? 3 : 2}
                                                    placeholder="Describe the action or setting..."
                                                    value={shot.prompt}
                                                    onChange={e => updateShot(shot.tempId, { prompt: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-700 uppercase mb-2 block">📷 Camera Movement</label>
                                                <select
                                                    className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-sm outline-none"
                                                    value={shot.motion}
                                                    onChange={e => updateShot(shot.tempId, { motion: e.target.value })}
                                                >
                                                    <option value="static">Static (No movement)</option>
                                                    <option value="zoom_in">Zoom In</option>
                                                    <option value="zoom_out">Zoom Out</option>
                                                    <option value="pan_left">Pan Left</option>
                                                    <option value="pan_right">Pan Right</option>
                                                </select>
                                            </div>
                                        </div>

                                        <hr className="border-gray-100" />

                                        {/* Audio Controls */}
                                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                                                <div className="flex items-center justify-between md:justify-start gap-4 w-full md:w-auto">
                                                    <label className="text-xs font-bold text-slate-700 uppercase">{audioSectionLabel}</label>
                                                    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded px-2 py-1">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase">Start Delay:</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.1"
                                                            value={shot.startDelay || 0}
                                                            onChange={e => updateShot(shot.tempId, { startDelay: parseFloat(e.target.value) })}
                                                            className="w-10 text-[10px] font-bold outline-none text-center bg-transparent"
                                                        />
                                                        <span className="text-[10px] text-gray-400">s</span>
                                                    </div>
                                                </div>

                                                <div className="flex bg-white rounded-md border border-gray-200 p-0.5 w-full md:w-auto">
                                                    <div className="relative group">
                                                        <button
                                                            onClick={() => updateShot(shot.tempId, { speakerType: "on_screen" })}
                                                            disabled={!isLipSyncEligible}
                                                            className={`flex-1 md:flex-none px-3 py-1 text-[10px] uppercase font-bold rounded flex items-center gap-1 ${shot.speakerType === "on_screen" ? "bg-black text-white" : "text-gray-400"
                                                                } disabled:opacity-40 disabled:cursor-not-allowed`}
                                                        >
                                                            Character
                                                            {(!isLipSyncEligible) && (
                                                                <span className="text-[8px] opacity-70">⛔</span>
                                                            )}
                                                        </button>
                                                        {(!isLipSyncEligible) && (
                                                            <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-black text-white text-[10px] rounded shadow-lg z-20 pointer-events-none">
                                                                Lip-Sync requires a 'Standard' or 'Close & Intimate' shot with a Character.
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button onClick={() => updateShot(shot.tempId, { speakerType: "narrator" })} className={`flex-1 md:flex-none px-3 py-1 text-[10px] uppercase font-bold rounded ${shot.speakerType === "narrator" ? "bg-black text-white" : "text-gray-400"} `}>Narrator</button>
                                                </div>
                                            </div>

                                            {/* INPUT MODE TOGGLE */}
                                            <div className="flex bg-gray-200 p-1 rounded-lg mb-4">
                                                <button
                                                    onClick={() => updateShot(shot.tempId, { inputMode: "text" })}
                                                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${shot.inputMode !== "mic" ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-gray-700"
                                                        }`}
                                                >
                                                    Text to Speech
                                                </button>
                                                <button
                                                    onClick={() => updateShot(shot.tempId, { inputMode: "mic" })}
                                                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${shot.inputMode === "mic" ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-gray-700"
                                                        }`}
                                                >
                                                    Microphone (STS)
                                                </button>
                                            </div>

                                            <div className="flex flex-col gap-3">
                                                {shot.dialogueBlocks.map((block, bIdx) => (
                                                    <div key={block.id} className="relative pl-3 border-l-2 border-gray-200">
                                                        <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3 mb-2">
                                                            <select
                                                                value={block.characterId}
                                                                onChange={e => updateBlock(shot.tempId, block.id, "characterId", e.target.value)}
                                                                className="bg-white border border-gray-200 rounded-lg text-xs px-3 py-2 outline-none"
                                                            >
                                                                <option value="">Select Speaker...</option>
                                                                <optgroup label="Characters">
                                                                    {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                                </optgroup>
                                                                {shot.speakerType === "narrator" && registryVoices.length > 0 && (
                                                                    <optgroup label="Voice Registry">
                                                                        {registryVoices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                                                    </optgroup>
                                                                )}
                                                            </select>

                                                            {/* CONDITIONAL INPUT AREA */}
                                                            {shot.inputMode === "mic" ? (
                                                                <div className="flex items-center justify-center bg-gray-50 border border-dashed border-gray-300 rounded-lg text-xs text-gray-400 italic">
                                                                    <span>Ready to record...</span>
                                                                </div>
                                                            ) : (
                                                                <div className="flex gap-2">
                                                                    <input
                                                                        type="text"
                                                                        className="flex-1 bg-white border border-gray-200 rounded-lg text-sm px-3 py-2 outline-none"
                                                                        placeholder={inputPlaceholder}
                                                                        value={block.text}
                                                                        onChange={e => updateBlock(shot.tempId, block.id, "text", e.target.value)}
                                                                    />
                                                                    {shot.inputMode !== "mic" && shot.dialogueBlocks.length > 1 && (
                                                                        <button onClick={() => removeBlock(shot.tempId, block.id)} className="text-gray-300 hover:text-red-400 px-2">×</button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            {block.audioUrl && <span className="text-[10px] text-gray-800 font-bold">✓ Audio Included</span>}
                                                            {block.isGenerating && <span className="text-[10px] text-gray-500 font-bold animate-pulse">Generating...</span>}
                                                            <div className="flex items-center gap-1 ml-auto">
                                                                <span className="text-[10px] uppercase font-bold text-gray-400">Pause After:</span>
                                                                <input
                                                                    type="number"
                                                                    step="0.1"
                                                                    min="0"
                                                                    className="w-12 text-[10px] font-bold bg-white border border-gray-200 rounded px-1 py-1 outline-none text-center"
                                                                    value={block.pauseDuration || 0.5}
                                                                    onChange={e => updateBlock(shot.tempId, block.id, "pauseDuration", parseFloat(e.target.value))}
                                                                />
                                                                <span className="text-[10px] text-gray-400">s</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}

                                                <div className="flex justify-between items-center mt-2 gap-2">
                                                    {shot.speakerType === "on_screen" && shot.inputMode !== "mic" && (
                                                        <button onClick={() => addBlock(shot.tempId)} className="text-[10px] font-bold text-gray-600 hover:underline hover:text-black">+ Add Dialogue Block</button>
                                                    )}

                                                    {/* CONDITIONAL ACTION BUTTONS */}
                                                    {shot.inputMode === "mic" ? (
                                                        <button
                                                            onClick={() => shot.isRecording ? handleStopRecording(shot.tempId) : handleStartRecording(shot.tempId)}
                                                            className={`w-full py-3 text-sm font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 ${shot.isRecording ? "bg-red-500 text-white animate-pulse" : "bg-black text-white hover:bg-gray-800"
                                                                }`}
                                                        >
                                                            {shot.isRecording ? (
                                                                <>
                                                                    <span className="w-2 h-2 bg-white rounded-full animate-ping" />
                                                                    Stop Recording
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span>🎤</span>
                                                                    Start Recording & Convert
                                                                </>
                                                            )}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => generateAllDialogue(shot.tempId, true)}
                                                            disabled={shot.dialogueBlocks.some(b => !b.text || !b.text.trim())}
                                                            className={`ml-auto px-4 py-2 text-xs font-bold rounded-lg shadow-sm transition-all ${shot.dialogueBlocks.some(b => !b.text || !b.text.trim())
                                                                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                                                : "bg-black text-white hover:bg-gray-800"
                                                                }`}
                                                        >
                                                            {shot.dialogueBlocks.some(b => b.audioUrl) ? "⚡ Regenerate Dialogue" : "⚡ Generate Dialogue"}
                                                        </button>
                                                    )}
                                                </div>

                                                {/* AUDIO PREVIEW */}
                                                {shot.stitchedAudioUrl && (
                                                    <div className="mt-3 bg-gray-100 rounded-lg p-2 flex items-center justify-between animate-fade-in">
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase mr-2">Preview Audio:</span>
                                                        <audio
                                                            controls
                                                            src={shot.stitchedAudioUrl}
                                                            className="h-8 w-full max-w-[200px]"
                                                            onLoadedMetadata={(e) => {
                                                                if (e.target.duration && e.target.duration !== Infinity) {
                                                                    updateShot(shot.tempId, { totalAudioDuration: e.target.duration });
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* SAVED CLIPS */}
            <section className="mt-12 pt-12 border-t border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-base font-bold text-gray-800">Saved Clips</h3>
                </div>
                <div className="overflow-x-auto flex gap-4 pb-4 border-b border-gray-100 min-h-[120px]">
                    {savedClips.length === 0 && (
                        <div className="w-full text-center py-12 text-gray-400 text-sm border border-dashed rounded-lg bg-gray-50">
                            No saved clips yet. Create and render a clip to save it here.
                        </div>
                    )}
                    {savedClips.map(clip => (
                        <div
                            key={clip.id}
                            onClick={() => setPreviewShot(clip)}
                            className="flex-shrink-0 w-48 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-all group flex flex-col"
                        >
                            <div className="aspect-video bg-black relative">
                                {/* Badges */}
                                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-10">
                                    {clip.has_audio ? (
                                        (clip.speaker_type === 'on_screen' || clip.speaker_type === 'character')
                                            ? <span className="bg-green-500/90 backdrop-blur-sm px-1.5 py-0.5 rounded shadow text-[12px] text-white" title="Lipsync">👄</span>
                                            : <span className="bg-green-500/90 backdrop-blur-sm px-1.5 py-0.5 rounded shadow text-[12px] text-white" title="Audio Only">🔊</span>
                                    ) : (
                                        <span className="bg-green-500/90 backdrop-blur-sm px-1.5 py-0.5 rounded shadow text-[12px] text-white" title="Silent">🔇</span>
                                    )}
                                </div>

                                <video src={clip.video_url} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1 rounded">
                                    {Number(clip.duration).toFixed(1)}s
                                </div>
                            </div>
                            <div className="p-2 flex flex-col flex-1 gap-2">
                                <h4 className="font-bold text-xs text-slate-800 truncate" title={clip.name}>{clip.name || "Untitled Clip"}</h4>
                                <div className="mt-auto flex justify-between items-center gap-2">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleEditClip(clip); }}
                                        className="flex-1 text-[10px] font-bold text-slate-700 border border-slate-200 rounded py-1 hover:bg-white hover:border-slate-400 transition-colors"
                                    >
                                        Modify
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteClip(clip); }}
                                        className="text-[10px] font-bold text-red-500 hover:text-red-700 px-1"
                                        title="Delete"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* PREVIEW MODAL */}
            {/* PREVIEW MODAL */}
            {
                previewShot && (
                    previewShot.status === 'completed' || (String(previewShot.id).startsWith("saved_") || previewShot.created_at) ? (
                        <ClipCard
                            clip={previewShot}
                            onClose={() => setPreviewShot(null)}
                            onEdit={handleEditClip}
                            onDelete={handleDeleteClip}
                            characters={characters}
                            registryVoices={registryVoices}
                            onGenerateKeyframe={async (clip, blob) => {
                                // Removed confirm dialog
                                console.log("PARENT: onGenerateKeyframe called with blob size:", blob?.size);

                                if (!blob) {
                                    alert("Error: No image captured from video.");
                                    return;
                                }

                                try {
                                    console.log("PARENT: onGenerateKeyframe called with blob size:", blob?.size);

                                    if (!blob) {
                                        alert("Error: No image captured from video.");
                                        return;
                                    }

                                    // SUSPICIOUS BLOB CHECK [v12]
                                    if (blob.size < 1000) {
                                        const text = await blob.text();
                                        console.error("Small Blob Detected:", text);
                                        alert(`[v12 Diagnostic] Capture Failed.\n\nThe server returned an error instead of an image.\n\nContent: ${text.substring(0, 500)}`);
                                        return;
                                    }

                                    const filename = `${Date.now()}_${clip.id}_end.png`;
                                    console.log("Uploading via Webhook (kind='scene'):", filename);

                                    const formData = new FormData();
                                    formData.append("file", blob, filename);
                                    formData.append("name", "Frame Capture: " + clip.name);
                                    formData.append("kind", "scene");

                                    const uploadRes = await fetch(API_CONFIG.UPLOAD_REFERENCE_IMAGE, {
                                        method: "POST",
                                        body: formData
                                    });

                                    if (!uploadRes.ok) {
                                        throw new Error(`Upload Webhook Failed: ${uploadRes.status}`);
                                    }

                                    const uploadData = await uploadRes.json();
                                    console.log("Upload Webhook Response:", uploadData);

                                    const publicUrl = uploadData.publicUrl || uploadData.url || uploadData.image_url || (Array.isArray(uploadData) && uploadData[0]?.url);

                                    if (!publicUrl) {
                                        throw new Error("No URL returned from upload webhook");
                                    }
                                    console.log("Public URL generated:", publicUrl);

                                    // Lookup original scene to inherit metadata
                                    // Lookup original scene to inherit metadata
                                    const sourceScene = keyframes.find(k => k.id === (clip.scene_id || clip.sceneId)) || {};

                                    // [v52] Robust Metadata Inheritance for Badges
                                    const inheritedCamera = clip.camera_angle || clip.cameraLabel || sourceScene.camera_angle || sourceScene.cameraLabel || null;
                                    const inheritedChar = clip.character_id || clip.characterId || sourceScene.character_id || sourceScene.characterId || null;
                                    const inheritedSetting = clip.setting_id || clip.settingId || sourceScene.setting_id || sourceScene.settingId || null;

                                    const newKeyframePayload = {
                                        name: `${clip.name} ext`,
                                        prompt: clip.prompt || sourceScene.prompt || "Captured end frame",
                                        image_url: publicUrl,
                                        character_id: inheritedChar,
                                        setting_id: inheritedSetting,
                                        camera_angle: inheritedCamera,
                                        created_at: new Date().toISOString()
                                    };
                                    console.log("Inserting into DB:", newKeyframePayload);

                                    const { data: insertData, error: insertError } = await supabase
                                        .from('keyframes')
                                        .insert([newKeyframePayload])
                                        .select();

                                    if (insertError) {
                                        console.error("Supabase DB Error:", insertError);
                                        throw new Error(`Database insert failed: ${insertError.message}`);
                                    }
                                    console.log("DB Insert successful:", insertData);

                                    if (insertData && insertData[0]) {
                                        const s = insertData[0];
                                        const formattedKeyframe = {
                                            id: s.id,
                                            name: s.name,
                                            image_url: s.image_url,
                                            imageUrl: s.image_url,
                                            characterId: s.character_id,
                                            description: s.prompt,
                                            setting_id: newKeyframePayload.setting_id,
                                            cameraLabel: newKeyframePayload.camera_angle // Key: Required for Lip Sync Ready Badge
                                        };

                                        setKeyframes(prev => [formattedKeyframe, ...prev]);

                                        // [v47] Auto-Add to Clip Workshop (Draft)
                                        // Wrapped in try/catch to prevent white screen if initialization fails
                                        try {
                                            console.log("LOG: Initializing Draft Shot with:", formattedKeyframe);
                                            const newDraftShot = {
                                                id: `local_${uuidv4()}`,
                                                tempId: Date.now(),
                                                name: formattedKeyframe.name || "Untitled Extension",
                                                characterId: formattedKeyframe.characterId || "",
                                                // Initialize mandatory dialogueBlocks array so .map doesn't crash
                                                dialogueBlocks: [
                                                    {
                                                        id: uuidv4(),
                                                        characterId: formattedKeyframe.characterId || "",
                                                        text: "",
                                                        audioUrl: "",
                                                        duration: 0,
                                                        pauseDuration: 0.5,
                                                        isGenerating: false
                                                    }
                                                ],
                                                text: "", // legacy fallback
                                                audioUrl: "",
                                                duration: 0,
                                                manualDuration: 2.5, // Default manual duration
                                                pauseDuration: 0.5,
                                                isGenerating: false,
                                                speakerType: "on_screen",
                                                status: "draft",
                                                videoUrl: "",
                                                error: "",
                                                stitchedAudioUrl: "",
                                                totalAudioDuration: 0,
                                                isAudioLocked: false,
                                                startDelay: 0,
                                                sceneId: formattedKeyframe.id,
                                                sceneImageUrl: formattedKeyframe.image_url || formattedKeyframe.imageUrl
                                            };
                                            console.log("LOG: Created Draft Shot:", newDraftShot);
                                            setShotList(prev => [newDraftShot, ...(prev || [])]);
                                        } catch (err) {
                                            console.error("CRITICAL: Failed to auto-create draft shot:", err);
                                            // Do not rethrow, just let the flow continue (user just won't see the draft)
                                        }

                                        // AUTO-NAVIGATE WORKFLOW
                                        setPreviewShot(null); // Close Modal [v24 Fix]
                                        setSelectedKeyframe(formattedKeyframe);
                                        window.scrollTo({ top: 0, behavior: 'smooth' });

                                        const debugMsg = `[v12 Success]\n\nBlob Size: ${blob.size} bytes\nInherited From: ${sourceScene.name ? "Yes" : "No"}\nSetting ID: ${newKeyframePayload.setting_id}`;
                                        // alert(debugMsg); // Silence success if valid
                                    }

                                } catch (err) {
                                    console.error("Error generating keyframe:", err);
                                    alert(`Failed [v12]: ${err.message}`);
                                }
                            }}
                        />
                    ) : (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setPreviewShot(null)}>
                            <div className="w-full max-w-4xl bg-black rounded-xl overflow-hidden shadow-2xl relative" onClick={e => e.stopPropagation()}>
                                <video src={previewShot.video_url || previewShot.videoUrl} controls className="w-full h-auto max-h-[80vh]" />
                                <div className="absolute top-4 right-4">
                                    <button onClick={() => setPreviewShot(null)} className="text-white text-2xl font-bold hover:text-gray-300">×</button>
                                </div>
                            </div>
                        </div>
                    )
                )
            }


            {/* Custom Delete Confirmation Modal */}
            {
                clipToDelete && (
                    <div style={{
                        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                        background: "rgba(0,0,0,0.5)", zIndex: 100,
                        display: "flex", alignItems: "center", justifyContent: "center"
                    }} onClick={() => setClipToDelete(null)}>
                        <div onClick={e => e.stopPropagation()} style={{ background: "white", padding: 24, borderRadius: 12, maxWidth: 400, width: "90%", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
                            <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 18, fontWeight: 700, color: "#1F2937" }}>Confirm Deletion</h3>
                            <p style={{ color: "#4B5563", marginBottom: 24, lineHeight: 1.5 }}>
                                Are you sure you want to delete this clip? This action cannot be undone.
                            </p>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                                <button
                                    onClick={() => setClipToDelete(null)}
                                    disabled={isDeleting}
                                    style={{
                                        padding: "8px 16px", borderRadius: 6,
                                        border: "1px solid #D1D5DB", background: "white", color: "#374151",
                                        fontWeight: 600, cursor: isDeleting ? "not-allowed" : "pointer",
                                        opacity: isDeleting ? 0.5 : 1
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmDelete}
                                    disabled={isDeleting}
                                    style={{
                                        padding: "8px 16px", borderRadius: 6,
                                        border: "none", background: "#EF4444", color: "white",
                                        fontWeight: 600, cursor: isDeleting ? "not-allowed" : "pointer",
                                        opacity: isDeleting ? 0.7 : 1
                                    }}
                                >
                                    {isDeleting ? "Deleting..." : "Delete"}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
