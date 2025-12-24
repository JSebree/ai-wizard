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
    const videoRef = React.useRef(null);

    // Helper: Rewrite URL to use local proxy if it's from digitaloceanspaces
    const getProxiedUrl = (url) => {
        if (!url) return "";
        let newUrl = url;
        if (url.includes('media-catalog.nyc3.digitaloceanspaces.com')) {
            newUrl = url.replace('https://media-catalog.nyc3.digitaloceanspaces.com', '/media-proxy');
        } else if (url.includes('video-generations.nyc3.digitaloceanspaces.com')) {
            newUrl = url.replace('https://video-generations.nyc3.digitaloceanspaces.com', '/generations-proxy');
        } else if (url.includes('a-roll-output.nyc3.digitaloceanspaces.com')) {
            newUrl = url.replace('https://a-roll-output.nyc3.digitaloceanspaces.com', '/last-frames-proxy');
        } else if (url.includes('nyc3.digitaloceanspaces.com')) {
            newUrl = url.replace('https://nyc3.digitaloceanspaces.com', '/video-proxy');
        }
        return newUrl;
    };

    const handleCaptureFrame = async () => {
        if (!videoSrc) return;
        setIsCapturing(true);
        console.log("LOG: Starting capture for", videoSrc);

        // [v40] Use pre-generated last frame URL if available
        // [v43] Self-Healing: Check prop, if missing, FETCH from DB
        let lastFrameUrl = clip.last_frame_url || clip.lastFrameUrl;

        if (!lastFrameUrl && clip.id && !String(clip.id).startsWith('local_')) {
            console.log("[v43] last_frame_url missing in prop. Fetching from Supabase...");
            try {
                const { data, error } = await supabase
                    .from('clips')
                    .select('last_frame_url')
                    .eq('id', clip.id)
                    .single();

                if (data && data.last_frame_url) {
                    console.log("[v43] Fetched fresh last_frame_url:", data.last_frame_url);
                    lastFrameUrl = data.last_frame_url;
                } else {
                    console.warn("[v43] Fetch returned no URL:", error || "Null data");
                }
            } catch (fetchErr) {
                console.error("[v43] Failed to self-heal last_frame_url:", fetchErr);
            }
        }

        if (lastFrameUrl) {
            console.log("LOG: [v40] Using pre-generated last frame URL:", lastFrameUrl);
            try {
                // [v46] Proxy the URL to ensure we get CORS headers from Cloudflare Function
                // This is crucial because raw Bucket URLs might not send ACAO: *
                const proxiedLastFrame = getProxiedUrl(lastFrameUrl);
                console.log("LOG: [v46] Proxied Last Frame:", proxiedLastFrame);

                const blob = await captureFromImage(proxiedLastFrame);
                if (blob) {
                    onGenerateKeyframe?.(clip, blob);
                    setIsCapturing(false);
                    return;
                }
            } catch (err) {
                console.warn("Pre-generated last frame failed, falling back to extraction:", err);

                // Silent fallback

            }
            // [v45] Consolidate Fallback Logic
            // If direct fetch failed, and we are here, we try thumbnail fallback ONE MORE TIME 
            // (or just rely on the previous attempt if lastFrameUrl was null)

            // Check if we already tried lastFrameUrl and failed...
            // Actually, if lastFrameUrl was present but failed, we haven't tried thumbnail yet.
            // So let's try thumbnail now if we haven't.

            // [v45] Mobile check removed to allow video extraction fallback on all devices
        }


        // [v45] Legacy v40 block removed.
        // If we are on Desktop, we continue to offscreen extraction below...


        let offscreenVideo = null;

        try {
            // [v38] Offscreen video with proxied URL (CORS-enabled)
            offscreenVideo = document.createElement('video');
            offscreenVideo.crossOrigin = "anonymous";
            offscreenVideo.preload = "auto";
            offscreenVideo.muted = true;
            offscreenVideo.playsInline = true;

            // DOM attachment for mobile (unused now due to safety net, kept for desktop robustness)
            offscreenVideo.style.position = "absolute";
            offscreenVideo.style.opacity = "0.01";
            offscreenVideo.style.pointerEvents = "none";
            offscreenVideo.style.top = "-9999px";
            document.body.appendChild(offscreenVideo);

            // ... (rest of offscreen logic)

            // Use proxied URL (has CORS headers)
            let captureSrc = videoSrc;
            if (videoSrc.includes('nyc3.digitaloceanspaces.com')) {
                captureSrc = getProxiedUrl(videoSrc);
            }

            console.log("LOG: [v38] Using proxied URL:", captureSrc);
            offscreenVideo.src = captureSrc;
            offscreenVideo.load();

            // Wait for metadata
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error("Metadata timeout")), 10000);
                offscreenVideo.onloadedmetadata = () => {
                    clearTimeout(timeout);
                    console.log("LOG: [v38] Metadata loaded. Duration:", offscreenVideo.duration);
                    resolve();
                };
                offscreenVideo.onerror = (e) => {
                    clearTimeout(timeout);
                    reject(offscreenVideo.error || new Error("Metadata load error"));
                };
            });

            const seekTime = Math.max(0, offscreenVideo.duration - 0.1);
            console.log(`[v38] Seeking to: ${seekTime}s (Duration: ${offscreenVideo.duration}s)`);

            offscreenVideo.currentTime = seekTime;

            await new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    console.warn(`[v38] Seek timed out. Capturing current frame (${offscreenVideo.currentTime}s)`);
                    resolve();
                }, 5000);

                offscreenVideo.onseeked = () => {
                    clearTimeout(timeout);
                    console.log("[v38] Seek completed successfully");
                    resolve();
                };
                offscreenVideo.onerror = () => {
                    clearTimeout(timeout);
                    console.warn("[v38] Seek error");
                    resolve();
                };
            });

            // Draw
            const canvas = document.createElement('canvas');
            canvas.width = offscreenVideo.videoWidth;
            canvas.height = offscreenVideo.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(offscreenVideo, 0, 0);

            canvas.toBlob((blob) => {
                if (blob) onGenerateKeyframe?.(clip, blob);
                if (offscreenVideo && offscreenVideo.parentNode) document.body.removeChild(offscreenVideo);
                setIsCapturing(false);
            }, 'image/png');

        } catch (err) {
            console.error("Frame capture failed:", err);

            // Cleanup
            if (offscreenVideo && offscreenVideo.parentNode) {
                document.body.removeChild(offscreenVideo);
            }

            // FALLBACK TO THUMBNAIL
            let fallbackError = null;
            if (thumbSrc) {
                console.log("Video capture failed. Attempting thumbnail fallback...");
                try {
                    const proxiedThumb = getProxiedUrl(thumbSrc);
                    const separator = proxiedThumb.includes('?') ? '&' : '?';
                    const cacheBustedThumb = `${proxiedThumb}${separator}_t=${Date.now()}`;

                    console.log("Fallback Local Proxied Thumb:", cacheBustedThumb);
                    const blob = await captureFromImage(cacheBustedThumb);
                    if (blob) {
                        onGenerateKeyframe?.(clip, blob);
                        setIsCapturing(false);
                        alert(`[v40] Warning: Precise Capture Failed.\n\nReason: ${err.message}\n\nUsing Thumbnail (First Frame) as fallback.`);
                        return;
                    }
                } catch (fallbackErr) {
                    console.error("Thumbnail fallback failed:", fallbackErr);
                    fallbackError = fallbackErr.message;
                }
            }

            setIsCapturing(false);
            let captureSrcDebug = videoSrc;
            // ... debug logic ...

            const errorReason = err?.message || err?.name || (typeof err === 'string' ? err : JSON.stringify(err)) || "Unknown Error";
            const errorMsg = `[v40 - Pre-Gen Fallback] Capture Failed!\n\nError: ${errorReason}\n\nFallback Error: ${fallbackError || "N/A"}\n\nThumb Present: ${thumbSrc ? "Yes" : "No"}`;
            alert(errorMsg);
        }
    };



    // Helper to capture from image (thumbnail fallback)
    const captureFromImage = async (src) => {
        try {
            console.log("Fetching fallback image:", src);
            // [v32] Added Timeout to Fallback Fetch (5s) to prevent hangs
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 5000);

            const res = await fetch(src, { signal: controller.signal });
            clearTimeout(id);

            if (!res.ok) {
                // Inspect error body [v12]
                const text = await res.text().catch(() => "");
                throw new Error(`Fetch failed: ${res.status} ${res.statusText} for ${src}\nBody: ${text.substring(0, 100)}`);
            }
            // Check content type
            const type = res.headers.get("content-type");
            if (type && type.includes("text/html")) {
                throw new Error(`Proxy Error: Received HTML instead of image from ${src}`);
            }
            const blob = await res.blob();
            return blob;
        } catch (err) {
            console.error("Fallback Error:", err);
            throw err; // Re-throw to allow parent to handle [v14]
        }
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
                        {/* [v64] Debug Dot for Last Frame URL */}
                        <div
                            title={clip.last_frame_url || clip.lastFrameUrl ? "Last Frame URL Ready" : "Last Frame URL Missing"}
                            style={{
                                position: "absolute",
                                top: 10,
                                left: 10,
                                width: 12,
                                height: 12,
                                borderRadius: "50%",
                                zIndex: 100,
                                background: clip.last_frame_url || clip.lastFrameUrl ? "#22c55e" : "#ef4444",
                                boxShadow: clip.last_frame_url || clip.lastFrameUrl ? "0 0 8px rgba(34, 197, 94, 0.8)" : "0 0 8px rgba(239, 68, 68, 0.8)",
                                border: "1px solid white",
                                cursor: "help"
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                alert(`Debug Last Frame:\n\nURL: ${clip.last_frame_url || clip.lastFrameUrl || "NULL"}\n\nID: ${clip.id}`);
                            }}
                        />
                        {/* If video exists, show it. Else show thumbnail or black. */}
                        {videoSrc ? (
                            <video
                                ref={videoRef}
                                controls
                                src={videoSrc} // DIRECT URL (Restores Playback)
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
