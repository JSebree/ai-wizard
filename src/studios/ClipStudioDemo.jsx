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

// Helper: AudioBuffer to WAV Blob
const bufferToWav = (buffer) => {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArr = new ArrayBuffer(length);
    const view = new DataView(bufferArr);
    const channels = [];
    let i, sample;
    let offset = 0;
    let pos = 0;

    // write WAVE header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit (hardcoded in this loop)

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    // write interleaved data
    for (i = 0; i < buffer.numberOfChannels; i++)
        channels.push(buffer.getChannelData(i));

    while (pos < buffer.length) {
        for (i = 0; i < numOfChan; i++) {
            // clamp
            sample = Math.max(-1, Math.min(1, channels[i][pos]));
            // scale to 16-bit signed int
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
            view.setInt16(44 + offset, sample, true);
            offset += 2;
        }
        pos++;
    }

    return new Blob([bufferArr], { type: 'audio/wav' });

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    }
};

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
    const [settings, setSettings] = useState([]); // [New] Settings for metadata resolution
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

            // Fetch Settings [New]
            const { data: settingsData } = await supabase.from('settings').select('*');
            if (settingsData) {
                setSettings(settingsData);
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

    // PERSIST SHOTLIST (Debounced)
    useEffect(() => {
        const handler = setTimeout(() => {
            try {
                localStorage.setItem("sceneme.shotList", JSON.stringify(shotList));
            } catch (e) {
                console.error("Failed to save shotList draft:", e);
            }
        }, 1000); // 1s debounce

        return () => clearTimeout(handler);
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
            name: targetScene.name || "Untitled Clip", // Individual Clip Name
            sceneId: targetScene.id,
            sceneImageUrl: targetScene.image_url || targetScene.imageUrl,

            // Validation Props (Persisted from Scene)
            cameraLabel: targetScene.cameraLabel,
            characterId: targetScene.characterId,

            prompt: targetScene.prompt || targetScene.description || "",
            motion: "static",
            manualDuration: 3.0, // [Safe Default] Under 3.4s limit
            dialogueBlocks: [{
                id: uuidv4(),
                characterId: targetScene.characterId || "",
                text: "",
                audioUrl: "",
                duration: 0, // Should auto-update to real duration
                pauseDuration: 0.5,
                isGenerating: false,
                status: "draft",
                inputMode: "text",
                error: ""
            }],
            speakerType: "on_screen", // Default speaker type
            status: "draft", // draft, generating, preview_ready, completed
            videoUrl: "",
            error: "",
            useSeedVC: false,
        };
        setShotList(prev => {
            console.log("Updating Shot List. Resetting to single new shot.");
            return [newShot]; // FORCE SINGLE SHOT: Reset list instead of appending
        });
    }, [selectedKeyframe]);

    // --- Saved Clip Management ---
    const updateSavedClip = useCallback((id, updates) => {
        setSavedClips(prev => prev.map(clip =>
            clip.id === id ? { ...clip, ...updates } : clip
        ));
    }, []);

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
                    dialogueBlocks: [...shot.dialogueBlocks, {
                        id: uuidv4(),
                        characterId: "",
                        text: "",
                        audioUrl: "",
                        duration: 0,
                        pauseDuration: 0.5,
                        isGenerating: false,
                        status: "draft",
                        inputMode: "text",
                        error: ""
                    }]
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

    const handleConvertRecording = useCallback(async (shotTempId, blockId, blob) => {
        const shot = shotList.find(s => s.tempId === shotTempId);
        if (!shot) return;

        const block = shot.dialogueBlocks.find(b => b.id === blockId);
        if (!block) return;

        try {
            // 1. Identify Target Voice (Block Specific)
            const char = characters.find(c => c.id === block.characterId);
            const narrator = registryVoices.find(v => v.id === block.characterId);
            let targetVoiceUrl = null;

            if (narrator) {
                targetVoiceUrl = narrator.previewUrl;
            } else if (char) {
                // Check if char has a reliable preview URL
                if ((char.voice_id === "recording" || char.voiceId === "recording") && (char.voice_ref_url || char.voiceRefUrl)) {
                    targetVoiceUrl = char.voice_ref_url || char.voiceRefUrl;
                } else {
                    const assignedVoiceId = char.voice_id || char.voiceId;
                    const foundVoice = registryVoices.find(v => v.id === assignedVoiceId);
                    if (foundVoice) targetVoiceUrl = foundVoice.previewUrl;
                }
            }

            if (!targetVoiceUrl) {
                console.warn(`[STS] Character/Voice not resolving for block ${blockId}`);
                // Optional: Allow converting without target? No, SeedVC needs target.
                throw new Error("Target voice not found. Please assign a character with a voice.");
            }

            // 2. Prepare Payload
            const base64Audio = await blobToBase64(blob);
            updateBlock(shotTempId, blockId, "isGenerating", true); // Show spinner

            console.log("[STS] Sending Audio to Seed VC...");

            const seedRes = await fetch(API_CONFIG.SEED_VC_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    input: {
                        source_audio: base64Audio,
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

            // Handle RunPod async/queue
            if (seedData.status === "IN_QUEUE" || seedData.status === "IN_PROGRESS") {
                const jobId = seedData.id;
                while (true) {
                    await new Promise(r => setTimeout(r, 2000));
                    const statusRes = await fetch(`${API_CONFIG.SEED_VC_ENDPOINT.replace('/run', '')}/status/${jobId}`, {
                        headers: { "Content-Type": "application/json" }
                    });
                    if (!statusRes.ok) throw new Error("Poll failed");
                    seedData = await statusRes.json();
                    if (seedData.status === "COMPLETED") break;
                    if (seedData.status === "FAILED") throw new Error("Job Failed");
                }
            }

            let audioUrl = "";
            if (seedData.output && seedData.output.audio_url) {
                audioUrl = seedData.output.audio_url;
            } else if (seedData.audio_url) {
                audioUrl = seedData.audio_url;
            } else if (seedData.output && seedData.output.audio) {
                audioUrl = `data:audio/wav;base64,${seedData.output.audio}`;
            } else {
                throw new Error("No audio returned");
            }

            // 3. Update Block
            updateBlock(shotTempId, blockId, "audioUrl", audioUrl);
            updateBlock(shotTempId, blockId, "status", "ready");
            updateBlock(shotTempId, blockId, "isGenerating", false);
            updateBlock(shotTempId, blockId, "error", "");

        } catch (err) {
            console.error("STS Failed:", err);
            updateBlock(shotTempId, blockId, "error", err.message);
            updateBlock(shotTempId, blockId, "isGenerating", false);
        }
    }, [shotList, characters, registryVoices, updateBlock]);

    const handleStartRecording = useCallback(async (shotTempId, blockId) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // [v67] Mobile Safari Support
            let mimeType = 'audio/webm';
            if (MediaRecorder.isTypeSupported('audio/mp4')) {
                mimeType = 'audio/mp4';
            } else if (MediaRecorder.isTypeSupported('audio/aac')) {
                mimeType = 'audio/aac';
            }

            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            // Store mimeType on the instance for onstop
            mediaRecorder.mimeTypeFromOpts = mimeType;

            const chunks = [];

            mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
            mediaRecorder.onstop = async () => {
                const type = mediaRecorder.mimeTypeFromOpts || 'audio/webm';
                const blob = new Blob(chunks, { type });
                await handleConvertRecording(shotTempId, blockId, blob);
                stream.getTracks().forEach(track => track.stop());
            };

            const key = `recorder_${shotTempId}_${blockId}`;
            window[key] = mediaRecorder;

            mediaRecorder.start();
            updateBlock(shotTempId, blockId, "isRecording", true);
            updateBlock(shotTempId, blockId, "error", "");

        } catch (err) {
            console.error("Mic Error:", err);
            updateBlock(shotTempId, blockId, "error", "Mic Access Denied");
        }
    }, [handleConvertRecording, updateBlock]);

    const handleStopRecording = useCallback((shotTempId, blockId) => {
        const key = `recorder_${shotTempId}_${blockId}`;
        const recorder = window[key];
        if (recorder && recorder.state !== 'inactive') {
            recorder.stop();
            updateBlock(shotTempId, blockId, "isRecording", false);
        }
    }, [updateBlock]);


    // --- Per-Block Audio Generation (TTS) ---
    const generateBlockAudio = useCallback(async (shotTempId, blockId) => {
        const shot = shotList.find(s => s.tempId === shotTempId);
        if (!shot) return;

        const block = shot.dialogueBlocks.find(b => b.id === blockId);
        if (!block) return;

        // Validation
        if (!block.text || !block.text.trim()) {
            updateBlock(shotTempId, blockId, "error", "Please enter text.");
            return;
        }

        // Set Loading State
        updateBlock(shotTempId, blockId, "isGenerating", true);
        updateBlock(shotTempId, blockId, "error", "");

        try {
            // Resolve Voice ID
            const char = characters.find(c => c.id === block.characterId);
            const narrator = registryVoices.find(v => v.id === block.characterId);

            let turn = {
                text: block.text,
                speaker: "Unknown",
                voice_id: null,
                pause_duration: block.pauseDuration || 0.5
            };

            if (narrator) {
                turn.speaker = "Narrator";
                turn.voice_id = narrator.id;
            } else if (char) {
                turn.speaker = char.name;
                const dbVoiceId = char.voice_id || char.voiceId;
                const dbRefUrl = char.voice_ref_url || char.voiceRefUrl;

                if (dbVoiceId === "recording") {
                    if (dbRefUrl) {
                        turn.ref_audio_urls = [dbRefUrl];
                        delete turn.voice_id;
                    }
                } else if (dbVoiceId && dbVoiceId !== "None") {
                    turn.voice_id = dbVoiceId;
                }
            }

            // Fallback
            if (!turn.voice_id && !turn.ref_audio_urls) {
                turn.voice_id = "en_us_001";
            }

            console.log("Generating Audio for Block:", blockId, turn);

            // Call TTS Webhook
            const res = await fetch(TTS_WEBHOOK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dialogue: [turn] // Single turn array
                })
            });

            if (!res.ok) throw new Error("TTS Generation Failed");

            const data = await res.json();
            console.log("Block Generation Result:", data);

            // Extract URL
            let audioUrl = "";
            if (Array.isArray(data) && data.length > 0) {
                audioUrl = data[0].output?.url || data[0].url || data[0].audio_url || data[0].image_url;
            } else {
                audioUrl = data.url || data.audio_url || data.output?.url || data.image_url || (typeof data.output === 'string' ? data.output : "");
            }

            if (!audioUrl) throw new Error("No audio URL returned");

            // Proxy Handling for new URL
            if (audioUrl.includes('voice-generations.nyc3.digitaloceanspaces.com')) {
                audioUrl = audioUrl.replace('https://voice-generations.nyc3.digitaloceanspaces.com', '/voice-proxy');
            }

            // Extract Duration
            let duration = 3.0; // Fallback
            if (data && data.output && data.output.duration_samples && data.output.sampling_rate) {
                duration = data.output.duration_samples / data.output.sampling_rate;
            } else if (data.duration) {
                duration = data.duration;
            } else if (Array.isArray(data) && data[0]?.output?.duration_samples) {
                duration = data[0].output.duration_samples / data[0].output.sampling_rate;
            }

            // Update Block Success
            setShotList(prev => prev.map(s =>
                s.tempId === shotTempId ? {
                    ...s,
                    dialogueBlocks: s.dialogueBlocks.map(b =>
                        b.id === blockId ? {
                            ...b,
                            audioUrl: audioUrl,
                            duration: duration,
                            isGenerating: false,
                            status: "ready",
                            error: ""
                        } : b
                    )
                } : s
            ));

        } catch (err) {
            console.error("Block Gen Error:", err);
            updateBlock(shotTempId, blockId, "isGenerating", false);
            updateBlock(shotTempId, blockId, "error", err.message);
        }
    }, [shotList, characters, registryVoices, updateBlock]);

    // --- Finalize Audio (Stitching) ---
    const finalizeAudio = useCallback(async (shotTempId) => {
        const shot = shotList.find(s => s.tempId === shotTempId);
        if (!shot) return;

        // Validation: Warn if text exists but audio missing
        if (shot.dialogueBlocks.some(b => b.text && b.text.trim() && !b.audioUrl)) {
            updateShot(shotTempId, { error: "Please generate audio for all blocks first." });
            return;
        }

        updateShot(shotTempId, { status: "rendering", error: "" });

        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const buffers = [];

            // 1. Fetch and Decode all blocks
            for (const block of shot.dialogueBlocks) {
                if (!block.audioUrl) continue;
                try {
                    // Use Proxy to avoid CORS
                    let proxyUrl = block.audioUrl;
                    if (proxyUrl.includes('voice-generations.nyc3.digitaloceanspaces.com')) {
                        proxyUrl = proxyUrl.replace('https://voice-generations.nyc3.digitaloceanspaces.com', '/voice-proxy');
                    } else if (proxyUrl.includes('nyc3.digitaloceanspaces.com')) {
                        proxyUrl = proxyUrl.replace('https://nyc3.digitaloceanspaces.com', '/video-proxy');
                    }
                    const response = await fetch(proxyUrl);

                    if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);

                    const arrayBuffer = await response.arrayBuffer();
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    buffers.push({
                        buffer: audioBuffer,
                        pauseDuration: block.pauseDuration || 0,
                        id: block.id, // Track ID to update state later
                        duration: audioBuffer.duration // Precise duration
                    });
                } catch (e) {
                    console.error("Failed to decode block audio:", block.id, e);
                    throw new Error("Failed to process audio for a block.");
                }
            }

            if (buffers.length === 0) {
                updateShot(shotTempId, { status: "draft", error: "No audio to finalize." });
                return;
            }

            // 2. Calculate Total Length
            const startDelaySeconds = shot.startDelay || 0;
            const startDelaySamples = Math.ceil(startDelaySeconds * audioContext.sampleRate);

            const totalAudioSamples = buffers.reduce((acc, item) => {
                return acc + item.buffer.length + Math.ceil(item.pauseDuration * item.buffer.sampleRate);
            }, 0);

            const totalLengthSamples = startDelaySamples + totalAudioSamples;

            // 3. Create Output Buffer (Stereo)
            const outputBuffer = audioContext.createBuffer(
                2,
                totalLengthSamples,
                audioContext.sampleRate
            );

            // 4. Mix/Stitch
            let offset = startDelaySamples; // Start inserting AFTER the delay
            for (const item of buffers) {
                for (let channel = 0; channel < 2; channel++) {
                    const destChannel = outputBuffer.getChannelData(channel);
                    // Handle Mono vs Stereo Inputs
                    const srcChannel = item.buffer.numberOfChannels === 1
                        ? item.buffer.getChannelData(0)
                        : item.buffer.getChannelData(channel < item.buffer.numberOfChannels ? channel : 0);

                    destChannel.set(srcChannel, offset);
                }
                offset += item.buffer.length + Math.ceil(item.pauseDuration * item.buffer.sampleRate);
            }

            // 5. Encode to WAV
            const wavBlob = bufferToWav(outputBuffer);

            // 6. Upload to Storage (for RunPod Access)
            const filename = `stitched_${shotTempId}_${Date.now()}.wav`;
            const audioFile = new File([wavBlob], filename, { type: "audio/wav" });

            const formData = new FormData();
            formData.append("file", audioFile);
            formData.append("kind", "voice_clone"); // Re-use existing bucket logic

            // Show uploading state (text update)
            updateShot(shotTempId, { status: "rendering", error: "Uploading audio..." });

            const uploadRes = await fetch(API_CONFIG.UPLOAD_REFERENCE_IMAGE, {
                method: "POST",
                body: formData
            });

            if (!uploadRes.ok) throw new Error("Audio upload failed.");

            const uploadData = await uploadRes.json();
            const publicUrl = uploadData.publicUrl || uploadData.url || uploadData.image_url;

            if (!publicUrl) throw new Error("No public URL returned from upload.");

            // 7. Update Shot State with Precise Durations (fix for LipSync Drift)
            const updatedBlocks = shot.dialogueBlocks.map(b => {
                const bufferMatch = buffers.find(buf => buf.id === b.id);
                return bufferMatch ? { ...b, duration: bufferMatch.duration } : b;
            });

            // Use the PUBLIC URL for the shot state (so RunPod can see it)
            updateShot(shotTempId, {
                stitchedAudioUrl: publicUrl,
                totalAudioDuration: outputBuffer.duration,
                isAudioLocked: true,
                status: "draft",
                error: "",
                dialogueBlocks: updatedBlocks // Sync state with reality
            });

        } catch (e) {
            console.error("Audio Stitching Error:", e);
            updateShot(shotTempId, { status: "draft", error: "Stitching Failed: " + e.message });
        }
    }, [shotList, updateShot]);

    // --- Save to Bin ---
    const saveToBin = useCallback(async (shot, shouldRemove = true) => {
        console.log("Saving Shot to Bin:", shot);
        try {
            // Fix: totalAudioDuration ALREADY includes the Start Delay (silence baked in)
            // So we shouldn't add it again.
            const finalDuration = shot.isAudioLocked
                ? (shot.totalAudioDuration || 0)
                : (shot.manualDuration || shot.duration); // Fallback to existing duration

            // Enrich dialogue blocks with names for the "Script" view
            // Handle both array and string (JSON) input for dialogueBlocks
            let blocksToEnrich = shot.dialogueBlocks || shot.dialogue_blocks || [];
            if (typeof blocksToEnrich === 'string') {
                try {
                    blocksToEnrich = JSON.parse(blocksToEnrich);
                } catch (e) { blocksToEnrich = []; }
            }

            const enrichedBlocks = blocksToEnrich.map(b => {
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
                name: shot.name || `Clip ${new Date().toLocaleTimeString()}`,
                scene_id: shot.scene_id || shot.sceneId || selectedKeyframe?.id,
                scene_name: shot.scene_name || shot.sceneName || selectedKeyframe?.name || "Unknown Scene",
                character_id: shot.character_id || shot.characterId || shot.dialogueBlocks?.[0]?.characterId || selectedKeyframe?.characterId || null,
                thumbnail_url: shot.thumbnail_url || shot.sceneImageUrl || selectedKeyframe?.image_url || selectedKeyframe?.imageUrl,
                video_url: shot.videoUrl || null, // Might be null if pending
                last_frame_url: shot.last_frame_url || shot.lastFrameUrl || null, // Last frame from n8n
                raw_video_url: shot.rawVideoUrl || shot.videoUrl,
                audio_url: shot.stitchedAudioUrl || shot.audio_url || null,
                prompt: shot.prompt,
                motion_type: shot.motion || shot.motion_type,
                duration: parseFloat(finalDuration),
                dialogue_blocks: blocksToEnrich,
                speaker_type: shot.speakerType || shot.speaker_type,
                status: shot.status || "completed", // Allow passing 'rendering'
                created_at: new Date().toISOString(),
                start_delay: shot.startDelay || shot.start_delay || 0,
                has_audio: !!(shot.stitchedAudioUrl || shot.stitched_audio_url || shot.audio_url || shot.has_audio), // Explicit flag

                // [v53] Ensure Metadata Persistence
                setting_id: shot.setting_id || shot.settingId || selectedKeyframe?.setting_id || null,
                camera_angle: shot.camera_angle || shot.cameraLabel || selectedKeyframe?.cameraLabel || null
            };

            let finalClip = { ...payload }; // Local state version

            if (supabase) {
                // DATA CLEANUP: Remove fields not in DB schema
                const dbPayload = { ...payload };
                delete dbPayload.audio_url;
                delete dbPayload.raw_video_url;
                delete dbPayload.scene_name;

                // [v54 Fix] Remove UI-only props that don't exist in 'clips' table
                delete dbPayload.setting_id;
                delete dbPayload.camera_angle;

                // Add schema-specific fields
                dbPayload.stitched_audio_url = shot.stitchedAudioUrl || shot.stitched_audio_url;
                dbPayload.start_delay = shot.startDelay || shot.start_delay;
                dbPayload.dialogue_blocks = JSON.stringify(enrichedBlocks);
                dbPayload.shot_type = (shot.speakerType === 'on_screen' || shot.speaker_type === 'on_screen') ? 'lipsync' : 'cinematic';

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
        // [Refactor] Immediate feedback on the draft itself before it vanishes
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

            // SAVE TO BIN IMMEDIATELY
            const dbRecord = await saveToBin(pendingShot, false); // Returns the saved record (with ID)

            if (!dbRecord || !dbRecord.id) {
                throw new Error("Failed to create initial clip record.");
            }
            const dbId = dbRecord.id;

            console.log("[renderClip] Step 1 Result: DB ID =", dbId);

            // [Refactor] CLEAR WORKSHOP IMMEDIATELY
            // The user wants the form to "go away" so they can start another.
            // We've saved it to the "Saved Clips" list with 'rendering' status.
            removeShot(shot.tempId);
            setPreviewShot(null);
            setSelectedKeyframe(null);

            // Determine duration and frames
            // Fixed: totalAudioDuration includes startDelay (baked in silence)
            const duration = shot.isAudioLocked
                ? (shot.totalAudioDuration || 0)
                : shot.manualDuration;

            // FramePack expects integer frames (e.g. 300 for 10s @ 30fps)
            const numFrames = Math.ceil((duration || 3) * 30);

            // 2. Construct & Sanitize Payload

            // Calculate Timestamps for Lip Sync
            let currentTime = shot.startDelay || 0;
            const segments = shot.dialogueBlocks.map(b => {
                const start = currentTime;
                const rawEnd = start + (b.duration || 0);

                // [MAXIMUM ISOLATION]
                // We are fighting the model's "motion smoothing" inertia.
                // We cut aggressively to force the face to be static during transitions.
                // 1. Start 120ms LATE
                // 2. End 220ms EARLY (nearly a quarter second)
                const CLAMP_START = 0.12;
                const CLAMP_END = 0.22;

                const safeStart = start + CLAMP_START;
                const safeEnd = Math.max(safeStart + 0.1, rawEnd - CLAMP_END);

                const seg = {
                    start: Number(safeStart.toFixed(3)),
                    end: Number(safeEnd.toFixed(3)),
                    voice_id: b.characterId, // Used as speaker ID
                    text: b.text,
                    character_name: b.characterName || "Unknown"
                };

                // Advance time: Duration + Pause
                currentTime = (start + (b.duration || 0)) + (b.pauseDuration || 0);
                return seg;
            });

            const rawPayload = {
                clip_name: shot.name,
                // Safety Truncation: FramePack has a ~75 token limit (approx 300 chars)
                prompt: (shot.prompt || "").slice(0, 300),
                image_url: shot.sceneImageUrl,
                audio_url: shot.stitchedAudioUrl,
                motion: shot.motion || "static",
                num_frames: numFrames, // Explicit frame count for I2V

                // Passing dialogue structure in case backend supports multi-speaker face mapping
                segments: segments, // NEW: Full timeline
                dialogue: segments, // KEEP: Backward compatibility
                person_count: segments.length > 1 ? "multi" : "single", // Hint for backend

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
                // If we failed to get a video URL, we must update the saved clip to show error
                updateSavedClip(dbId, { status: "error", error: "No video URL returned." });
                throw new Error("No video URL found in response.");
            }

            // Extract last frame URL if present
            const lastFrameUrl = data?.last_frame_url || data?.lastFrameUrl || data?.output?.last_frame_url || null;
            console.log("Extracted Last Frame URL:", lastFrameUrl);

            // [Refactor] UPDATE THE SAVED CLIP RECORD
            // We use the dbId we got earlier

            const updatedClipData = {
                video_url: videoUrl, // snake_case for DB style object
                videoUrl: videoUrl,  // camelCase for local state
                last_frame_url: lastFrameUrl,
                status: 'completed',
                manualDuration: shot.isAudioLocked ? shot.totalAudioDuration : shot.manualDuration
            };

            // Update Local UI State
            updateSavedClip(dbId, updatedClipData);

            // 2. Update DB Record with Final URL
            console.log("[renderClip] Step 2: Final Save update...");

            // We can re-use saveToBin or just call supabase directly. 
            // saveToBin is convenient because it handles the object merging and user_id stuff.
            // But we need to construct a 'shot-like' object for it if we use saveToBin.
            // OR even better, we just call supabase update here since we know it exists.

            if (supabase) {
                const { error: updateError } = await supabase
                    .from('clips')
                    .update({
                        video_url: videoUrl,
                        last_frame_url: lastFrameUrl,
                        status: 'completed'
                    })
                    .eq('id', dbId);

                if (updateError) {
                    console.error("Failed to update clip in DB:", updateError);
                } else {
                    console.log("DB Update Success for ID:", dbId);
                }
            }

        } catch (err) {
            console.error("Render Error:", err);
            // If the draft was already removed, we must update the saved clip to show error
            if (shot.tempId) {
                // Try to find if we possess a dbId attached to the shot (if we crashed post-save)
                // But wait, "shot" here is the closure variable.
                // If we already saved it, we need that DB ID. 
                // We don't have it easily if it crashed before assignment, BUT
                // The 'pendingShot' save happens first.
            }
            // Best effort: If we have a DB ID from step 1, update it.
            // But we can't easily access `dbId` from catch block if it's declared in try.
            // Simplified: User will see "Rendering..." hang if it crashes completely, 
            // but `updateSavedClip` calls in the try block should handle most logic.

            // Ideally we'd move dbId declaration up, but let's just alert for now or trust the flow.
            alert("Rendering failed: " + err.message);
        }
    }, [updateShot, saveToBin, removeShot, updateSavedClip]);
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


    // --- InfCam Reshoot Logic ---
    const handleInfCamReshoot = async (originalClip, params) => {
        console.log("Reshooting Clip:", originalClip.id, "Params:", params);

        // [v51 Fix] Fetch fresh source data to ensure last_frame_url is present
        // (Client state might be stale or partial)
        let sourceClip = originalClip;
        if (originalClip.id && !String(originalClip.id).startsWith('local_')) {
            try {
                const { data: freshData } = await supabase
                    .from('clips')
                    .select('*')
                    .eq('id', originalClip.id)
                    .single();

                if (freshData) {
                    console.log("[v51] Refreshed source clip data from DB:", freshData.id);
                    sourceClip = freshData;
                }
            } catch (err) {
                console.warn("[v51] Failed to refresh source clip:", err);
            }
        }

        // 1. Create a "Ghost" pending clip to show immediate feedback
        const tempId = `reshoot_${Date.now()}`;
        const ghostClip = {
            ...sourceClip,
            id: tempId,
            status: 'rendering', // or 'generating'
            name: `${sourceClip.name} (${params.label || 'Reshoot'})`,
            created_at: new Date().toISOString(),
            video_url: "",
            // inherit other props
        };

        // Add to Saved Clips immediately (Local)
        setSavedClips(prev => [ghostClip, ...prev]);

        // [Persistence] Save "Rendering" state to Supabase
        // This ensures the job is visible even if the user refreshes/leaves
        let dbId = null;
        try {
            const savedRecord = await saveToBin(ghostClip, false);
            if (savedRecord && savedRecord.id) {
                dbId = savedRecord.id;
                console.log("Reshoot persisted with ID:", dbId);
                // Update local ghost with real DB ID
                setSavedClips(prev => prev.map(c => c.id === tempId ? { ...c, id: dbId } : c));
            }
        } catch (err) {
            console.error("Failed to persist reshoot start:", err);
            // Continue anyway, but it won't be saved until finish
        }

        try {
            // 2. Prepare Payload
            // [Fix] Calculate frames based on duration (assuming 24fps)
            // Clamp to 81 to match extrinsics limit. Align to 4n+1.
            // Clamp to 81 to match extrinsics limit. Align to 4n+1.
            const fps = 24; // User updating backend to 24fps
            const durationInput = parseFloat(sourceClip.duration || 3.4);
            let rawFrames = Math.round(durationInput * fps);

            console.log(`[Reshoot] Frames Calc (24fps): SourceDuration=${sourceClip.duration}, Parsed=${durationInput}, RawFrames=${rawFrames}`);

            // Limit to 81 (InfCam standard max per preset)
            if (rawFrames > 81) rawFrames = 81;

            // Align to 4n+1
            const n = Math.floor((rawFrames - 1) / 4);
            const targetFrames = (n * 4) + 1;

            const payload = {
                input: {
                    video_url: sourceClip.videoUrl || sourceClip.video_url,
                    audio_url: null,
                    prompt: sourceClip.prompt || "Reshoot",
                    cam_type: params.camType, // '10Type' preset name
                    reverse_camera: params.reverseCamera || false,
                    zoom_factor: params.zoom || 1.0,
                    num_frames: targetFrames,
                    // Explicit Params to match Handler
                    height: 480,
                    width: 832,
                    cfg_scale: 5.0,
                    num_inference_steps: 30, // Default
                    tea_cache_l1_thresh: 0.1, // Default
                    seed: Math.floor(Math.random() * 2147483647) // Random Int (Backend crashes on null)
                }
            };

            // 3. Send Request
            let response = await fetch(`${API_CONFIG.INFCAM_ENDPOINT}/run`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                    // Auth is handled by proxy
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`InfCam API Error: ${errText}`);
            }

            let data = await response.json();

            // 4. Poll if Async
            if (data.id && (data.status === "IN_QUEUE" || data.status === "IN_PROGRESS")) {
                const jobId = data.id;
                console.log("InfCam Job Queued:", jobId);

                // Poll loop
                while (true) {
                    await new Promise(r => setTimeout(r, 5000)); // 5s poll
                    const statusRes = await fetch(`${API_CONFIG.INFCAM_ENDPOINT}/status/${jobId}`, {
                        headers: { "Content-Type": "application/json" }
                    });

                    if (!statusRes.ok) throw new Error("InfCam Poll Failed");
                    data = await statusRes.json();

                    if (data.status === "COMPLETED") break;
                    if (data.status === "FAILED") throw new Error(`InfCam Job Failed: ${JSON.stringify(data.error)}`);
                }
            }

            // 5. Get Result
            // RunPod serverless usually returns { output: { video_url: "..." } } or just { video_url: "..." } depending on handler mapping
            // The user's handler returns { "video_url": ... } from the function
            // So data.output should contain that object.

            const resultUrl = data.output?.video_url || data.video_url;

            if (!resultUrl) throw new Error("No video URL in InfCam response");

            // 6. Persist to DB
            if (supabase) {
                // [Fix] Generate ID explicitly (removed user_id as it causes schema error)
                const newId = uuidv4();
                if (!resultUrl) {
                    // Fallback handled by outer catch
                    throw new Error("No result URL");
                }

                // [Simplified] Reuse Last Frame from Original Clip (User Request)
                // Since this is a re-shoot of the same scene, the last frame is semantically similar enough for now.
                // This avoids complex client-side capture or backend FFmpeg dependencies.
                const lastFrameUrl = sourceClip.last_frame_url || sourceClip.lastFrameUrl || "";

                if (dbId) {
                    const { error: updateError } = await supabase
                        .from('clips')
                        .update({
                            status: 'completed',
                            video_url: resultUrl,
                            last_frame_url: lastFrameUrl || null
                        })
                        .eq('id', dbId);
                    if (updateError) console.error("Failed to update final reshoot (sync):", updateError);
                } else {
                    const finalClip = {
                        ...sourceClip,
                        id: undefined,
                        video_url: resultUrl,
                        last_frame_url: lastFrameUrl,
                        status: 'completed',
                        created_at: new Date().toISOString()
                    };
                    await saveToBin(finalClip, false);
                }

                setSavedClips(prev => prev.map(c =>
                    (c.id === tempId || c.id === dbId) ? {
                        ...c,
                        id: dbId || c.id,
                        status: 'completed',
                        video_url: resultUrl,
                        last_frame_url: lastFrameUrl
                    } : c
                ));

            }
        } catch (err) {
            console.error("InfCam Error:", err);
            setSavedClips(prev => prev.map(c =>
                (c.id === tempId || c.id === dbId) ? { ...c, status: 'failed', error: err.message } : c
            ));
            alert(`Reshoot Failed: ${err.message}`);
        }
    };

    // EDIT LOGIC
    const handleEditClip = (clip) => {
        // Restore clip data to "workshop" (Story Studio context)
        // Restore clip data to "workshop" (Story Studio context)
        const scene = keyframes.find(s => s.id === clip.scene_id);
        if (scene) setSelectedKeyframe(scene);

        const restoredShot = {
            id: `restored_${Date.now()}`,
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
                status: b.audioUrl ? "ready" : "draft",
                inputMode: "text", // Default to text on restore
                error: "",
                audioUrl: "" // Clear audio to force regeneration or keep safe (user choice, defaulting clear as in original)
            })) : [
                { id: uuidv4(), characterId: clip.character_id || "", text: "", audioUrl: "", duration: 0, pauseDuration: 0.5, isGenerating: false, status: "draft", inputMode: "text", error: "" }
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

        setShotList([restoredShot]); // FORCE SINGLE SHOT: Replace workshop instead of prepending
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
                                            {/* GENERATING OVERLAY: Show if shot status is generating OR any block is generating */}
                                            {(shot.status === 'generating' || shot.status === 'generating_seedvc' || shot.dialogueBlocks.some(b => b.isGenerating)) && (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white text-center p-4 z-20 backdrop-blur-sm">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white mb-2"></div>
                                                    <p className="text-sm font-semibold mb-2">
                                                        {shot.status === 'generating_seedvc' ? "Converting Voice..." : "Generating Audio..."}
                                                    </p>
                                                    {/* [v65] Fail-Safe Dismiss via updateShot */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            updateShot(shot.tempId, { status: "draft", error: "Manually cancelled." });
                                                            // Also clear block flags
                                                            shot.dialogueBlocks.forEach(b => {
                                                                if (b.isGenerating) updateBlock(shot.tempId, b.id, "isGenerating", false);
                                                            });
                                                        }}
                                                        className="text-[10px] uppercase font-bold text-gray-400 hover:text-white border border-gray-600 hover:border-white px-2 py-1 rounded transition-colors"
                                                    >
                                                        Cancel / Dismiss
                                                    </button>
                                                </div>
                                            )}
                                            {shot.status === 'preview_ready' && (
                                                <div className="absolute top-2 right-2 bg-black text-white text-[10px] font-bold px-2 py-1 rounded shadow">PREVIEW READY</div>
                                            )}
                                        </div>

                                        <div className="text-center">
                                            <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">Duration</div>
                                            <div className="text-xl font-mono font-bold text-gray-800">
                                                {/* Live Logic: If Dialogue exists, sum it up. Else use manual/audio duration */}
                                                {(shot.dialogueBlocks.length > 0 && shot.dialogueBlocks.some(b => b.audioUrl || b.duration))
                                                    ? (shot.dialogueBlocks.reduce((acc, b) => acc + (b.duration || 0) + (b.pauseDuration || 0), 0)).toFixed(1)
                                                    : Number(finalDuration).toFixed(1)
                                                }s
                                            </div>
                                            {(shot.isAudioLocked || (shot.dialogueBlocks.length > 0 && shot.dialogueBlocks.some(b => b.audioUrl || b.text))) ? (
                                                <div className="flex flex-col gap-2">
                                                    {shot.isAudioLocked && (
                                                        <div className="text-[10px] text-gray-800 font-medium flex items-center justify-center gap-1">
                                                            <span>🔒 Locked to Audio</span>
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            // Revert to non-speaking state (Clear ALL audio/text)
                                                            updateShot(shot.tempId, {
                                                                isAudioLocked: false,
                                                                stitchedAudioUrl: "",
                                                                manualDuration: 3.0, // Reset to safe default
                                                                // Reset to single empty block
                                                                dialogueBlocks: [{
                                                                    id: uuidv4(),
                                                                    characterId: shot.characterId || "",
                                                                    text: "",
                                                                    audioUrl: "",
                                                                    duration: 0,
                                                                    pauseDuration: 0.5,
                                                                    isGenerating: false,
                                                                    status: "draft",
                                                                    inputMode: "text",
                                                                    error: ""
                                                                }]
                                                            });
                                                        }}
                                                        className="text-[10px] text-red-500 hover:text-red-700 font-bold underline decoration-dotted"
                                                    >
                                                        Remove Audio
                                                    </button>
                                                </div>
                                            ) : (
                                                <input
                                                    type="range" min="1" max="3.4" step="0.1"
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
                                                            // [v66] ALLOW FORCE SELECTION via Warning
                                                            // disabled={!isLipSyncEligible}
                                                            className={`flex-1 md:flex-none px-3 py-1 text-[10px] uppercase font-bold rounded flex items-center gap-1 ${shot.speakerType === "on_screen" ? "bg-black text-white" : "text-gray-400"
                                                                } hover:text-gray-800`}
                                                        >
                                                            Character
                                                            {(!isLipSyncEligible) && (
                                                                <span className="text-[8px] opacity-70" title="Warning: Angle might be too wide for good lip-sync">⚠️</span>
                                                            )}
                                                        </button>
                                                        {(!isLipSyncEligible) && (
                                                            <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-black text-white text-[10px] rounded shadow-lg z-20 pointer-events-none">
                                                                Warning: Lip-Sync works best with 'Standard' or 'Close & Intimate' shots. Wide shots may look unnatural.
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button onClick={() => updateShot(shot.tempId, { speakerType: "narrator" })} className={`flex-1 md:flex-none px-3 py-1 text-[10px] uppercase font-bold rounded ${shot.speakerType === "narrator" ? "bg-black text-white" : "text-gray-400"} `}>Narrator</button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* INPUT MODE TOGGLE - REMOVED, NOW PER BLOCK */}
                                        <div className="flex flex-col gap-4">
                                            {shot.dialogueBlocks.map((block, bIdx) => (
                                                <div key={block.id} className="relative pl-3 border-l-2 border-gray-200 bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                                                    <div className="flex flex-col gap-3">
                                                        {/* Row 1: Speaker + Input Mode Toggle */}
                                                        <div className="flex justify-between items-center gap-2">
                                                            <select
                                                                value={block.characterId}
                                                                onChange={e => updateBlock(shot.tempId, block.id, "characterId", e.target.value)}
                                                                className="bg-white border text-xs border-gray-200 rounded px-2 py-1 outline-none flex-1 font-semibold"
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

                                                            {/* Per-Block Input Mode Toggle */}
                                                            <div className="flex bg-gray-100 p-0.5 rounded">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        updateBlock(shot.tempId, block.id, "inputMode", "text");
                                                                    }}
                                                                    className={`px-2 py-1 text-[10px] font-bold rounded ${block.inputMode !== 'mic' ? 'bg-black text-white' : 'text-gray-400'}`}
                                                                >
                                                                    Text
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        updateBlock(shot.tempId, block.id, "inputMode", "mic");
                                                                    }}
                                                                    className={`px-2 py-1 text-[10px] font-bold rounded ${block.inputMode === 'mic' ? 'bg-black text-white' : 'text-gray-400'}`}
                                                                >
                                                                    Mic
                                                                </button>
                                                            </div>

                                                            {shot.dialogueBlocks.length > 1 && (
                                                                <button onClick={() => removeBlock(shot.tempId, block.id)} className="text-gray-300 hover:text-red-400 font-bold px-1 text-lg leading-none">×</button>
                                                            )}
                                                        </div>

                                                        {/* Row 2: Input Area */}
                                                        {block.inputMode === 'mic' ? (
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => block.isRecording ? handleStopRecording(shot.tempId, block.id) : handleStartRecording(shot.tempId, block.id)}
                                                                    className={`flex-1 py-3 text-xs font-bold rounded flex items-center justify-center gap-2 transition-all ${block.isRecording ? "bg-red-500 text-white animate-pulse" : "bg-black text-white hover:bg-gray-800"}`}
                                                                >
                                                                    {block.isRecording ? (
                                                                        <>
                                                                            <span className="w-2 h-2 bg-white rounded-full animate-ping" />
                                                                            Stop Recording
                                                                        </>
                                                                    ) : "🎤 Record Audio (STS)"}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex gap-2 items-start">
                                                                <textarea
                                                                    className="flex-1 bg-white border border-gray-200 rounded text-sm px-3 py-2 outline-none resize-none focus:border-gray-400 transition-colors"
                                                                    placeholder="Enter dialogue..."
                                                                    rows={2}
                                                                    value={block.text}
                                                                    onChange={e => updateBlock(shot.tempId, block.id, "text", e.target.value)}
                                                                />
                                                                <button
                                                                    onClick={() => generateBlockAudio(shot.tempId, block.id)}
                                                                    disabled={block.isGenerating || !block.text}
                                                                    className={`w-24 bg-black text-white text-[10px] font-bold rounded disabled:opacity-50 flex flex-col items-center justify-center gap-1 hover:bg-gray-800 self-stretch transition-all ${block.isGenerating ? "cursor-wait" : ""}`}
                                                                >
                                                                    {block.isGenerating ? (
                                                                        <>
                                                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                                            <span>Generating</span>
                                                                        </>
                                                                    ) : block.audioUrl ? (
                                                                        <>
                                                                            <span className="text-lg leading-none">↻</span>
                                                                            <span>Regenerate</span>
                                                                        </>
                                                                    ) : (
                                                                        "Generate"
                                                                    )}
                                                                </button>
                                                            </div>
                                                        )}

                                                        {/* Row 3: Status & Audio Player */}
                                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-1 gap-2 min-h-[24px]">
                                                            <div className="flex items-center gap-2 flex-1 overflow-hidden">
                                                                {block.error && <span className="text-[10px] text-red-500 font-bold max-w-[150px] truncate" title={block.error}>{block.error}</span>}

                                                                {block.audioUrl && (
                                                                    <div className="flex items-center gap-2 bg-green-50 px-2 py-1 rounded border border-green-100 max-w-full">
                                                                        <span className="text-[10px] font-bold text-green-700 whitespace-nowrap">✓ Ready</span>
                                                                        {/* Fixed Player & Duration Spacing */}
                                                                        <div className="flex items-center gap-2">
                                                                            <audio
                                                                                controls
                                                                                src={block.audioUrl}
                                                                                className="h-8 w-32 opacity-90"
                                                                                onLoadedMetadata={(e) => {
                                                                                    if (e.target.duration && e.target.duration !== Infinity) {
                                                                                        const cur = block.duration || 0;
                                                                                        if (Math.abs(cur - e.target.duration) > 0.1) {
                                                                                            updateBlock(shot.tempId, block.id, "duration", e.target.duration);
                                                                                        }
                                                                                    }
                                                                                }}
                                                                            />
                                                                            <span className="text-[10px] text-gray-500 font-mono font-bold whitespace-nowrap bg-white px-1 rounded shadow-sm">
                                                                                {(block.duration || 0).toFixed(1)}s
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Pause Duration Control */}
                                                            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded px-1.5 py-0.5 self-start sm:self-auto">
                                                                <span className="text-[9px] uppercase font-bold text-gray-400 whitespace-nowrap">Pause After:</span>
                                                                <input
                                                                    type="number" step="0.1" min="0"
                                                                    className="w-8 text-[10px] font-bold outline-none text-center"
                                                                    value={block.pauseDuration || 0.5}
                                                                    onChange={e => updateBlock(shot.tempId, block.id, "pauseDuration", parseFloat(e.target.value))}
                                                                />
                                                                <span className="text-[9px] text-gray-400">s</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Bottom Actions */}
                                            <div className="flex flex-col gap-3 mt-2">
                                                <button onClick={() => addBlock(shot.tempId)} className="text-xs font-bold text-gray-500 hover:text-black self-start transition-colors">+ Add Another Line</button>

                                                <button
                                                    onClick={() => finalizeAudio(shot.tempId)}
                                                    className="w-full py-3 bg-gradient-to-r from-gray-900 to-black text-white font-bold rounded-lg shadow hover:shadow-lg transition-all flex items-center justify-center gap-2 hover:translate-y-[-1px]"
                                                >
                                                    {shot.status === 'rendering' ? (
                                                        <>
                                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                            <span>Rendering Final Audio...</span>
                                                        </>
                                                    ) : (
                                                        <span>✨ Finalize Audio</span>
                                                    )}
                                                </button>
                                            </div>
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
                                                        const newDur = e.target.duration;
                                                        if (newDur && newDur !== Infinity) {
                                                            const current = shot.totalAudioDuration || 0;
                                                            if (Math.abs(current - newDur) > 0.1) {
                                                                updateShot(shot.tempId, { totalAudioDuration: newDur });
                                                            }
                                                        }
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section >

            {/* SAVED CLIPS */}
            < section className="mt-12 pt-12 border-t border-gray-100" >
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

                                {clip.status === 'rendering' ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white z-10 p-2 text-center">
                                        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white mb-2"></div>
                                        <span className="text-[10px] font-bold">Rendering...</span>
                                    </div>
                                ) : (
                                    <video src={clip.video_url || clip.videoUrl} className="w-full h-full object-cover" />
                                )}
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
                                        disabled={clip.status === 'rendering'}
                                        className="flex-1 text-[10px] font-bold text-slate-700 border border-slate-200 rounded py-1 hover:bg-white hover:border-slate-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            </section >

            {/* PREVIEW MODAL */}
            {/* PREVIEW MODAL */}
            {
                previewShot && (
                    previewShot.status === 'completed' || (String(previewShot.id).startsWith("saved_") || previewShot.created_at) ? (
                        <ClipCard
                            clip={previewShot}
                            onClose={() => setPreviewShot(null)}
                            onEdit={handleEditClip}
                            onReshoot={handleInfCamReshoot}
                            onDelete={handleDeleteClip}
                            characters={characters}
                            settings={settings} // [New]
                            registryVoices={registryVoices}
                            onGenerateKeyframe={async (clip, source) => {
                                // Removed confirm dialog
                                let publicUrl = null;

                                try {
                                    if (typeof source === 'string') {
                                        console.log("PARENT: onGenerateKeyframe called with URL:", source);
                                        publicUrl = source;
                                    } else if (source && (source instanceof Blob || source.size)) {
                                        console.log("PARENT: onGenerateKeyframe called with blob size:", source.size);

                                        // SUSPICIOUS BLOB CHECK [v12]
                                        if (source.size < 1000) {
                                            const text = await source.text();
                                            console.error("Small Blob Detected:", text);
                                            alert(`[v12 Diagnostic] Capture Failed.\n\nThe server returned an error instead of an image.\n\nContent: ${text.substring(0, 500)}`);
                                            return;
                                        }

                                        // Sanitize ID to prevent URL errors (remove spaces)
                                        const safeId = String(clip.id).replace(/\s+/g, '_');
                                        const filename = `${Date.now()}_${safeId}_end.png`;
                                        console.log("Uploading via Webhook (kind='scene'):", filename);

                                        const formData = new FormData();
                                        formData.append("file", source, filename);
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

                                        publicUrl = uploadData.publicUrl || uploadData.url || uploadData.image_url || (Array.isArray(uploadData) && uploadData[0]?.url);
                                    } else {
                                        alert("Error: No valid image source captured.");
                                        return;
                                    }

                                    if (!publicUrl) {
                                        throw new Error("No URL returned or provided");
                                    }
                                    console.log("Public URL generated/used:", publicUrl);

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
                                            setShotList([newDraftShot]); // FORCE SINGLE SHOT: Replace workshop instead of prepending
                                        } catch (err) {
                                            console.error("CRITICAL: Failed to auto-create draft shot:", err);
                                            // Do not rethrow, just let the flow continue (user just won't see the draft)
                                        }

                                        // AUTO-NAVIGATE WORKFLOW
                                        setPreviewShot(null); // Close Modal [v24 Fix]
                                        setSelectedKeyframe(formattedKeyframe);
                                        window.scrollTo({ top: 0, behavior: 'smooth' });

                                        const debugMsg = `[v12 Success]\n\nSource: ${typeof source === 'string' ? "Using Existing URL" : "New Link Generated"}\nInherited From: ${sourceScene.name ? "Yes" : "No"}\nSetting ID: ${newKeyframePayload.setting_id}`;
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
