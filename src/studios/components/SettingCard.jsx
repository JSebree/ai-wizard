import React, { useState } from 'react';

export default function SettingCard({ setting, onClose, onModify, onDelete }) {
  const [fullImage, setFullImage] = useState(null);

  if (!setting) return null;

  const {
    name,
    basePrompt,
    core_prompt,
    mood,
    base_image_url,
    baseImageUrl,
    base_hero,
    baseHero,
    referenceImageUrl,
    reference_image_url,
    scene_n,
    scene_ne,
    scene_e,
    scene_se,
    scene_s,
    scene_sw,
    scene_w,
    scene_nw,
    establishing_overhead,
    status,
  } = setting;

  const resolvedBaseImage =
    base_hero ||
    baseHero ||
    base_image_url ||
    baseImageUrl ||
    referenceImageUrl ||
    reference_image_url ||
    null;

  // Choose a primary image to display as the main thumbnail
  const primaryImage =
    fullImage ||
    resolvedBaseImage ||
    scene_n ||
    scene_e ||
    scene_s ||
    scene_w ||
    scene_ne ||
    scene_se ||
    scene_sw ||
    scene_nw ||
    establishing_overhead ||
    null;

  // All images we might have for this setting
  const galleryImages = [
    { key: 'base', label: 'Base image', url: resolvedBaseImage },
    { key: 'scene_n', label: 'North', url: scene_n },
    { key: 'scene_ne', label: 'North-east', url: scene_ne },
    { key: 'scene_e', label: 'East', url: scene_e },
    { key: 'scene_se', label: 'South-east', url: scene_se },
    { key: 'scene_s', label: 'South', url: scene_s },
    { key: 'scene_sw', label: 'South-west', url: scene_sw },
    { key: 'scene_w', label: 'West', url: scene_w },
    { key: 'scene_nw', label: 'North-west', url: scene_nw },
    { key: 'establishing_overhead', label: 'Overhead', url: establishing_overhead },
  ].filter((entry) => !!entry.url);

  const displayPrompt = basePrompt || core_prompt || "";

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        backdropFilter: "blur(4px)",
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "white",
          borderRadius: "1rem",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          padding: "0",
          width: "100%",
          maxWidth: "1000px", // Reverted to wider modal per user feedback
          position: "relative",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Setting Details</h2>
          <button
            onClick={onClose}
            style={{
              color: "#64748B",
              cursor: "pointer",
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              lineHeight: 1,
              padding: 0
            }}
          >
            ×
          </button>
        </div>

        <div style={{ height: "100%", overflow: "hidden" }} className="flex flex-col md:flex-row">
          <div className="flex flex-col md:flex-row h-full w-full">
            {/* Left: Preview + Gallery */}
            <div style={{
              width: "100%",
              minHeight: 350,
              maxHeight: 350,
              flexShrink: 0,
              padding: 24,
              overflowY: "auto",
              borderBottom: "1px solid #E2E8F0"
            }} className="md:w-[60%] md:flex-1 md:h-full md:max-h-full md:border-b-0 md:border-r">
              {/* Reduced minHeight and maxHeight to help content fit vertically */}
              <div style={{ background: "#000", borderRadius: 8, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 250, position: "relative" }}>
                <a
                  href={primaryImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open full resolution"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    textDecoration: "none",
                    color: "white",
                    fontSize: 18,
                    background: "rgba(0,0,0,0.5)",
                    width: 32,
                    height: 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 4,
                    zIndex: 10
                  }}
                >
                  ⤢
                </a>
                {primaryImage ? (
                  <img
                    src={primaryImage}
                    alt={name}
                    style={{ width: "100%", height: "auto", display: "block", maxHeight: "40vh", objectFit: "contain" }}
                  />
                ) : (
                  <div style={{ color: "#fff", padding: 20 }}>No Image</div>
                )}
              </div>

              {/* Gallery Strip */}
              {galleryImages.length > 1 && (
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                  {galleryImages.map((img) => (
                    <div
                      key={img.key}
                      onClick={() => setFullImage(img.url)}
                      style={{
                        flexShrink: 0,
                        width: 50,
                        height: 50,
                        borderRadius: 6,
                        overflow: "hidden",
                        cursor: "pointer",
                        border: primaryImage === img.url ? "2px solid #000" : "1px solid #E2E8F0",
                        opacity: primaryImage === img.url ? 1 : 0.7
                      }}
                    >
                      <img src={img.url} alt={img.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Right: Metadata */}
          <div style={{
            flex: "1 1 0%",
            overflowY: "auto",
            padding: 24,
            width: "100%"
          }} className="md:w-[280px] md:flex-none">
            <h3 style={{ marginTop: 0, fontSize: 20, fontWeight: 700, marginBottom: 20, paddingRight: 30 }}>{name}</h3>

            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#94A3B8", marginBottom: 6 }}>Prompt</label>
                <p style={{ fontSize: 13, color: "#334155", lineHeight: 1.5, margin: 0, background: "#F8FAFC", padding: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}>
                  {displayPrompt || "No prompt"}
                </p>
              </div>

              <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: "#64748B" }}>Mood</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{mood || "None"}</span>
                </div>
              </div>
              <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 20, textAlign: "right", display: "flex", justifyContent: "flex-end", gap: 12 }}>
                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                    style={{
                      padding: "8px 20px",
                      borderRadius: 999,
                      background: "white",
                      color: "#EF4444",
                      border: "1px solid #EF4444",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Delete Setting
                  </button>
                )}
                <button
                  onClick={() => {
                    onModify?.();
                  }}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 999,
                    background: "#000",
                    color: "white",
                    border: "none",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
                  }}
                >
                  Modify Setting
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}