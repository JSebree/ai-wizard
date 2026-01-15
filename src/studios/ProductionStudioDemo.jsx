import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../libs/supabaseClient";
import { API_CONFIG, getProxiedUrl } from "../config/api";
import { generateEDL, downloadEDL } from "../utils/edlGenerator";
import ProjectCard from "./components/ProjectCard";
import ProjectThumbnail from "./components/ProjectThumbnail"; // New Thumb

// Layout: 2 Columns. Left = Bin. Right = Player + Timeline.
// Logic: Timeline is an array of clips. Player plays them sequentially.

export default function ProductionStudioDemo() {
    const { user, isAdmin } = useAuth();
    const [bin, setBin] = useState([]);
    const [savedScenes, setSavedScenes] = useState([]);
    const [timeline, setTimeline] = useState([]);
    const [audioTrack, setAudioTrack] = useState(null);
    const [isRendering, setIsRendering] = useState(false);
    const [renderedUrl, setRenderedUrl] = useState(null);
    const [currentSceneId, setCurrentSceneId] = useState(null); // Track active project ID
    const [sceneName, setSceneName] = useState(""); // User defined scene name

    // Playback State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentClipIndex, setCurrentClipIndex] = useState(0);

    const [selectedViewProject, setSelectedViewProject] = useState(null); // For Modal
    // New Features
    const [upscaleEnabled, setUpscaleEnabled] = useState(false); // false = SD, true = HD
    const [musicStyle, setMusicStyle] = useState("");
    const [burnCaptions, setBurnCaptions] = useState(false); // Default No Captions
    const [isGeneratingMusic, setIsGeneratingMusic] = useState(false);

    // Custom Delete State
    const [sceneToDelete, setSceneToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const videoRef = useRef(null);
    const clipAudioRef = useRef(null); // Sync audio for clips with separate voice track



    // Load Data (Clips + Saved Scenes)
    useEffect(() => {
        const loadData = async () => {
            if (!supabase) return;

            // Load Clips
            const { data: clipData } = await supabase
                .from("clips")
                .select("*")
                .eq("status", "completed") // Only load ready clips
                .order("created_at", { ascending: false });

            if (clipData) {
                setBin(clipData.map(s => ({
                    id: s.id,
                    name: s.name,
                    video_url: s.video_url,
                    videoUrl: s.video_url,
                    thumbnailUrl: s.thumbnail_url,
                    prompt: s.prompt,
                    duration: s.duration,
                    motion: s.motion_type,
                    hasAudio: s.has_audio,
                    stitched_audio_url: s.stitched_audio_url, // For voice audio sync
                    stitchedAudioUrl: s.stitched_audio_url,   // Alias
                    type: s.speaker_type || "broll"
                })));
            }

            // Load Saved Scenes (Productions)
            const { data: sceneData } = await supabase
                .from("productions")
                .select("*")
                .order("created_at", { ascending: false });

            if (sceneData) {
                setSavedScenes(sceneData.map(s => {
                    // Normalize State
                    // Prefer s.data (JSONB) if available, otherwise check s.timeline (Array or overload)
                    let finalData = s.data || {};
                    let finalTimeline = [];

                    if (Array.isArray(s.timeline)) {
                        finalTimeline = s.timeline;
                    } else if (s.timeline && typeof s.timeline === 'object') {
                        // Migration fallback: Handle overloading case if user didn't migrate old data yet
                        finalData = { ...finalData, ...s.timeline };
                        finalTimeline = s.timeline.timeline || [];
                    }

                    // If 'data' column was populated correctly
                    if (s.data && s.data.timeline) {
                        finalTimeline = s.data.timeline;
                    }

                    return {
                        id: s.id,
                        name: s.name,
                        videoUrl: s.video_url || finalData.video_url,
                        thumbnailUrl: s.thumbnail_url || finalData.thumbnailUrl,
                        status: s.status,
                        created_at: s.created_at,
                        data: { ...finalData, timeline: finalTimeline }, // Ensure timeline is inside data
                        timeline: finalTimeline, // Top-level for convenience
                        duration: s.duration || s.data?.duration, // Use top-level duration if available
                        user_id: s.user_id,
                    };
                }));
            }
        };
        if (user?.id) {
            loadData();
        }
    }, [user?.id]);

    // Watch for clip index changes to play next video
    useEffect(() => {
        if (videoRef.current && timeline[currentClipIndex]) {
            videoRef.current.load();
            if (isPlaying) {
                videoRef.current.play().catch(e => console.warn("Autoplay blocked", e));
            }
        }
    }, [currentClipIndex, timeline]);

    // Derived Total Duration (approximate for music gen)
    const totalDuration = timeline.reduce((acc, clip) => acc + (parseFloat(clip.duration) || 4), 0);

    const addToTimeline = (shot) => {
        const clip = {
            ...shot,
            uniqueId: Date.now() + Math.random(), // allow duplicates
            transition: "crossfade" // Default transition
        };
        setTimeline(prev => [...prev, clip]);
    };

    const removeFromTimeline = (index) => {
        setTimeline(prev => prev.filter((_, i) => i !== index));
        if (currentClipIndex >= index && currentClipIndex > 0) {
            setCurrentClipIndex(c => c - 1);
        }
    };

    const updateTransition = (index, type) => {
        setTimeline(prev => {
            const copy = [...prev];
            copy[index].transition = type;
            return copy;
        });
    };

    const togglePlay = () => {
        if (timeline.length === 0) return;

        if (isPlaying) {
            videoRef.current?.pause();
            setIsPlaying(false);
        } else {
            setIsPlaying(true);
            videoRef.current?.play();
        }
    };

    const handleVideoEnded = () => {
        if (currentClipIndex < timeline.length - 1) {
            setCurrentClipIndex(c => c + 1);
        } else {
            setIsPlaying(false);
            setCurrentClipIndex(0); // Reset to start
        }
    };

    // Save Project (Now accepts optional status override)
    const saveProject = async (url = renderedUrl, status = "completed") => {
        if (!supabase) {
            alert("No database connection");
            return;
        }
        if (!sceneName.trim()) return alert("Please enter a scene name");
        // if (!url && status === "completed") return alert("No render URL to save"); // Allow saving 'rendering' state without URL

        const projectData = {
            id: currentSceneId || crypto.randomUUID(),
            user_id: user?.id,
            name: sceneName,
            data: { timeline, musicStyle, burnCaptions, audioTrack }, // Save strictly to data column
            video_url: url,
            thumbnail_url: timeline[0]?.thumbnailUrl,
            status: status,
            created_at: new Date().toISOString()
        };

        let data, error;
        if (currentSceneId) {
            // Update existing project
            ({ data, error } = await supabase.from("productions").update(projectData).eq("id", currentSceneId).select().single());
        } else {
            // Insert new project
            ({ data, error } = await supabase.from("productions").insert([projectData]).select().single());
        }

        if (error) {
            console.error("Error saving scene:", error);
            alert("Failed to save scene. Ensure DB schema has 'data' column.");
            return null;
        } else {
            // Update local state
            setSavedScenes(prev => {
                const existingIndex = prev.findIndex(s => s.id === data.id);
                const newSceneEntry = {
                    ...data,
                    data: data.data || { timeline: [], musicStyle: "", burnCaptions: false },
                    timeline: data.data?.timeline || [] // Map derived
                };

                if (existingIndex > -1) {
                    const updatedScenes = [...prev];
                    updatedScenes[existingIndex] = newSceneEntry;
                    return updatedScenes;
                } else {
                    return [newSceneEntry, ...prev];
                }
            });
            setCurrentSceneId(data.id);
            return { id: data.id, ...data };
        }
    };

    const musicWebhookUrl = API_CONFIG.GENERATE_MUSIC;
    const renderWebhookUrl = API_CONFIG.GENERATE_RENDER_SCENE;

    const generateAiMusic = async () => {
        try {
            const durationToUse = (typeof totalDuration === 'number' && !isNaN(totalDuration) && totalDuration > 0) ? totalDuration : 30;
            // Use the text area value directly as the prompt
            const prompt = (musicStyle || "Cinematic, Epic, Orchestral").trim();

            if (!prompt) {
                alert("Please describe the desired music style first.");
                return;
            }

            setIsGeneratingMusic(true);
            console.log("Generating Music...", { prompt, duration: durationToUse });

            // Check for Webhook
            console.log("DEBUG: Music Webhook Configuration:", {
                defined: !!musicWebhookUrl,
                value: musicWebhookUrl, // This might be masked in some builds, but usually visible in dev
                allEnv: import.meta.env
            });

            if (!musicWebhookUrl) {
                console.warn("No VITE_N8N_MUSIC_WEBHOOK defined. Using Mock.");
                window.setTimeout(() => {
                    const newTrack = {
                        id: `gen-${Date.now()}`,
                        name: `✨ AI: ${prompt}`,
                        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3"
                    };
                    setAudioTrack(newTrack);
                    setIsGeneratingMusic(false);
                }, 2000);
                return;
            }

            // Real API Call
            const response = await fetch(musicWebhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: prompt,
                    duration: durationToUse
                })
            });

            if (!response.ok) throw new Error("Music generation failed");

            let data = await response.json();

            // Handle n8n wrapping in array
            if (Array.isArray(data)) {
                data = data[0];
            }

            // Expecting variants:
            // 1. { url: "..." }
            // 2. { audio: { url: "..." } }
            // 3. { output: { audio: { url: "..." } } } (n8n raw node output)
            // 4. { music_url: "..." } (Observed in logs)
            // 5. { video_url: "..." } (Just in case)
            const resultUrl = data.url ||
                data.audio?.url ||
                data.output?.audio?.url ||
                data.music_url ||
                data.video_url;

            console.log("Music API Response parsed:", { raw: data, resultUrl });

            if (!resultUrl) {
                console.error("API Response missing URL in all checked paths:", data);
                throw new Error("API response missing audio URL");
            }

            const newTrack = {
                id: `gen-${Date.now()}`,
                name: data.tags || data.output?.tags || data.name || `✨ AI: ${prompt}`,
                url: resultUrl
            };

            setAudioTrack(newTrack);
        } catch (err) {
            console.error("Error in generateAiMusic:", err);
            alert("Failed to generate music. Check console.");
        } finally {
            setIsGeneratingMusic(false);
        }
    };

    const handleRender = async () => {
        if (timeline.length === 0) return;

        if (!sceneName.trim()) {
            alert("Please enter a Scene Name before rendering.");
            return;
        }

        setIsRendering(true);
        setRenderedUrl(null);

        try {
            // 1. SAVE TO DB FIRST (Status: 'rendering')
            // This ensures we have a record even if the browser closes or webhook hangs
            // We use the existing saveProject function but force status overwrites
            const savedProject = await saveProject(null, "rendering");
            if (!savedProject) throw new Error("Failed to save project state");

            // 2. Prepare Payload for webhook
            const n8nPayload = {
                scene_id: savedProject.id, // Use the ID from the saved project
                scene_name: sceneName.trim(),
                resolution: upscaleEnabled ? "HD" : "SD",
                burn_captions: burnCaptions,
                audio_url: audioTrack?.url,
                audio_style: audioTrack ? null : (musicStyle || null),
                clips: timeline.map(c => ({
                    url: c.videoUrl,
                    duration: c.duration,
                    transition: c.transition,
                    has_audio: c.hasAudio,
                    type: c.type
                }))
            };

            console.log("Sending Render Payload:", n8nPayload);

            if (!renderWebhookUrl) {
                console.warn("No VITE_N8N_RENDER_WEBHOOK defined. Using Mock.");
                setTimeout(async () => {
                    setIsRendering(false);
                    const mockUrl = timeline[0].videoUrl;
                    setRenderedUrl(mockUrl);
                    alert(`Render (Mock) Complete! Please Preview & Save.`);
                    // Update DB with mock URL and completed status
                    if (supabase) {
                        await supabase.from("productions")
                            .update({ video_url: mockUrl, status: "completed" })
                            .eq("id", savedProject.id);
                        // Optimistic Update
                        setSavedScenes(prev => prev.map(s => s.id === savedProject.id ? { ...s, video_url: mockUrl, status: "completed" } : s));
                    }
                }, 2000);
                return;
            }

            // Real Call
            const response = await fetch(renderWebhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(n8nPayload)
            });

            if (response.ok) {
                const resData = await response.json();
                console.log("RENDER RESPONSE:", resData); // DEBUG

                let finalUrl = null;
                if (resData.url) finalUrl = resData.url;
                else if (resData.final_url) finalUrl = resData.final_url;
                else if (resData.output?.url) finalUrl = resData.output.url;

                if (finalUrl) {
                    setRenderedUrl(finalUrl);
                    // Update DB with final URL and status
                    if (supabase) {
                        await supabase.from("productions")
                            .update({ video_url: finalUrl, status: "completed" })
                            .eq("id", savedProject.id);
                        // Optimistic Update
                        setSavedScenes(prev => prev.map(s => s.id === savedProject.id ? { ...s, video_url: finalUrl, status: "completed" } : s));
                    }
                }

                // No automatic save. User must click Save.
            } else {
                console.error("Webhook Failed:", response.status, response.statusText);
                throw new Error("Render webhook failed");
            }

        } catch (err) {
            console.error("Render Error:", err);
            alert("Render Error: " + err.message);
        } finally {
            setIsRendering(false);
        }
    };

    // DELETE HANDLERS
    const handleDeleteScene = (scene) => {
        setSceneToDelete(scene);
    };

    const handleConfirmDelete = async () => {
        const scene = sceneToDelete;
        if (!scene) return;

        setIsDeleting(true);
        try {
            setSavedScenes(prev => prev.filter(s => s.id !== scene.id));
            if (supabase) {
                await supabase.from("productions").delete().eq("id", scene.id);
            }
            // If deleting the viewed project, close the modal
            if (selectedViewProject && selectedViewProject.id === scene.id) {
                setSelectedViewProject(null);
            }
        } catch (error) {
            console.error("Delete Error:", error);
            alert("Failed to delete scene.");
        } finally {
            setIsDeleting(false);
            setSceneToDelete(null);
        }
    };

    // derived
    const currentClip = timeline[currentClipIndex];

    // DnD Handlers
    const handleDragStart = (e, item, source) => {
        e.dataTransfer.setData("application/json", JSON.stringify({ item, source }));
        e.dataTransfer.effectAllowed = "copyMove";
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copyMove";
    };

    const handleDrop = (e, targetIndex) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent bubbling to container
        const data = e.dataTransfer.getData("application/json");
        if (!data) return;

        try {
            const { item, source } = JSON.parse(data);

            if (source === "bin") {
                // Determine insertion index: if targetIndex is provided, insert there, else append
                const insertAt = targetIndex !== undefined ? targetIndex : timeline.length;
                const newClip = {
                    ...item,
                    uniqueId: Date.now() + Math.random(),
                    transition: "crossfade"
                };

                setTimeline(prev => {
                    const copy = [...prev];
                    copy.splice(insertAt, 0, newClip);
                    return copy;
                });
            } else if (source === "timeline") {
                // Reorder
                const dragIndex = item.index;
                const dropIndex = targetIndex !== undefined ? targetIndex : timeline.length - 1;
                if (dragIndex === dropIndex) return;
                moveCard(dragIndex, dropIndex);
            }
        } catch (err) {
            console.error("Drop failed", err);
        }
    };

    const moveCard = (dragIndex, hoverIndex) => {
        setTimeline(prev => {
            const copy = [...prev];
            const [dragItem] = copy.splice(dragIndex, 1);
            copy.splice(hoverIndex, 0, dragItem);
            return copy;
        });

        // Update current index if needed logic is complex, simpler to reset or keep specific ID
        // For now, let's just ensure we don't break the player state too much
    };

    const loadScene = (scene) => {
        setSceneName(scene.name);
        setTimeline(scene.data?.timeline || []);
        setAudioTrack(scene.data?.audioTrack || null);
        setMusicStyle(scene.data?.musicStyle || "");
        setBurnCaptions(scene.data?.burnCaptions || false);
        setUpscaleEnabled(scene.data?.upscaleEnabled || false);
        setRenderedUrl(scene.video_url);
        setCurrentSceneId(scene.id);
        setCurrentClipIndex(0); // Reset player
        setIsPlaying(false);
        console.log(`Scene "${scene.name}" loaded.`); // Removed alert popup
    };

    return (
        <div className="flex flex-col pb-4 lg:pb-16 max-w-5xl mx-auto w-full">
            <div className="text-center mb-6">
                <h2 className="text-xl font-bold mb-2">Scene Studio</h2>
                <p className="text-gray-500 text-sm">Assemble your clips into a full scene.</p>
            </div>

            <div className="flex flex-col gap-8 px-4 pb-20">




                {/* 1. PROJECT BIN */}
                <div className="flex flex-col gap-4">
                    <div>
                        <h2 className="text-lg font-bold mb-1">Clip Bin</h2>
                        <p className="text-xs text-slate-500">Your generated clips. Drag them to the timeline!</p>
                    </div>

                    <div className="overflow-x-auto flex gap-4 pb-4 border-b border-gray-100 min-h-[120px]">
                        {bin.length === 0 && (
                            <div className="w-full text-center py-8 text-slate-400 text-xs border border-dashed rounded-lg">
                                No clips found. Go to Clip Studio to create some!
                            </div>
                        )}
                        {bin.map(shot => (
                            <div
                                key={shot.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, shot, "bin")}
                                onClick={() => addToTimeline(shot)}
                                className="flex-shrink-0 w-40 flex flex-col gap-2 cursor-pointer group active:cursor-grabbing"
                            >
                                <div className="w-40 aspect-video bg-black rounded-lg overflow-hidden relative shadow-sm group-hover:shadow-md transition-all ring-2 ring-transparent group-hover:ring-black">
                                    <img src={getProxiedUrl(shot.thumbnailUrl)} className="w-full h-full object-cover pointer-events-none" />
                                    {/* Visual Badges */}
                                    <div className="absolute top-1 right-1 flex flex-col gap-1 items-end">
                                        {shot.hasAudio ? (
                                            (shot.type === 'on_screen' || shot.type === 'character')
                                                ? <span className="bg-green-500/90 backdrop-blur-sm px-1.5 py-0.5 rounded shadow text-[12px] text-white" title="Lipsync">👄</span>
                                                : <span className="bg-green-500/90 backdrop-blur-sm px-1.5 py-0.5 rounded shadow text-[12px] text-white" title="Narrator">🔊</span>
                                        ) : (
                                            <span className="bg-green-500/90 backdrop-blur-sm px-1.5 py-0.5 rounded shadow text-[12px] text-white" title="Silent">🔇</span>
                                        )}
                                    </div>

                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                                        <span className="text-white opacity-0 group-hover:opacity-100 font-bold text-xl">+</span>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs font-semibold truncate text-slate-800">{shot.name || shot.prompt}</div>
                                    <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                        <span>{shot.motion}</span>
                                        <span>•</span>
                                        <span>{Number(shot.duration).toFixed(1)}s</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3. TIMELINE (Moved Here) */}
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-end px-1">
                        <h2 className="text-lg font-bold">Timeline Sequence</h2>
                        <div className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">Total: {(Number(totalDuration) || 0).toFixed(1)}s</div>
                    </div>

                    <div
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, timeline.length)}
                        className="bg-slate-50 border border-slate-200 rounded-xl overflow-x-auto flex items-center p-4 gap-2 min-h-[140px] shadow-inner transition-colors hover:bg-slate-100"
                    >
                        {timeline.length === 0 && (
                            <div className="mx-auto text-slate-400 text-sm italic pointer-events-none">Drag or click clips from the Clip Bin above</div>
                        )}

                        {timeline.map((clip, idx) => (
                            <React.Fragment key={clip.uniqueId}>
                                {/* Clip Node */}
                                <div
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, { ...clip, index: idx }, "timeline")}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, idx)}
                                    onClick={() => { setCurrentClipIndex(idx); setIsPlaying(false); }}
                                    className={`relative flex-shrink-0 w-36 h-24 bg-white rounded-lg border-2 overflow-hidden cursor-pointer transition-all ${currentClipIndex === idx ? "border-black shadow-lg scale-105 z-10" : "border-slate-300 opacity-80 hover:opacity-100"}`}
                                >
                                    <img src={getProxiedUrl(clip.thumbnailUrl)} className="w-full h-full object-cover pointer-events-none" />
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-4">
                                        <div className="text-white text-[10px] font-medium truncate">{idx + 1}. {clip.name}</div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); removeFromTimeline(idx); }}
                                        className="absolute top-1 right-1 w-5 h-5 bg-white/90 rounded-full text-black text-xs flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors shadow-sm"
                                    >
                                        ×
                                    </button>
                                </div>

                                {/* Transition Node */}
                                {idx < timeline.length - 1 && (
                                    <div className="flex flex-col items-center justify-center gap-1 w-12 flex-shrink-0 z-0">
                                        <div className="h-0.5 w-full bg-slate-300"></div>
                                        <select
                                            value={clip.transition}
                                            onChange={(e) => updateTransition(idx, e.target.value)}
                                            className="bg-white border border-gray-300 text-[10px] font-bold rounded px-1 py-0.5 outline-none cursor-pointer hover:border-black w-full"
                                        >
                                            <option value="cut">Cut</option>
                                            <option value="crossfade">Fade</option>
                                        </select>
                                        <div className="h-0.5 w-full bg-slate-300"></div>
                                    </div>
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* SCENE NAME INPUT (Original Location) */}
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Scene Name</label>
                    <input
                        type="text"
                        value={sceneName}
                        onChange={(e) => setSceneName(e.target.value)}
                        placeholder="Name your scene..."
                        className="w-full p-2 text-sm font-medium border border-gray-300 rounded-lg outline-none focus:border-black focus:ring-1 focus:ring-black transition-all bg-white shadow-sm"
                    />
                </div>

                {/* 2. PLAYER & CONTROLS */}
                <div className="flex flex-col md:flex-row gap-6">
                    {/* Player */}
                    <div className="flex-[2] bg-black rounded-xl aspect-video relative overflow-hidden shadow-lg">
                        {currentClip ? (
                            <video
                                ref={videoRef}
                                src={getProxiedUrl(currentClip.video_url || currentClip.videoUrl)}
                                crossOrigin="anonymous"
                                controls
                                onEnded={handleVideoEnded}
                                onClick={togglePlay}
                                className="w-full h-full object-contain"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600 font-medium">Timeline Empty</div>
                        )}

                        {/* Overlay Controls */}
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4 bg-black/60 px-6 py-2 rounded-full backdrop-blur-md border border-white/10">
                            <button onClick={togglePlay} className="text-white text-xl hover:scale-110 transition-transform">
                                {isPlaying ? "⏸" : "▶️"}
                            </button>
                            <span className="text-white text-xs self-center font-mono">
                                {timeline.length > 0 ? `${currentClipIndex + 1} / ${timeline.length}` : "0 / 0"}
                            </span>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex-1 flex flex-col gap-4">
                        {/* Audio Section */}
                        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative">
                            <h3 className="text-xs font-bold text-gray-800 mb-2 uppercase tracking-wider">Background Music</h3>

                            {/* Text Input for Custom Description */}
                            <div className="flex flex-col gap-2 mb-2">
                                <div className="flex gap-2">
                                    <textarea
                                        className="flex-1 p-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-black focus:ring-1 focus:ring-black transition-all bg-slate-50 min-h-[60px] resize-none"
                                        placeholder="Describe the background music (e.g., 'Sad piano melody', 'Upbeat rock', 'Lo-Fi beat for study')..."
                                        value={musicStyle}
                                        onChange={(e) => setMusicStyle(e.target.value)}
                                    />
                                    <button
                                        onClick={generateAiMusic}
                                        disabled={isGeneratingMusic || !musicStyle.trim()}
                                        className="bg-black text-white p-2 rounded-lg text-xs font-bold hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center min-w-[60px] transition-colors"
                                        title={!musicStyle.trim() ? "Describe music style first" : "Generate AI Music"}
                                    >
                                        {isGeneratingMusic ? <span className="animate-spin">◌</span> : "✨ Generate"}
                                    </button>
                                </div>
                                {musicStyle && (
                                    <button
                                        onClick={() => { setMusicStyle(""); setAudioTrack(null); }}
                                        className="self-end px-2 py-1 text-[10px] bg-red-50 hover:bg-red-100 text-red-600 rounded-full border border-red-200 transition-colors whitespace-nowrap"
                                    >
                                        ✕ Clear
                                    </button>
                                )}
                            </div>

                            {/* Generated Audio Player - Checking URL existence instead of just ID pattern */}
                            {/* DEBUG: State Check */}
                            {console.log("RENDER: Audio Track State:", audioTrack)}

                            {audioTrack?.url && (
                                <div key={audioTrack.id} className="mt-3 bg-gray-50 p-2 rounded-lg border border-gray-200 animate-fade-in block">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase truncate pr-2 max-w-[200px]">{audioTrack.name || "Preview"}</span>
                                        {/* Close button removed as per request. Use 'None' in dropdown to clear. */}
                                    </div>
                                    <audio controls src={audioTrack.url} className="w-full h-8 mb-2" />
                                    <button
                                        onClick={() => generateAiMusic()}
                                        disabled={isGeneratingMusic}
                                        className="w-full py-1.5 rounded border border-gray-300 text-[10px] font-bold text-gray-600 hover:bg-white hover:border-gray-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isGeneratingMusic ? <span className="animate-spin">◌</span> : "↻ Regenerate"}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Upscale Section */}
                        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
                            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2 m-0">
                                Resolution
                            </h3>
                            <div className="flex bg-white rounded-md border border-gray-200 p-0.5">
                                <button
                                    className={`px-3 py-1 text-[10px] uppercase font-bold rounded transition-all ${!upscaleEnabled ? 'bg-black text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                    onClick={() => setUpscaleEnabled(false)}
                                >
                                    SD
                                </button>
                                <button
                                    className={`px-3 py-1 text-[10px] uppercase font-bold rounded transition-all ${upscaleEnabled ? 'bg-black text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                    onClick={() => setUpscaleEnabled(true)}
                                >
                                    HD
                                </button>
                            </div>
                        </div>

                        {/* Captions Section */}
                        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
                            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2 m-0">
                                Captions
                            </h3>
                            <div className="flex bg-white rounded-md border border-gray-200 p-0.5">
                                <button
                                    className={`px-3 py-1 text-[10px] uppercase font-bold rounded transition-all ${!burnCaptions ? 'bg-black text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                    onClick={() => setBurnCaptions(false)}
                                >
                                    OFF
                                </button>
                                <button
                                    className={`px-3 py-1 text-[10px] uppercase font-bold rounded transition-all ${burnCaptions ? 'bg-black text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                    onClick={() => setBurnCaptions(true)}
                                >
                                    ON
                                </button>
                            </div>
                        </div>

                        {/* Actions Section */}
                        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Actions</h3>

                            {/* Render & Save Button */}
                            <button
                                onClick={handleRender}
                                disabled={timeline.length === 0 || isRendering || !sceneName.trim()}
                                className={`w-full py-3 rounded-lg font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${timeline.length === 0 || isRendering || !sceneName.trim()
                                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                    : "bg-black text-white hover:bg-gray-800 hover:shadow-lg"
                                    }`}
                                title={!sceneName.trim() ? "Please enter a Scene Name" : "Render Scene"}
                            >
                                {isRendering ? <span className="animate-spin">◌</span> : "🎬"}
                                {isRendering ? "Rendering & Saving..." : "Render & Save Scene"}
                            </button>

                            {renderedUrl && (
                                <a href={renderedUrl} target="_blank" rel="noopener noreferrer" className="block text-center text-xs text-blue-600 font-bold hover:underline py-2">
                                    Download Last Render
                                </a>
                            )}

                            {/* EDL Export Button */}
                            <button
                                onClick={() => {
                                    const edlContent = generateEDL(timeline, sceneName || 'Untitled Scene', { fps: 24 });
                                    downloadEDL(edlContent, sceneName || 'scene');
                                }}
                                disabled={timeline.length === 0 || !sceneName.trim()}
                                className={`w-full py-2 rounded-lg font-bold text-xs border transition-all flex items-center justify-center gap-2 ${timeline.length === 0 || !sceneName.trim()
                                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                                    }`}
                                title={!sceneName.trim() ? "Please enter a Scene Name" : "Export Edit Decision List for professional editing software"}
                            >
                                📋 Export EDL
                            </button>
                        </div>
                    </div>
                </div>





                {/* 4. SAVED SCENES */}
                <div className="mt-8 border-t border-gray-200 pt-8">
                    <div className="mb-4">
                        <h2 className="text-lg font-bold mb-1">Saved Scenes</h2>
                        <p className="text-xs text-slate-500">Your finished productions.</p>
                    </div>

                    <div className="overflow-x-auto flex gap-4 pb-4 border-b border-gray-100 min-h-[120px]">
                        {savedScenes.length === 0 && (
                            <div className="w-full text-center py-8 text-slate-400 text-xs border border-dashed rounded-lg">
                                No saved scenes yet. Render your timeline to save one!
                            </div>
                        )}
                        {savedScenes.map(scene => (
                            <div
                                key={scene.id}
                                className="flex-shrink-0 w-48 flex flex-col gap-2 cursor-pointer group"
                                onClick={() => setSelectedViewProject(scene)}
                            >
                                <div className="w-48 aspect-video bg-black rounded-lg overflow-hidden relative shadow-sm group-hover:shadow-md transition-all ring-2 ring-transparent group-hover:ring-black">
                                    <img
                                        src={scene.thumbnailUrl || scene.thumbnail_url}
                                        className={`w-full h-full object-cover pointer-events-none ${scene.status === 'rendering' ? 'opacity-50' : ''}`}
                                    />

                                    {/* Status Badge */}
                                    {scene.status === 'rendering' && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                            <span className="text-white text-xs font-bold animate-pulse">RENDERING</span>
                                        </div>
                                    )}

                                    {/* Play Icon */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                                        {!scene.status !== 'rendering' && (
                                            <span className="text-white opacity-0 group-hover:opacity-100 font-bold text-xl">▶</span>
                                        )}
                                    </div>

                                    {/* Clip Count Badge (Swapped) */}
                                    <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1 py-0.5 rounded font-mono backdrop-blur-sm">
                                        {scene.data?.timeline?.length || 0} clips
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <div className="flex gap-2 flex-shrink-0 items-center">
                                            {/* Download */}
                                            {(scene.video_url || scene.videoUrl) ? (
                                                <a
                                                    href={scene.video_url || scene.videoUrl}
                                                    download
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline px-0.5"
                                                    title="Download Video"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    Download
                                                </a>
                                            ) : (
                                                <span
                                                    className="text-[10px] font-bold text-slate-400 cursor-not-allowed px-0.5"
                                                    title="No rendered video available"
                                                >
                                                    Processing
                                                </span>
                                            )}
                                            {/* Quick Delete */}
                                            {user && (scene.user_id === user.id || isAdmin) && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteScene(scene); }}
                                                    className="text-[10px] font-bold text-red-500 hover:text-red-700 px-0.5"
                                                    title="Delete"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                        <div className="text-[9px] font-bold text-black uppercase tracking-wider bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                            {(Number(scene.data?.timeline?.reduce((acc, c) => acc + (Number(c.duration) || 0), 0)) || Number(scene.duration) || 0).toFixed(1)}s
                                        </div>
                                    </div>
                                    <div className="text-xs font-bold truncate text-slate-800" title={scene.name}>
                                        {scene.name}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* MODAL */}
                {selectedViewProject && (
                    <ProjectCard
                        scene={selectedViewProject}
                        onClose={() => setSelectedViewProject(null)}
                        onLoad={(s) => {
                            loadScene(s);
                            setSelectedViewProject(null);
                        }}
                        onDelete={() => handleDeleteScene(selectedViewProject)}
                    />
                )}
            </div>

            {/* Custom Delete Confirmation Modal */}
            {sceneToDelete && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.5)", zIndex: 100,
                    display: "flex", alignItems: "center", justifyContent: "center"
                }} onClick={() => setSceneToDelete(null)}>
                    <div onClick={e => e.stopPropagation()} style={{ background: "white", padding: 24, borderRadius: 12, maxWidth: 400, width: "90%", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
                        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 18, fontWeight: 700, color: "#1F2937" }}>Confirm Deletion</h3>
                        <p style={{ color: "#4B5563", marginBottom: 24, lineHeight: 1.5 }}>
                            Are you sure you want to delete this scene? This action cannot be undone.
                        </p>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                            <button
                                onClick={() => setSceneToDelete(null)}
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
            )}
        </div>
    );
}
