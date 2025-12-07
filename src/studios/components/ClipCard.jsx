import React from "react";

export default function ClipCard({ clip, onClose, onEdit, onDelete }) {
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

    // Dialogue script
    const scriptText = dBlocks?.map(d => `${d.characterName || d.speaker || "Unknown"}: ${d.text}`).join("\n\n") || "No dialogue.";

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
                                    <span style={{ fontSize: 13, color: "#64748B" }}>Created</span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{dateStr}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                                    <span style={{ fontSize: 13, color: "#64748B" }}>Duration</span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{Number(duration).toFixed(1)}s</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                                    <span style={{ fontSize: 13, color: "#64748B" }}>Speaker Type</span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", textTransform: "capitalize" }}>{speakerType?.replace("_", " ")}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                                    <span style={{ fontSize: 13, color: "#64748B" }}>Motion</span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", textTransform: "capitalize" }}>{motionVal || "None"}</span>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 20, textAlign: "right", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                                {onDelete && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm("Are you sure you want to delete this clip?")) onDelete(clip.id);
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
