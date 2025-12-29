import React, { useState, useRef } from "react";

export default function ClipCard({ clip, onClose, onEdit, onDelete, onReshoot, onGenerateKeyframe, characters, registryVoices }) {
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
    const [isReshooting, setIsReshooting] = useState(false);
    const [reshootParams, setReshootParams] = useState({
        camType: 1,
        reverseCamera: false,
        zoom: 1.0,
        label: "Pan Right"
    });

    const videoRef = useRef(null);

    const CAMERA_GROUPS = [
        {
            label: "Pan & Tilt",
            options: [
                { id: 1, label: "Pan Right ➡" },
                { id: 2, label: "Pan Left ⬅" },
                { id: 3, label: "Tilt Up ⬆" },
                { id: 4, label: "Tilt Down ⬇" },
            ]
        },
        {
            label: "Zoom",
            options: [
                { id: 5, label: "Zoom In ➕" },
                { id: 6, label: "Zoom Out ➖" },
            ]
        },
        {
            label: "Advanced Moves",
            options: [
                { id: 7, label: "Crane Up ⤴" },
                { id: 8, label: "Crane Down ⤵" },
                { id: 9, label: "Orbit Left ↻" },     // Swapped icon per user feedback (was ↺)
                { id: 10, label: "Orbit Right ↺" },   // Swapped icon per user feedback (was ↻)
            ]
        }
    ];

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
                // Check if supabase global exists, otherwise skip to avoid crash
                if (typeof supabase !== 'undefined') {
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
                }
            } catch (fetchErr) {
                console.error("[v43] Failed to self-heal last_frame_url:", fetchErr);
            }
        }

        if (lastFrameUrl) {
            console.log("LOG: [v40] Using pre-generated last frame URL:", lastFrameUrl);
            try {
                // [v46] Proxy the URL to ensure we get CORS headers from Cloudflare Function
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
            }
        }

        let offscreenVideo = null;

        try {
            // [v38] Offscreen video with proxied URL (CORS-enabled)
            offscreenVideo = document.createElement('video');
            offscreenVideo.crossOrigin = "anonymous";
            offscreenVideo.preload = "auto";
            offscreenVideo.muted = true;
            offscreenVideo.playsInline = true;

            offscreenVideo.style.position = "absolute";
            offscreenVideo.style.opacity = "0.01";
            offscreenVideo.style.pointerEvents = "none";
            offscreenVideo.style.top = "-9999px";
            document.body.appendChild(offscreenVideo);

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
            const errorReason = err?.message || err?.name || (typeof err === 'string' ? err : JSON.stringify(err)) || "Unknown Error";
            alert(`[v40 - Pre-Gen Fallback] Capture Failed!\n\nError: ${errorReason}\n\nFallback Error: ${fallbackError || "N/A"}`);
        }
    };

    const handleConfirmReshoot = () => {
        if (onReshoot) {
            onReshoot(clip, reshootParams);
            setIsReshooting(false);
            onClose();
        }
    };

    // Dialogue script
    const scriptText = dBlocks?.map(d => {
        let name = d.characterName || d.speaker;
        if (!name || name === "Unknown Speaker" || name === "Unknown") {
            const idToFind = d.characterId || d.speaker_id || clip.character_id;
            const found = characters?.find(c => c.id === idToFind) || registryVoices?.find(v => v.id === idToFind);
            if (found) name = found.name;
        }
        return `${name || "Unknown"}: ${d.text}`;
    }).join("\n\n") || "No dialogue.";

    // Audio Sync Logic
    const audioRef = useRef(null);
    const audioSrc = (clip.has_audio || clip.stitched_audio_url) ? (clip.stitched_audio_url || clip.audio_url || clip.audioUrl) : null;

    // Sync play/pause/seek
    const handleVideoPlay = () => audioRef.current?.play();
    const handleVideoPause = () => audioRef.current?.pause();
    const handleVideoSeek = () => {
        if (audioRef.current && videoRef.current) {
            audioRef.current.currentTime = videoRef.current.currentTime;
        }
    };

    // Ensure volume sync (if video is muted, audio shouldn't be, generally. But if user mutes video player? 
    // Usually web video players mute both. We can just say video is visual only, audio handles sound?)
    // Actually, improved logic: If video has NO audio track, we rely on audioRef.
    // videoRef controls are sufficient for timeline.

    return (
        <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-xl p-6 w-full max-w-6xl relative flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ... (render button) ... */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8 h-full overflow-hidden">
                    {/* LEFT: PREVIEW AREA */}
                    <div className="flex flex-col gap-4 overflow-y-auto">
                        <div className="bg-black rounded-lg overflow-hidden flex items-center justify-center min-h-[400px] relative group bg-clip-border">
                            {videoSrc ? (
                                <>
                                    <video
                                        ref={videoRef}
                                        controls
                                        autoPlay
                                        loop
                                        src={videoSrc}
                                        className="w-full h-auto max-h-[60vh] z-10 relative" // Ensure z-index
                                        onPlay={handleVideoPlay}
                                        onPause={handleVideoPause}
                                        onSeeking={handleVideoSeek}
                                        onSeeked={handleVideoSeek}
                                        onWaiting={() => audioRef.current?.pause()}
                                        onPlaying={handleVideoPlay}
                                    />
                                    {/* Separate Audio Track for Reshot Clips */}
                                    {audioSrc && (
                                        <audio
                                            ref={audioRef}
                                            src={audioSrc}
                                            preload="auto"
                                            className="hidden"
                                        />
                                    )}
                                </>
                            ) : thumbSrc ? (
                                <img
                                    src={thumbSrc}
                                    alt="Thumbnail"
                                    className="w-full h-auto max-h-[60vh] object-contain"
                                />
                            ) : (
                                <div className="text-white">No Media</div>
                            )}

                            {/* Reshoot Overlay */}
                            {isReshooting && (
                                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-20 flex items-center justify-center p-8 transition-all animate-fade-in">
                                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
                                        <div className="text-center">
                                            <h3 className="text-lg font-bold text-gray-900">🎥 Reshoot Scene</h3>
                                            <p className="text-xs text-gray-500">Apply a new camera movement to this clip.</p>
                                        </div>

                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Camera Movement</label>
                                                <div className="relative">
                                                    <select
                                                        value={reshootParams.camType}
                                                        onChange={(e) => {
                                                            const id = parseInt(e.target.value);
                                                            const group = CAMERA_GROUPS.find(g => g.options.find(o => o.id === id));
                                                            const opt = group?.options.find(o => o.id === id);
                                                            if (opt) {
                                                                setReshootParams(p => ({ ...p, camType: id, label: opt.label.replace(/ .*/, '') }));
                                                            }
                                                        }}
                                                        className="w-full text-sm bg-gray-50 border border-gray-200 text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 appearance-none"
                                                    >
                                                        {CAMERA_GROUPS.map((group, gIdx) => (
                                                            <optgroup key={gIdx} label={group.label}>
                                                                {group.options.map(opt => (
                                                                    <option key={opt.id} value={opt.id}>
                                                                        {opt.label}
                                                                    </option>
                                                                ))}
                                                            </optgroup>
                                                        ))}
                                                    </select>
                                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Zoom Strength */}
                                            <div>
                                                <div className="flex justify-between items-center mb-1">
                                                    <label className="text-xs font-bold text-gray-500 uppercase">Zoom Strength</label>
                                                    <span className="text-xs font-bold text-blue-600">{reshootParams.zoom}x</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0.1"
                                                    max="2.0"
                                                    step="0.1"
                                                    value={reshootParams.zoom}
                                                    onChange={e => setReshootParams(p => ({ ...p, zoom: parseFloat(e.target.value) }))}
                                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                                />
                                                <p className="text-[10px] text-gray-400 mt-1">
                                                    Controls the speed and intensity of the camera movement. Higher values create faster, more dramatic moves.
                                                </p>
                                            </div>

                                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-gray-700">Invert Cam Direction</span>
                                                    <span className="text-[10px] text-gray-400">Play the movement path backwards</span>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={reshootParams.reverseCamera}
                                                        onChange={e => setReshootParams(p => ({ ...p, reverseCamera: e.target.checked }))}
                                                    />
                                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 pt-2">
                                            <button
                                                onClick={() => setIsReshooting(false)}
                                                className="flex-1 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleConfirmReshoot}
                                                className="flex-1 py-2 text-xs font-bold bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700"
                                            >
                                                Start Reshoot
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: DETAILS */}
                    <div className="flex flex-col h-full overflow-hidden">
                        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 leading-tight">{name || "Untitled Clip"}</h2>
                                <p className="text-sm text-gray-500 mt-1">{dateStr}</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2 block">Prompt</label>
                                    <p className="text-sm text-gray-700 bg-blue-50/50 p-3 rounded-lg border border-blue-100 leading-relaxed">
                                        {prompt}
                                    </p>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Script</label>
                                    <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100 whitespace-pre-wrap font-mono leading-relaxed max-h-[150px] overflow-y-auto">
                                        {scriptText}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* FOOTER ACTIONS */}
                        <div className="mt-6 pt-6 border-t border-gray-100 flex flex-col gap-3 shrink-0">
                            {/* Stats */}
                            <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                                <span className="flex items-center gap-1">
                                    ⏱ <b>{Number(duration).toFixed(1)}s</b>
                                </span>
                                <span className="flex items-center gap-1">
                                    🎥 <b>{motionVal || "Static"}</b>
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                {onReshoot && (
                                    <button
                                        onClick={() => setIsReshooting(true)}
                                        className="col-span-2 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-lg shadow hover:shadow-lg hover:translate-y-[-1px] transition-all flex items-center justify-center gap-2"
                                    >
                                        <span>🎥 Reshoot with Camera</span>
                                    </button>
                                )}

                                <button
                                    onClick={() => onEdit?.(clip)}
                                    className="py-2.5 bg-gray-900 text-white font-bold rounded-lg hover:bg-black transition-colors"
                                >
                                    Modify
                                </button>

                                <button
                                    onClick={() => onClose()} // Just close
                                    className="py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Close
                                </button>
                            </div>

                            {onDelete && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDelete(clip); }}
                                    className="text-xs font-bold text-red-500 hover:text-red-700 self-center"
                                >
                                    Delete Clip
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
