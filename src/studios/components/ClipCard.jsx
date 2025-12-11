import React, { useState } from "react";

export default function ClipCard({ clip, onClose, onEdit, onDelete, onGenerateKeyframe, characters, registryVoices }) {
    if (!clip) return null;

    const {
        prompt,
        duration,
        created_at,
        motion_type,
        motion, // draft fallback
        dialogue_blocks,
        dialogueBlocks, // draft fallback
        thumbnail_url,
        sceneImageUrl, // draft fallback
        name
    } = clip;

    // Robust Property Resolution
    const videoSrc = clip.video_url || clip.videoUrl;
    const speakerType = clip.speaker_type || clip.speakerType;
    const motionVal = motion_type || motion;
    const thumbSrc = thumbnail_url || sceneImageUrl;
    const dBlocks = dialogue_blocks || dialogueBlocks;

    // Format Date
    const dateStr = created_at ? new Date(created_at).toLocaleDateString() : "Draft";

    const [isCapturing, setIsCapturing] = useState(false);

    const handleCaptureFrame = async () => {
        if (!videoSrc) return;
        setIsCapturing(true);
        console.log("LOG: Starting capture for", videoSrc);

        try {
            const offscreenVideo = document.createElement('video');
            offscreenVideo.crossOrigin = "anonymous";
            offscreenVideo.preload = "auto";
            offscreenVideo.muted = true; // Critical for iOS
            offscreenVideo.playsInline = true; // Critical for iOS

            // Rewrite URL to use local proxy if it's from digitaloceanspaces
            let captureSrc = videoSrc;
            if (videoSrc.includes('media-catalog.nyc3.digitaloceanspaces.com')) {
                captureSrc = videoSrc.replace('https://media-catalog.nyc3.digitaloceanspaces.com', '/media-proxy');
            } else if (videoSrc.includes('video-generations.nyc3.digitaloceanspaces.com')) {
                captureSrc = videoSrc.replace('https://video-generations.nyc3.digitaloceanspaces.com', '/generations-proxy');
            } else if (videoSrc.includes('nyc3.digitaloceanspaces.com')) {
                captureSrc = videoSrc.replace('https://nyc3.digitaloceanspaces.com', '/video-proxy');
            }
            console.log("LOG: Using Capture Source:", captureSrc);
            offscreenVideo.src = captureSrc;

            // Wait for metadata
            await new Promise((resolve, reject) => {
                offscreenVideo.onloadedmetadata = () => {
                    console.log("LOG: Metadata loaded. Duration:", offscreenVideo.duration);
                    resolve();
                };
                offscreenVideo.onerror = (e) => {
                    console.error("LOG: Video Error (Metadata phase):", offscreenVideo.error, e);
                    reject(offscreenVideo.error || new Error("Unknown video loading error"));
                };
            });

            // Seek to near end
            const seekTime = Math.max(0, offscreenVideo.duration - 0.1);
            console.log("LOG: Seeking to:", seekTime);
            offscreenVideo.currentTime = seekTime;

            // Wait for seek
            await new Promise((resolve, reject) => {
                offscreenVideo.onseeked = () => {
                    console.log("LOG: Seek completed.");
                    resolve();
                };
                offscreenVideo.onerror = (e) => {
                    console.error("LOG: Video Error (Seek phase):", offscreenVideo.error, e);
                    reject(offscreenVideo.error);
                };
            });

            // Draw
            const canvas = document.createElement('canvas');
            canvas.width = offscreenVideo.videoWidth;
            canvas.height = offscreenVideo.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(offscreenVideo, 0, 0);
            console.log("LOG: Frame drawn to canvas.");

            canvas.toBlob((blob) => {
                console.log("LOG: Blob created. Size:", blob ? blob.size : 0);
                if (blob) {
                    onGenerateKeyframe?.(clip, blob);
                }
                setIsCapturing(false);
            }, 'image/png');

        } catch (err) {
            console.error("Frame capture failed:", err);

            // FALLBACK TO THUMBNAIL
            if (thumbSrc) {
                console.log("Video capture failed. Attempting thumbnail fallback...");
                try {
                    const blob = await captureFromImage(thumbSrc);
                    if (blob) {
                        onGenerateKeyframe?.(clip, blob);
                        setIsCapturing(false);
                        return; // Success via fallback
                    }
                } catch (fallbackErr) {
                    console.error("Thumbnail fallback failed:", fallbackErr);
                }
            }

            setIsCapturing(false);
            // Construct Detailed Error Message for User Debugging
            let captureSrcDebug = videoSrc;
            if (videoSrc.includes('media-catalog.nyc3.digitaloceanspaces.com')) {
                captureSrcDebug = videoSrc.replace('https://media-catalog.nyc3.digitaloceanspaces.com', '/media-proxy');
            } else if (videoSrc.includes('video-generations.nyc3.digitaloceanspaces.com')) {
                captureSrcDebug = videoSrc.replace('https://video-generations.nyc3.digitaloceanspaces.com', '/generations-proxy');
            } else if (videoSrc.includes('nyc3.digitaloceanspaces.com')) {
                captureSrcDebug = videoSrc.replace('https://nyc3.digitaloceanspaces.com', '/video-proxy');
            }

            const errorMsg = `[v3 - Mobile Fix]\n\nCapture Failed!\n\nReason: ${err.message || "Unknown Error"}\n\nAttempted URL: ${captureSrcDebug}\n\n(Please screenshot this for support)`;
            alert(errorMsg);
        }
    };

    // Helper to capture from image (thumbnail fallback)
    const captureFromImage = async (src) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                canvas.toBlob((blob) => resolve(blob), 'image/png');
            };
            img.onerror = (e) => reject(new Error("Thumbnail load failed"));
            img.src = src;
        });
    };

    // Dialogue script
    const scriptText = dBlocks?.map(d => {
        let name = d.characterName || d.speaker;
        // If name is missing or "Unknown Speaker", try to resolve via ID
        if (!name || name === "Unknown Speaker" || name === "Unknown") {
            const idToFind = d.characterId || d.speaker_id || clip.character_id;
            const found = characters?.find(c => c.id === idToFind) || registryVoices?.find(v => v.id === idToFind);
            if (found) name = found.name;
        }
        return `${name || "Unknown"}: ${d.text}`;
    }).join("\n\n") || "No dialogue.";

    return (
        <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
            onClick={onClose}
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 0.4)",
                backdropFilter: "blur(4px)",
                zIndex: 50,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
            }}
        >
            <div
                className="bg-white rounded-xl shadow-xl p-6 w-full max-w-4xl relative"
                onClick={(e) => e.stopPropagation()}
                style={{
                    backgroundColor: "white",
                    borderRadius: "0.75rem",
                    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                    padding: "1.5rem",
                    width: "100%",
                    maxWidth: "56rem",
                    position: "relative",
                    maxHeight: "90vh",
                    overflowY: "auto"
                }}
            >
                <button
                    className="absolute top-3 right-3 text-gray-500 hover:text-black"
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    style={{
                        position: "absolute",
                        top: "0.75rem",
                        right: "0.75rem",
                        color: "#6B7280",
                        cursor: "pointer",
                        background: "none",
                        border: "none",
                        fontSize: "1.25rem"
                    }}
                >
                    ✕
                </button>

                <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6">
                    {/* Left: Huge Preview */}
                    <div style={{ background: "#000", borderRadius: 8, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400, position: "relative" }}>
                        {/* If video exists, show it. Else show thumbnail or black. */}
                        {videoSrc ? (
                            <video
                                controls
                                src={videoSrc}
                                style={{ width: "100%", height: "auto", maxHeight: "80vh", display: "block" }}
                            />
                        ) : thumbSrc ? (
                            <img
                                src={thumbSrc}
                                alt="Clip thumbnail"
                                style={{ width: "100%", height: "auto", display: "block", maxHeight: "80vh", objectFit: "contain" }}
                            />
                        ) : (
                            <div style={{ color: "#fff", padding: 20 }}>No Video</div>
                        )}
                    </div>

                    {/* Right: Metadata */}
                    <div style={{ position: "relative" }}>
                        <h3 style={{ marginTop: 0, fontSize: 20, fontWeight: 700, marginBottom: 24, paddingRight: 30 }}>
                            {clip.name || "Untitled Clip"}
                        </h3>

                        <div style={{ display: "grid", gap: 20 }}>

                            {/* Description / Full Prompt */}
                            <div>
                                <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#94A3B8", marginBottom: 6 }}>Description</label>
                                <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.6, margin: 0, maxHeight: 100, overflowY: "auto" }}>
                                    {prompt}
                                </p>
                            </div>

                            {/* Dialogue Script */}
                            <div>
                                <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#94A3B8", marginBottom: 6 }}>Script</label>
                                <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.5, background: "#F1F5F9", padding: 10, borderRadius: 6, maxHeight: 120, overflowY: "auto", whiteSpace: "pre-wrap" }}>
                                    {scriptText}
                                </div>
                            </div>

                            {/* Attributes Table */}
                            <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 20 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                                    <span style={{ fontSize: 13, color: "#64748B" }}>Audio Status</span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: clip.has_audio ? "#16A34A" : "#94A3B8" }}>
                                        {clip.has_audio ? (
                                            (clip.speaker_type === 'on_screen' || clip.speaker_type === 'character')
                                                ? "👄 Lipsync"
                                                : "🔊 Audio Only"
                                        ) : "🔇 Silent"}
                                    </span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                                    <span style={{ fontSize: 13, color: "#64748B" }}>Duration</span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{Number(duration).toFixed(1)}s</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                                    <span style={{ fontSize: 13, color: "#64748B" }}>Speaker Type</span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", textTransform: "capitalize" }}>
                                        {speakerType === 'on_screen' ? 'CHARACTER' : (speakerType || '').replace("_", " ")}
                                    </span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                                    <span style={{ fontSize: 13, color: "#64748B" }}>Motion</span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", textTransform: "capitalize" }}>{motionVal || "None"}</span>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 20, textAlign: "right", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleCaptureFrame(); }}
                                    disabled={isCapturing}
                                    style={{
                                        padding: "8px 16px",
                                        borderRadius: 999,
                                        background: isCapturing ? "#94A3B8" : "#4F46E5",
                                        color: "white",
                                        border: "none",
                                        fontSize: 13,
                                        fontWeight: 600,
                                        cursor: isCapturing ? "wait" : "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6
                                    }}
                                >
                                    {isCapturing ? "Capturing..." : "Extend Video"}
                                </button>

                                {onDelete && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(clip);
                                        }}
                                        style={{
                                            padding: "8px 16px",
                                            borderRadius: 999,
                                            background: "white",
                                            color: "#EF4444",
                                            border: "1px solid #EF4444",
                                            fontSize: 13,
                                            fontWeight: 600,
                                            cursor: "pointer"
                                        }}
                                    >
                                        Delete
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        onEdit?.(clip);
                                    }}
                                    style={{
                                        padding: "8px 16px",
                                        borderRadius: 999,
                                        background: "#000",
                                        color: "white",
                                        border: "none",
                                        fontSize: 13,
                                        fontWeight: 600,
                                        cursor: "pointer"
                                    }}
                                >
                                    Modify
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
