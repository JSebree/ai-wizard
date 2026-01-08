import React, { useState, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { getProxiedUrl } from "../../config/api";

export default function ClipCard({ clip, onClose, onEdit, onDelete, onReshoot, onAddSFX, onGenerateKeyframe, characters, settings, registryVoices }) {
    if (!clip) return null;
    const { user, isAdmin } = useAuth();

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

    const [isAddSFXOpen, setIsAddSFXOpen] = useState(false);
    const [sfxPrompt, setSfxPrompt] = useState(clip.sfx_prompt || "");
    const [autoSFX, setAutoSFX] = useState(true);
    const [isSFXGenerating, setIsSFXGenerating] = useState(false);

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
                // [v50] Optimization: If we have a URL, pass it directly to skip re-upload
                // The parent component (ClipStudioDemo) will handle the string vs blob check.
                console.log("LOG: [v50] Passing existing last_frame_url directly:", lastFrameUrl);
                onGenerateKeyframe?.(clip, lastFrameUrl);
                setIsCapturing(false);
                return;
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

    // --- Metadata Resolution ---
    const characterName = characters?.find(c => c.id === clip.character_id || c.id === clip.characterId)?.name || "Unknown";
    const settingName = settings?.find(s => s.id === clip.setting_id || s.id === clip.settingId)?.name || "Unknown";
    const cameraLabel = clip.camera_angle || clip.cameraLabel || "Standard";
    const visualStyle = "Photorealistic"; // Default for now


    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in p-4 md:p-8"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] lg:h-[85vh] flex flex-col lg:flex-row overflow-hidden relative"
                onClick={(e) => e.stopPropagation()}
            >
                {/* CLOSE BUTTON (Absolute Top Right) */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-50 p-2 bg-white/10 hover:bg-black/10 rounded-full transition-colors text-gray-500 hover:text-black"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* LEFT: MEDIA (Video/Image) */}
                <div className="w-full lg:w-3/5 min-h-[300px] shrink-0 bg-black flex items-center justify-center relative group">
                    {/* Expand/Reset Icons could go here if needed, keeping it clean for now */}

                    {videoSrc ? (
                        <video
                            ref={videoRef}
                            controls
                            loop
                            src={getProxiedUrl(videoSrc)}
                            crossOrigin="anonymous"
                            className="w-full h-full object-contain"
                        />
                    ) : thumbSrc ? (
                        <img src={thumbSrc} alt="Thumbnail" className="w-full h-full object-contain" />
                    ) : (
                        <div className="text-white text-sm">No Media Available</div>
                    )}

                    {/* Reshoot Overlay (Over Video) -> Now Fixed Fullscreen for Mobile */}
                    {isReshooting && (
                        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-8 animate-fade-in">
                            <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl space-y-4">
                                <div className="text-center mb-4">
                                    <h3 className="text-lg font-bold text-gray-900">🎥 Reshoot Scene</h3>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Camera Movement</label>
                                        <select
                                            value={reshootParams.camType}
                                            onChange={(e) => {
                                                const id = parseInt(e.target.value);
                                                const group = CAMERA_GROUPS.find(g => g.options.find(o => o.id === id));
                                                const opt = group?.options.find(o => o.id === id);
                                                if (opt) setReshootParams(p => ({ ...p, camType: id, label: opt.label.replace(/ .*/, '') }));
                                            }}
                                            className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg p-2.5"
                                        >
                                            {CAMERA_GROUPS.map((group, gIdx) => (
                                                <optgroup key={gIdx} label={group.label}>
                                                    {group.options.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-xs font-bold text-gray-500 uppercase">Movement Strength</label>
                                            <span className="text-xs font-bold text-blue-600">{reshootParams.zoom}x</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0.1" max="2.0" step="0.1"
                                            value={reshootParams.zoom}
                                            onChange={e => setReshootParams(p => ({ ...p, zoom: parseFloat(e.target.value) }))}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                        />
                                        <p className="text-[10px] text-gray-400 mt-1">
                                            Controls the speed and intensity of the camera movement. Higher values create faster, more dramatic moves.
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-100">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-gray-700">Invert Cam Direction</span>
                                            <span className="text-[10px] text-gray-400">Play the movement path backwards</span>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" className="sr-only peer" checked={reshootParams.reverseCamera} onChange={e => setReshootParams(p => ({ ...p, reverseCamera: e.target.checked }))} />
                                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <button onClick={() => setIsReshooting(false)} className="flex-1 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                                    <button onClick={handleConfirmReshoot} className="flex-1 py-2 text-xs font-bold bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700">Start Reshoot</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT: INFO PANEL */}
                <div className="w-full lg:w-2/5 flex flex-col h-full bg-white relative z-10 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-8">
                        {/* Header */}
                        <div className="mb-6 pr-8"> {/* Padding right for close button */}
                            <h2 className="text-2xl font-bold text-gray-900 leading-tight mb-1">{name || "Untitled Clip"}</h2>
                            {dateStr && <p className="text-xs text-gray-400 uppercase tracking-wide">{dateStr}</p>}
                        </div>

                        {/* Description */}
                        <div className="mb-8">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description</h3>
                            <p className="text-gray-700 leading-relaxed text-sm">
                                {prompt || "No description provided."}
                            </p>
                        </div>

                        <hr className="border-gray-100 mb-8" />

                        {/* Metadata Grid */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                                <span className="text-gray-500 font-medium">Setting</span>
                                <span className="text-gray-900 font-bold">{settingName}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                                <span className="text-gray-500 font-medium">Character</span>
                                <span className="text-gray-900 font-bold">{characterName}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                                <span className="text-gray-500 font-medium">Prop</span>
                                <span className="text-gray-900 font-bold">None</span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                                <span className="text-gray-500 font-medium">Color Grade</span>
                                <span className="text-gray-900 font-bold">None</span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                                <span className="text-gray-500 font-medium">Camera</span>
                                <span className="text-gray-900 font-bold">{cameraLabel}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                                <span className="text-gray-500 font-medium">Visual Style</span>
                                <span className="text-gray-900 font-bold">{visualStyle}</span>
                            </div>
                            {/* SFX Prompt - Only show if clip has been enhanced with SFX */}
                            {(clip.sfx_prompt || clip.sfxPrompt) && (
                                <div className="flex justify-between items-start text-sm border-b border-gray-50 pb-2">
                                    <span className="text-gray-500 font-medium">🔊 SFX</span>
                                    <span className="text-gray-900 font-bold text-right max-w-[200px] truncate" title={clip.sfx_prompt || clip.sfxPrompt}>
                                        {clip.sfx_prompt || clip.sfxPrompt}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-8 pt-4 bg-white border-t border-gray-100 shrink-0">
                        {/* Button Grid */}
                        <div className="flex flex-col gap-3">
                            <div className="flex gap-3">
                                {/* Reshoot */}
                                {onReshoot && (
                                    <button
                                        onClick={() => setIsReshooting(true)}
                                        disabled={parseFloat(duration) > 3.4}
                                        className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2
                                            ${parseFloat(duration) > 3.4
                                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"}`}
                                        title={parseFloat(duration) > 3.4 ? "Reshoot limited to clips under 3.4s" : "Reshoot with Camera"}
                                    >
                                        <span>🎥 Reshoot</span>
                                    </button>
                                )}

                                {/* Add SFX */}
                                {onAddSFX && (
                                    <button
                                        onClick={() => setIsAddSFXOpen(true)}
                                        disabled={isSFXGenerating}
                                        className="flex-1 py-3 px-4 bg-white border border-gray-200 text-gray-700 font-bold text-sm rounded-lg hover:bg-gray-50 hover:border-gray-300 shadow-sm transition-all flex items-center justify-center gap-2"
                                    >
                                        <span>{isSFXGenerating ? "🔊 Adding..." : "🔊 Add SFX"}</span>
                                    </button>
                                )}

                                {/* Extend */}
                                {onGenerateKeyframe && (
                                    <button
                                        onClick={handleCaptureFrame}
                                        disabled={isCapturing}
                                        className="flex-1 py-3 px-4 bg-white border border-gray-200 text-gray-700 font-bold text-sm rounded-lg hover:bg-gray-50 hover:border-gray-300 shadow-sm transition-all flex items-center justify-center gap-2"
                                    >
                                        {isCapturing ? "Capturing..." : "➕ Extend"}
                                    </button>
                                )}
                            </div>

                            <div className="flex gap-3">
                                {/* Delete */}
                                {onDelete && user && (clip.user_id === user.id || isAdmin) && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDelete(clip); }}
                                        className="flex-1 py-3 px-4 bg-white border border-red-200 text-red-600 font-bold text-sm rounded-lg hover:bg-red-50 hover:border-red-300 transition-all"
                                    >
                                        Delete Clip
                                    </button>
                                )}

                                {/* Modify */}
                                {onEdit && (
                                    <button
                                        onClick={() => onEdit(clip)}
                                        className="flex-1 py-3 px-4 bg-black text-white font-bold text-sm rounded-lg hover:bg-gray-900 shadow-lg hover:shadow-xl transition-all"
                                    >
                                        Modify Clip
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* SFX Overlay */}
            {
                isAddSFXOpen && (
                    <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-8 animate-fade-in" onClick={() => setIsAddSFXOpen(false)}>
                        <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
                            <div className="text-center mb-4">
                                <h3 className="text-lg font-bold text-gray-900">🔊 Add Sound Effects</h3>
                                <p className="text-xs text-gray-400 mt-1">Describe the sound effects you want to add.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center bg-gray-50 rounded-lg p-3 border border-gray-100 mb-3">
                                    <span className="text-sm font-medium text-gray-700">Auto SFX</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={autoSFX}
                                            onChange={e => setAutoSFX(e.target.checked)}
                                        />
                                        <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${autoSFX ? 'bg-blue-500' : 'bg-gray-300'}`}>
                                            <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${autoSFX ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </div>
                                    </label>
                                </div>

                                <textarea
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:border-black outline-none transition-colors"
                                    rows={3}
                                    placeholder={autoSFX ? "Optional: Auto-generates from video..." : "Enter prompt to enable SFX..."}
                                    value={sfxPrompt}
                                    onChange={e => setSfxPrompt(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setIsAddSFXOpen(false)}
                                    className="flex-1 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg"
                                    disabled={isSFXGenerating}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        setIsSFXGenerating(true);
                                        try {
                                            await onAddSFX(clip, sfxPrompt);
                                            setIsAddSFXOpen(false);
                                        } catch (err) {
                                            alert("Failed to add SFX: " + err.message);
                                        } finally {
                                            setIsSFXGenerating(false);
                                        }
                                    }}
                                    disabled={isSFXGenerating || (!autoSFX && !sfxPrompt.trim())}
                                    className="flex-1 py-2 text-xs font-bold bg-black text-white rounded-lg shadow hover:bg-gray-900 disabled:opacity-50"
                                >
                                    {isSFXGenerating ? "Processing..." : "Add SFX"}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Keeping ClipToDelete logic if it was rendered outside this block in parent, but here the modal is the preview, deletion confirm is separate */}
        </div >
    );
}
