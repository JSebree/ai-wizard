import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// Layout: 2 Columns. Left = Bin. Right = Player + Timeline.
// Logic: Timeline is an array of clips. Player plays them sequentially.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase =
    supabaseUrl && supabaseAnonKey
        ? createClient(supabaseUrl, supabaseAnonKey)
        : null;

export default function ProductionStudioDemo() {
    const [bin, setBin] = useState([]);
    const [timeline, setTimeline] = useState([]);

    // Playback State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentClipIndex, setCurrentClipIndex] = useState(0);

    const videoRef = useRef(null);

    // Load Data
    useEffect(() => {
        const loadShots = async () => {
            if (!supabase) return;
            const { data } = await supabase
                .from("shots")
                .select("*")
                .order("created_at", { ascending: false });

            if (data) {
                setBin(data.map(s => ({
                    id: s.id,
                    videoUrl: s.video_url,
                    thumbnailUrl: s.thumbnail_url,
                    prompt: s.prompt,
                    duration: s.duration,
                    motion: s.motion_type
                })));
            }
        };
        loadShots();
    }, []);

    // Watch for clip index changes to play next video
    useEffect(() => {
        if (videoRef.current && timeline[currentClipIndex]) {
            videoRef.current.load();
            if (isPlaying) {
                videoRef.current.play().catch(e => console.warn("Autoplay blocked", e));
            }
        }
    }, [currentClipIndex, timeline]);

    const addToTimeline = (shot) => {
        const clip = {
            ...shot,
            uniqueId: Date.now() + Math.random() // allow duplicates
        };
        setTimeline(prev => [...prev, clip]);
    };

    const removeFromTimeline = (index) => {
        setTimeline(prev => prev.filter((_, i) => i !== index));
        if (currentClipIndex >= index && currentClipIndex > 0) {
            setCurrentClipIndex(c => c - 1);
        }
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

    // derived
    const currentClip = timeline[currentClipIndex];
    const totalDuration = timeline.reduce((acc, clip) => acc + (clip.duration || 4), 0);

    return (
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 32, paddingBottom: 60, height: "calc(100vh - 140px)" }}>

            {/* LEFT: PROJECT BIN */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%", overflow: "hidden" }}>
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>Project Bin</h2>
                    <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>All your rendered shots.</p>
                </div>

                <div style={{
                    flex: 1,
                    overflowY: "auto",
                    border: "1px solid #E5E7EB",
                    borderRadius: 8,
                    background: "#fff",
                    padding: 12,
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    alignContent: "start",
                    gap: 12
                }}>
                    {bin.length === 0 && (
                        <div style={{ padding: 20, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                            No shots found. Go to Story Studio to create some!
                        </div>
                    )}
                    {bin.map(shot => (
                        <div
                            key={shot.id}
                            onClick={() => addToTimeline(shot)}
                            style={{
                                display: "flex",
                                gap: 10,
                                padding: 8,
                                borderRadius: 6,
                                background: "#F8FAFC",
                                border: "1px solid #E2E8F0",
                                cursor: "pointer"
                            }}
                        >
                            <div style={{ width: 60, aspectRatio: "16/9", background: "#000", borderRadius: 4, overflow: "hidden" }}>
                                <img src={shot.thumbnailUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            </div>
                            <div style={{ flex: 1, overflow: "hidden" }}>
                                <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shot.prompt}</div>
                                <div style={{ fontSize: 10, color: "#64748B" }}>{shot.motion} • {shot.duration}s</div>
                            </div>
                            <div style={{ fontSize: 16 }}>+</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT: PLAYER & TIMELINE */}
            <div style={{ display: "flex", flexDirection: "column", gap: 24, height: "100%" }}>

                {/* Player */}
                <div style={{
                    background: "#000",
                    borderRadius: 12,
                    flex: 1,
                    minHeight: 300,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    overflow: "hidden"
                }}>
                    {currentClip ? (
                        <video
                            ref={videoRef}
                            src={currentClip.videoUrl}
                            onEnded={handleVideoEnded}
                            onClick={togglePlay}
                            style={{ width: "100%", height: "100%" }} // objectFit contained or cover? Default contains.
                        />
                    ) : (
                        <div style={{ color: "#475569" }}>Timeline Empty</div>
                    )}

                    {/* Overlay Controls */}
                    <div style={{
                        position: "absolute",
                        bottom: 20,
                        left: "50%",
                        transform: "translateX(-50%)",
                        display: "flex",
                        gap: 16,
                        background: "rgba(0,0,0,0.6)",
                        padding: "8px 16px",
                        borderRadius: 999,
                        backdropFilter: "blur(4px)"
                    }}>
                        <button onClick={togglePlay} style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: 20 }}>
                            {isPlaying ? "⏸" : "▶️"}
                        </button>
                        <span style={{ color: "white", fontSize: 13, alignSelf: "center", fontVariantNumeric: "tabular-nums" }}>
                            Clip {timeline.length > 0 ? currentClipIndex + 1 : 0} / {timeline.length}
                        </span>
                    </div>
                </div>

                {/* Timeline */}
                <div style={{ height: 160, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Timeline</h2>
                        <div style={{ fontSize: 12, color: "#64748B" }}>Total Duration: {totalDuration}s</div>
                    </div>

                    <div style={{
                        flex: 1,
                        background: "#F1F5F9",
                        borderRadius: 8,
                        border: "1px solid #E2E8F0",
                        overflowX: "auto",
                        display: "flex",
                        alignItems: "center",
                        padding: "0 12px",
                        gap: 4
                    }}>
                        {timeline.length === 0 && (
                            <div style={{ margin: "0 auto", color: "#94A3B8", fontSize: 13 }}>Drag (or click) shots from bin to add here</div>
                        )}

                        {timeline.map((clip, idx) => (
                            <div
                                key={clip.uniqueId}
                                onClick={() => { setCurrentClipIndex(idx); setIsPlaying(false); }}
                                style={{
                                    flexShrink: 0,
                                    width: 120,
                                    height: 80,
                                    background: "#fff",
                                    borderRadius: 6,
                                    border: currentClipIndex === idx ? "2px solid #000" : "1px solid #CBD5E1",
                                    position: "relative",
                                    overflow: "hidden",
                                    cursor: "pointer",
                                    opacity: currentClipIndex === idx ? 1 : 0.7
                                }}
                            >
                                <img src={clip.thumbnailUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                <div style={{
                                    position: "absolute",
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    background: "rgba(0,0,0,0.7)",
                                    color: "white",
                                    fontSize: 10,
                                    padding: "2px 4px",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis"
                                }}>
                                    {idx + 1}. {clip.prompt}
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); removeFromTimeline(idx); }}
                                    style={{
                                        position: "absolute",
                                        top: 2,
                                        right: 2,
                                        background: "rgba(255,255,255,0.8)",
                                        border: "none",
                                        borderRadius: "50%",
                                        width: 16,
                                        height: 16,
                                        fontSize: 10,
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "black"
                                    }}
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}
