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
const prefixId = (id) => (typeof id === 'string' && id.startsWith('saved_')) ? id : `local_${id} `;

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
                setKeyframes(scenesData.map(s => ({
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
                const cleanChars = charactersData.map(c => {
                    const isCorrupted = (val) => typeof val === 'string' && val.includes('?id=eq');
                    return {
                        ...c,
                        voice_id: isCorrupted(c.voice_id) ? "en_us_001" : c.voice_id,
                        voiceId: isCorrupted(c.voiceId) ? "en_us_001" : c.voiceId
                    };
                });
                setCharacters(cleanChars);
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
                setSavedClips(parsedClips);
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
            error: ""
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

    // --- Audio Generation ---
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
                character_id: shot.dialogueBlocks?.[0]?.characterId || shot.characterId || null,
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
                // If it looks like a valid UUID, try to UPDATE, else INSERT
                const isExisting = shot.dbId && shot.dbId.length > 10;

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

                if (isExisting) {
                    console.log("Updating existing clip record:", shot.dbId);
                    dbPayload.id = shot.dbId; // Ensure ID matches
                    const { data, error } = await supabase
                        .from("clips")
                        .update(dbPayload)
                        .eq("id", shot.dbId)
                        .select()
                        .single();

                    if (error) throw error;
                    if (data) finalClip = { ...finalClip, ...data, dialogue_blocks: enrichedBlocks };

                } else {
                    console.log("[saveToBin] Inserting NEW clip record...");
                    const dbId = uuidv4();
                    dbPayload.id = dbId;
                    const { data, error } = await supabase
                        .from("clips")
                        .insert([dbPayload])
                        .select()
                        .single();

                    if (error) {
                        console.error("[saveToBin] INSERT ERROR:", error);
                        throw error;
                    }
                    if (data) {
                        console.log("[saveToBin] INSERT SUCCESS. New ID:", data.id);
                        finalClip = { ...finalClip, ...data, dialogue_blocks: enrichedBlocks };
                    }
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

            const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
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
                    }))
                })
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
            console.log("[renderClip] Step 2: Final Save. Updating ID:", dbId, "with Video URL:", videoUrl);
            // Force status to completed for the DB save
            const finalRecord = await saveToBin({ ...updatedShot, status: 'completed' }, false);
            console.log("[renderClip] Step 2 Result: Success?", !!finalRecord);

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
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
                    {keyframes.map(scene => (
                        <div
                            key={scene.id}
                            className={`relative border rounded-lg overflow-hidden cursor-pointer transition-all min-h-[100px] bg-gray-50 ${selectedKeyframe?.id === scene.id ? 'border-black shadow-md' : 'border-gray-200 hover:border-gray-300'}`}
                            onClick={() => setSelectedKeyframe(scene)}
                        >
                            <img
                                src={scene.image_url || scene.imageUrl || "https://placehold.co/400x300?text=No+Image"}
                                alt={scene.name}
                                className="w-full aspect-[4/3] object-cover bg-gray-200"
                                onError={(e) => { e.target.src = "https://placehold.co/400x300?text=Error"; }}
                            />
                            <div className="p-2 bg-white">
                                <h3 className="font-bold text-gray-800 text-xs truncate">{scene.name || "Untitled"}</h3>
                            </div>
                            {/* Lip-Sync Ready Badge */}
                            {scene.characterId && (scene.cameraLabel === "Standard" || scene.cameraLabel === "Close & Intimate") && (
                                <div className="absolute top-2 right-2 flex items-center gap-1 bg-green-500/90 text-white text-[9px] px-1.5 py-0.5 rounded shadow font-bold z-10 backdrop-blur-sm">
                                    <span>👄</span>
                                    <span>Ready</span>
                                </div>
                            )}
                            {selectedKeyframe?.id === scene.id && (
                                <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20">
                                    <span className="text-white text-2xl">✓</span>
                                </div>
                            )}
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
                                            {shot.status === 'generating' && (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white text-center p-4">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white mb-2"></div>
                                                    <p className="text-sm font-semibold">Generating Audio...</p>
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
                                                            disabled={!(shot.characterId && (shot.cameraLabel === "Standard" || shot.cameraLabel === "Close & Intimate"))}
                                                            className={`flex - 1 md: flex - none px - 3 py - 1 text - [10px] uppercase font - bold rounded flex items - center gap - 1 ${shot.speakerType === "on_screen" ? "bg-black text-white" : "text-gray-400"
                                                                } disabled: opacity - 40 disabled: cursor - not - allowed`}
                                                        >
                                                            Character
                                                            {!(shot.characterId && (shot.cameraLabel === "Standard" || shot.cameraLabel === "Close & Intimate")) && (
                                                                <span className="text-[8px] opacity-70">⛔</span>
                                                            )}
                                                        </button>
                                                        {!(shot.characterId && (shot.cameraLabel === "Standard" || shot.cameraLabel === "Close & Intimate")) && (
                                                            <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-black text-white text-[10px] rounded shadow-lg z-20 pointer-events-none">
                                                                Lip-Sync requires a 'Standard' or 'Close & Intimate' shot with a Character.
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button onClick={() => updateShot(shot.tempId, { speakerType: "narrator" })} className={`flex - 1 md: flex - none px - 3 py - 1 text - [10px] uppercase font - bold rounded ${shot.speakerType === "narrator" ? "bg-black text-white" : "text-gray-400"} `}>Narrator</button>
                                                </div>
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
                                                            <div className="flex gap-2">
                                                                <input
                                                                    type="text"
                                                                    className="flex-1 bg-white border border-gray-200 rounded-lg text-sm px-3 py-2 outline-none"
                                                                    placeholder={inputPlaceholder}
                                                                    value={block.text}
                                                                    onChange={e => updateBlock(shot.tempId, block.id, "text", e.target.value)}
                                                                />
                                                                {shot.dialogueBlocks.length > 1 && (
                                                                    <button onClick={() => removeBlock(shot.tempId, block.id)} className="text-gray-300 hover:text-red-400 px-2">×</button>
                                                                )}
                                                            </div>
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

                                                <div className="flex justify-between items-center mt-2">
                                                    {shot.speakerType === "on_screen" && (
                                                        <button onClick={() => addBlock(shot.tempId)} className="text-[10px] font-bold text-gray-600 hover:underline hover:text-black">+ Add Dialogue Block</button>
                                                    )}
                                                    <button
                                                        onClick={() => generateAllDialogue(shot.tempId, true)}
                                                        disabled={shot.dialogueBlocks.some(b => !b.text || !b.text.trim())}
                                                        className={`ml - auto px - 4 py - 2 text - xs font - bold rounded - lg shadow - sm transition - all ${shot.dialogueBlocks.some(b => !b.text || !b.text.trim())
                                                            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                                            : "bg-black text-white hover:bg-gray-800"
                                                            } `}
                                                    >
                                                        {shot.dialogueBlocks.some(b => b.audioUrl) ? "⚡ Regenerate Dialogue" : "⚡ Generate Dialogue"}
                                                    </button>
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
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
                    {savedClips.map(clip => (
                        <div
                            key={clip.id}
                            onClick={() => setPreviewShot(clip)}
                            style={{
                                border: "1px solid #E2E8F0",
                                borderRadius: 8,
                                overflow: "hidden",
                                background: "#F8FAFC",
                                cursor: "pointer",
                                transition: "transform 0.1s ease-in-out"
                            }}
                            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"}
                            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                            className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden cursor-pointer hover:shadow-sm"
                        >
                            <div className="aspect-video bg-black relative group">
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
                            <div className="p-2">
                                <h4 className="font-bold text-xs text-slate-800 truncate mb-2">{clip.name || "Untitled Clip"}</h4>
                                <div className="flex justify-between items-center gap-2">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleEditClip(clip); }}
                                        className="flex-1 text-[10px] font-bold text-slate-700 border border-slate-200 rounded py-1 hover:bg-slate-50 transition-colors"
                                    >
                                        Modify
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteClip(clip); }}
                                        className="text-[10px] font-bold text-red-500 hover:text-red-600 px-2"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {savedClips.length === 0 && (
                        <div className="col-span-full py-12 text-center text-gray-400 text-sm">
                            No saved clips yet. Create and render a clip to save it here.
                        </div>
                    )}
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
