import React, { useState } from "react";

export default function KeyframeCard({ scene, onClose, onModify, onDelete }) {
    const [fullImage, setFullImage] = useState(null);

    if (!scene) return null;

    const {
        name,
        imageUrl,
        prompt,
        setting_name,
        character_name,
        prop_name,
        color_grade,
        visual_style,
        camera_angle,
        createdAt,
    } = scene;

    function handleClose() {
        setFullImage(null);
        onClose?.();
    }

    return (
        <>
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
                onClick={handleClose}
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
                        onClick={(e) => { e.stopPropagation(); handleClose(); }}
                        style={{
                            position: "absolute",
                            top: "0.75rem",
                            right: "0.75rem",
                            color: "#6B7280",
                            cursor: "pointer",
                            background: "none",
                            border: "none",
                            fontSize: "1.25rem",
                            zIndex: 10
                        }}
                    >
                        ✕
                    </button>

                    {/* Delete Button (Trash Icon) */}


                    {/* Use flex column for mobile, flex row for desktop */}
                    <div style={{ height: "100%", overflow: "hidden" }} className="flex flex-col md:flex-row">
                        {/* Top/Left: Preview */}
                        <div style={{
                            width: "100%",
                            minHeight: 350, // Fixed height on mobile
                            maxHeight: 350,
                            flexShrink: 0,
                            background: "#000",
                            borderRadius: 8,
                            overflow: "hidden",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            position: "relative"
                        }} className="md:w-auto md:flex-1 md:h-full md:max-h-full md:min-h-0">
                            <a
                                href={imageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open full resolution"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    position: "absolute",
                                    top: 10,
                                    left: 10,
                                    textDecoration: "none",
                                    color: "white",
                                    fontSize: 18,
                                    background: "rgba(0,0,0,0.5)",
                                    width: 32,
                                    height: 32,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    borderRadius: 4
                                }}
                            >
                                ⤢
                            </a>
                            {imageUrl ? (
                                <img
                                    src={imageUrl}
                                    alt={name}
                                    style={{ width: "100%", height: "auto", display: "block", maxHeight: "80vh", objectFit: "contain" }}
                                />
                            ) : (
                                <div style={{ color: "#fff", padding: 20 }}>No Image</div>
                            )}
                        </div>

                        {/* Bottom/Right: Metadata */}
                        <div style={{
                            flex: "1 1 0%",
                            overflowY: "auto",
                            paddingTop: 24,
                            width: "100%"
                        }} className="md:w-[320px] md:flex-none md:pl-6 md:pt-0">
                            <h3 style={{ marginTop: 0, fontSize: 20, fontWeight: 700, marginBottom: 24, paddingRight: 30 }}>{name}</h3>

                            <div style={{ display: "grid", gap: 20 }}>
                                <div>
                                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#94A3B8", marginBottom: 6 }}>Description</label>
                                    <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.6, margin: 0 }}>{prompt}</p>
                                </div>

                                <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 20 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                                        <span style={{ fontSize: 13, color: "#64748B" }}>Setting</span>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{setting_name || "Unknown"}</span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                                        <span style={{ fontSize: 13, color: "#64748B" }}>Character</span>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{character_name || "Unknown"}</span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                                        <span style={{ fontSize: 13, color: "#64748B" }}>Prop</span>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{prop_name || "None"}</span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                                        <span style={{ fontSize: 13, color: "#64748B" }}>Color Grade</span>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{color_grade || "None"}</span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                                        <span style={{ fontSize: 13, color: "#64748B" }}>Camera</span>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{camera_angle || "Standard"}</span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <span style={{ fontSize: 13, color: "#64748B" }}>Visual Style</span>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{visual_style || "Photorealistic"}</span>
                                    </div>
                                </div>
                                <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 20, display: "flex", justifyContent: "flex-end", gap: 12 }}>
                                    {onDelete && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation(); // Prevent closing?
                                                onDelete();
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
                                            onMouseEnter={e => {
                                                e.currentTarget.style.background = "#FEF2F2";
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.background = "white";
                                            }}
                                        >
                                            Delete Keyframe
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            onModify?.();
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
                                        Modify Keyframe
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
