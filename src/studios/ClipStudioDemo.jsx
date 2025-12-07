import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import ClipCard from "./components/ClipCard";

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

// n8n Webhooks
const TTS_WEBHOOK = "https://n8n.simplifies.click/webhook/generate-voice-preview";
const I2V_WEBHOOK = "https://n8n.simplifies.click/webhook/generate-video-preview";
const LIPSYNC_WEBHOOK = "https://n8n.simplifies.click/webhook/generate-lipsync-preview";

// Helper to prefix IDs for local vs saved items
const prefixId = (id) => (typeof id === 'string' && id.startsWith('saved_')) ? id : `local_${id}`;

export default function ClipStudioDemo() {
    const [scenes, setScenes] = useState([]);
    const [characters, setCharacters] = useState([]);
    const [registryVoices, setRegistryVoices] = useState([]);
    const [selectedScene, setSelectedScene] = useState(null);
    const [shotList, setShotList] = useState([]); // Array of shots being drafted
    const [savedClips, setSavedClips] = useState([]); // Array of saved clips
    const [previewShot, setPreviewShot] = useState(null); // For modal preview

    // --- Data Fetching ---
    useEffect(() => {
        const fetchData = async () => {
            // Load LocalStorage Mock Data first (for demo robustness)
            try {
                const localScenes = JSON.parse(localStorage.getItem("sceneme.scenes") || "[]");
                if (localScenes.length > 0) setScenes(localScenes);
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

            // Fetch scenes from DB
            const { data: scenesData } = await supabase.from('scenes').select('*').order('created_at', { ascending: false });
            if (scenesData) setScenes(scenesData.map(s => ({
                id: s.id,
                name: s.name,
                image_url: s.image_url,
                characterId: s.character_id,
                description: s.prompt
            })));

            // Fetch characters
            const { data: charactersData } = await supabase.from('characters').select('*');
            if (charactersData) setCharacters(charactersData);

            // Fetch saved clips from new table
            const { data: clipsData, error: clipsError } = await supabase.from('clips').select('*').order('created_at', { ascending: false });
            if (clipsError) console.error("Error loading clips:", clipsError);
            if (clipsData) {
                console.log("Loaded clips:", clipsData);
                setSavedClips(clipsData);
            }
        };
        fetchData();
    }, []);

    // --- Shot Management ---
    const addShot = useCallback(() => {
        if (!selectedScene) {
            alert("Please select a scene first.");
            return;
        }
        const newShot = {
            tempId: Date.now(), // Unique ID for local management
            name: "", // Individual Clip Name
            sceneId: selectedScene.id,
            sceneImageUrl: selectedScene.image_url || selectedScene.imageUrl,
            prompt: "",
            motion: "static",
            manualDuration: 3, // Default duration
            dialogueBlocks: [{ id: uuidv4(), characterId: selectedScene.characterId || "", text: "", audioUrl: "", duration: 0, pauseDuration: 0.5, isGenerating: false }],
            speakerType: "on_screen", // Default speaker type
            status: "draft", // draft, generating, preview_ready, completed
            videoUrl: "",
            error: ""
        };
        setShotList(prev => [...prev, newShot]);
    }, [selectedScene]);

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
                    voice_id: "en_us_001",
                    pause_duration: block.pauseDuration || 0.5
                };

                if (char) {
                    turn.speaker = char.name;
                    // Supabase snake_case keys
                    const voiceId = char.voice_id || char.voiceId;
                    const voiceRefUrl = char.voice_ref_url || char.voiceRefUrl;

                    if (voiceId === "recording" && voiceRefUrl) {
                        turn.ref_audio_urls = [voiceRefUrl];
                        delete turn.voice_id; // Omit voice_id for clones
                    } else {
                        turn.voice_id = voiceId;
                    }
                } else if (narrator) {
                    turn.speaker = "Narrator";
                    turn.voice_id = narrator.id;
                }

                return turn;
            });

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
            updateShot(shotTempId, { status: "draft", error: `Generation Failed: ${err.message}` });
        }
    }, [shotList, updateShot, characters, registryVoices]);

    // --- Video Rendering ---
    // --- Video Rendering ---
    const renderClip = useCallback(async (shot) => {
        updateShot(shot.tempId, { status: "rendering", error: "" });

        const webhookUrl = shot.speakerType === "on_screen" ? LIPSYNC_WEBHOOK : I2V_WEBHOOK;

        try {
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
                    prompt: shot.prompt,
                    image_url: shot.sceneImageUrl,
                    audio_url: shot.stitchedAudioUrl,
                    motion: shot.motion || "static",
                    num_frames: numFrames, // Explicit frame count for I2V
                    // Passing dialogue structure in case backend supports multi-speaker face mapping
                    dialogue: shot.dialogueBlocks.map(b => ({
                        speaker_id: b.characterId,
                        text: b.text
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

            updateShot(shot.tempId, {
                videoUrl: videoUrl,
                status: "preview_ready",
                manualDuration: shot.isAudioLocked ? shot.totalAudioDuration : shot.manualDuration
            });

        } catch (err) {
            console.error("Render Error:", err);
            updateShot(shot.tempId, { status: "draft", error: `Rendering failed: ${err.message}` });
        }
    }, [updateShot]);

    // --- Save to Bin ---
    const saveToBin = useCallback(async (shot) => {
        // Use totalAudioDuration if locked, ensuring we capture the full stitched length + delay
        const finalDuration = shot.isAudioLocked
            ? ((shot.totalAudioDuration || 0) + (shot.startDelay || 0))
            : shot.manualDuration;

        // Enrich dialogue blocks with names for the "Script" view
        const enrichedBlocks = shot.dialogueBlocks.map(b => {
            const char = characters.find(c => c.id === b.characterId);
            const regVoice = registryVoices.find(v => v.id === b.characterId);
            return {
                ...b,
                characterName: char?.name || regVoice?.name || "Unknown Speaker"
            };
        });

        // Optimistic / Demo Save
        const newClip = {
            id: shot.id || `saved_${Date.now()}`,
            name: shot.name?.trim() || `Untitled Clip ${savedClips.length + 1}`,
            scene_id: shot.sceneId || selectedScene.id,
            character_id: shot.dialogueBlocks[0]?.characterId,
            shot_type: (shot.speakerType === "on_screen") ? "lipsync" : "cinematic",
            speaker_type: shot.speakerType,
            video_url: shot.videoUrl,
            thumbnail_url: shot.sceneImageUrl || selectedScene.image_url || selectedScene.imageUrl,
            prompt: shot.prompt,
            duration: finalDuration,
            motion_type: shot.motion,
            dialogue_blocks: enrichedBlocks, // Use enriched blocks
            status: "completed",
            created_at: new Date().toISOString()
        };

        if (supabase) {
            const dbId = uuidv4();
            const dbPayload = {
                ...newClip,
                id: dbId,
                created_at: new Date().toISOString(),
                stitched_audio_url: shot.stitchedAudioUrl,
                start_delay: shot.startDelay,
                dialogue_blocks: enrichedBlocks // Explicitly ensure this snake_case key has data
            };

            const { data, error } = await supabase.from("clips").insert([dbPayload]).select().single();

            if (error) {
                console.error("Supabase Save Error:", error);
                alert(`Failed to save to 'clips' table: ${error.message} (Code: ${error.code})`);
            } else if (data) {
                Object.assign(newClip, data);
            }
        }

        setSavedClips(prev => [newClip, ...prev]);
        removeShot(shot.tempId);
        setPreviewShot(null);
        setSelectedScene(null);
    }, [updateShot, removeShot, selectedScene, savedClips.length]);

    // DELETE LOGIC
    const handleDeleteClip = async (clip) => {
        const newSaved = savedClips.filter(c => c.id !== clip.id);
        setSavedClips(newSaved);

        if (supabase && clip.id && !String(clip.id).startsWith("saved_")) {
            await supabase.from("shots").delete().eq("id", clip.id);
        }
    };

    // EDIT LOGIC
    const handleEditClip = (clip) => {
        // Restore clip data to "workshop" (Story Studio context)
        if (!selectedScene) {
            const scene = scenes.find(s => s.id === clip.scene_id);
            if (scene) setSelectedScene(scene);
        }

        const restoredShot = {
            id: `restored_${Date.now()}`,
            tempId: Date.now(),
            name: clip.name ? `${clip.name} (Remix)` : "", // Auto-append Remix
            sceneId: clip.scene_id,
            sceneImageUrl: clip.thumbnail_url,
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

        setShotList(prev => [...prev, restoredShot]);
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
                <p className="text-gray-500 text-sm">Create standard video clips with dialogue and motion.</p>
            </div>

            {/* SCENE SELECTION */}
            <section className="mb-12">
                <h2 className="text-base font-bold text-gray-800 mb-4">1. Select a Scene</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
                    {scenes.map(scene => (
                        <div
                            key={scene.id}
                            className={`relative border rounded-lg overflow-hidden cursor-pointer transition-all ${selectedScene?.id === scene.id ? 'border-black shadow-md' : 'border-gray-200 hover:border-gray-300'}`}
                            onClick={() => setSelectedScene(scene)}
                        >
                            <img src={scene.image_url || scene.imageUrl} alt={scene.name} className="w-full aspect-[4/3] object-cover" />
                            <div className="p-2 bg-white">
                                <h3 className="font-bold text-gray-800 text-xs truncate">{scene.name}</h3>
                            </div>
                            {selectedScene?.id === scene.id && (
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
                    disabled={!selectedScene}
                >
                    + Add New Clip
                </button>
            </section>

            {/* SHOT WORKSHOP */}
            <section className="mb-12">
                <h2 className="text-base font-bold text-gray-800 mb-4">2. Clip Workshop</h2>
                <div className="flex flex-col gap-6">
                    {shotList.length === 0 && (
                        <div className="text-center py-12 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
                            No shots in workshop. Select a scene and click "Add New Shot" to begin.
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
                                                    <video src={shot.videoUrl} className="w-full h-full object-cover" />
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
                                            <div className="flex justify-between items-center mb-4">
                                                <div className="flex items-center gap-4">
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

                                                <div className="flex bg-white rounded-md border border-gray-200 p-0.5">
                                                    <button onClick={() => updateShot(shot.tempId, { speakerType: "on_screen" })} className={`px-3 py-1 text-[10px] uppercase font-bold rounded ${shot.speakerType === "on_screen" ? "bg-black text-white" : "text-gray-400"}`}>On Screen</button>
                                                    <button onClick={() => updateShot(shot.tempId, { speakerType: "narrator" })} className={`px-3 py-1 text-[10px] uppercase font-bold rounded ${shot.speakerType === "narrator" ? "bg-black text-white" : "text-gray-400"}`}>Narrator</button>
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
                                                        className={`ml-auto px-4 py-2 text-xs font-bold rounded-lg shadow-sm transition-all ${shot.dialogueBlocks.some(b => !b.text || !b.text.trim())
                                                            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                                            : "bg-black text-white hover:bg-gray-800"
                                                            }`}
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
                <h3 className="text-base font-bold mb-6">Saved Clips</h3>
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
                            <div className="aspect-video bg-black relative">
                                <video src={clip.video_url} className="w-full h-full object-cover" />
                                <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1 rounded">
                                    {clip.duration}s
                                </div>
                            </div>
                            <div style={{ padding: 10 }}>
                                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#0F172A" }}>
                                    {clip.name || "Untitled Clip"}
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleEditClip(clip); }}
                                        style={{ fontSize: 11, color: "#000", background: "none", border: "1px solid #E2E8F0", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}
                                    >
                                        Modify
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteClip(clip); }}
                                        style={{ fontSize: 11, color: "#EF4444", background: "none", border: "none", cursor: "pointer", padding: 0 }}
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
            {previewShot && (
                previewShot.status === 'completed' || (String(previewShot.id).startsWith("saved_") || previewShot.created_at) ? (
                    <ClipCard
                        clip={previewShot}
                        onClose={() => setPreviewShot(null)}
                        onEdit={handleEditClip}
                        onDelete={handleDeleteClip}
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
            )}
        </div>
    );
}
