import React from "react";

export default function VodCard({ vod, onUseTemplate, onDelete, isOwner = true, onClick }) {
    // Parsing settings safely
    const settings = typeof vod.settings === "string" ? JSON.parse(vod.settings) : vod.settings;
    const rawKind = settings?.ui?.advanced?.style || "Video";
    // Truncate kind if too long
    const kind = rawKind.length > 12 ? rawKind.substring(0, 10) + ".." : rawKind;

    const isReady = vod.status === "completed" && vod.video_url;
    const isFailed = vod.status === "failed";
    const isPending = !isReady && !isFailed;

    return (
        <div
            onClick={onClick}
            style={{
                flexShrink: 0,
                width: 192, // w-48
                background: "#F8FAFC", // bg-slate-50
                border: "1px solid #E2E8F0", // border-slate-200
                borderRadius: 8,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
            }}
            className="vod-card-hover"
        >
            {/* Thumbnail Area */}
            <div style={{ aspectRatio: "16/9", background: "#000", position: "relative" }}>
                {isReady ? (
                    <video
                        src={vod.video_url}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1e293b" }}>
                        {isFailed ? (
                            <span style={{ fontSize: 24 }}>⚠️</span>
                        ) : (
                            <div className="spinner" style={{ width: 20, height: 20, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                        )}
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                )}

                {/* Status Overlay */}
                {isPending && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ color: "white", fontSize: 10, fontWeight: 700 }}>Processing...</span>
                    </div>
                )}

                {/* Duration Badge */}
                <div style={{ position: "absolute", bottom: 4, right: 4, background: "rgba(0,0,0,0.7)", color: "white", fontSize: 10, padding: "1px 4px", borderRadius: 4 }}>
                    {settings?.ui?.durationSec || 0}s
                </div>
            </div>

            {/* Content Area */}
            <div style={{ padding: 8, display: "flex", flexDirection: "column", flex: 1, gap: 8 }}>
                <h4 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#1E293B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={vod.title}>
                    {vod.title || "Untitled"}
                </h4>

                <div style={{ marginTop: "auto", display: "flex", gap: 8 }}>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onUseTemplate(vod); }}
                        disabled={!settings}
                        title="Use settings from this video"
                        style={{
                            flex: 1,
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#334155", // text-slate-700
                            border: "1px solid #E2E8F0", // border-slate-200
                            borderRadius: 4,
                            background: "white",
                            padding: "4px 0",
                            cursor: "pointer",
                        }}
                    >
                        Template
                    </button>

                    {isOwner && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onDelete && onDelete(vod); }}
                            title="Delete Video"
                            style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: "#EF4444", // text-red-500
                                border: "none",
                                background: "transparent",
                                padding: "4px 4px",
                                cursor: "pointer",
                            }}
                        >
                            Delete
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
