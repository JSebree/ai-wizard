import React, { useState, useEffect } from "react";

export default function CharacterCard({ character, onClose, onModify, onDelete }) {
  const [voices, setVoices] = useState(null);
  const [fullImage, setFullImage] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadVoices() {
      try {
        const res = await fetch('/voices.json', { cache: 'no-store' });
        if (!res.ok) {
          if (!cancelled) setVoices([]);
          return;
        }
        const raw = await res.json();
        const arr = Array.isArray(raw) ? raw : raw?.voices || [];
        const list = arr
          .map((v) => ({
            id: v.id || v.voice_id || v.tts_id || v.name || '',
            previewUrl: v.audio_url || v.preview_url || v.previewUrl || v.sample || v.demo || v.url || v.audio || null,
          }))
          .filter((v) => v.id);
        if (!cancelled) setVoices(list);
      } catch {
        if (!cancelled) setVoices([]);
      }
    }

    loadVoices();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!character) return null;

  const {
    name,
    displayName,
    base_image_url,
    referenceImageUrl,
    base_hero,
    fullbody_centered,
    fullbody_side,
    torso_front,
    headshot_front,
    headshot_right,
    headshot_left,
    voiceRefUrl,
    voicePreviewUrl,
    voiceId,
    voice_id,
    basePrompt
  } = character;

  // Primary Image Logic
  const primaryImage =
    fullImage ||
    referenceImageUrl ||
    base_image_url ||
    base_hero ||
    fullbody_centered ||
    headshot_front ||
    null;

  // Gallery
  const galleryImages = [
    { key: 'base', label: 'Reference', url: referenceImageUrl || base_image_url },
    { key: 'hero', label: 'Hero', url: base_hero },
    { key: 'head_f', label: 'Head (F)', url: headshot_front },
    { key: 'head_l', label: 'Head (L)', url: headshot_left },
    { key: 'head_r', label: 'Head (R)', url: headshot_right },
    { key: 'torso', label: 'Torso', url: torso_front },
    { key: 'full_c', label: 'Full (C)', url: fullbody_centered },
    { key: 'full_s', label: 'Full (S)', url: fullbody_side },
  ].filter((entry) => !!entry.url);

  // Voice Logic
  const presetId = voiceId || voice_id || null;
  let registryPreview = null;
  if (presetId && Array.isArray(voices)) {
    const hit = voices.find((v) => v.id === presetId);
    registryPreview = hit?.previewUrl || null;
  }

  const effectiveVoiceUrl = voiceRefUrl || voicePreviewUrl || registryPreview;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(4px)",
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1000,
          background: "white",
          borderRadius: 16,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
          boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
          animation: "fadeIn 0.2s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`@keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }`}</style>

        {/* Header */}
        <div style={{ padding: "20px 32px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Character Details</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#64748B",
              padding: 0, lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ height: "100%", overflow: "hidden" }} className="flex flex-col md:flex-row">
          <div className="flex flex-col md:flex-row h-full w-full">
            {/* Left: Visuals */}
            <div style={{
              width: "100%",
              minHeight: 350,
              maxHeight: 350,
              flexShrink: 0,
              padding: 24,
              overflowY: "auto",
              borderBottom: "1px solid #E2E8F0"
            }} className="md:w-[60%] md:flex-1 md:h-full md:max-h-full md:border-b-0 md:border-r">
              <div style={{ background: "#F8FAFC", borderRadius: 8, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 250, position: "relative", border: "1px solid #E2E8F0" }}>
                <a
                  href={primaryImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => { e.stopPropagation(); }}
                  style={{
                    position: "absolute", top: 12, left: 12,
                    background: "rgba(0,0,0,0.6)", color: "white",
                    width: 32, height: 32, borderRadius: 4,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, textDecoration: "none", cursor: "pointer",
                    zIndex: 10
                  }}
                  title="Open in new tab"
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
                  <div style={{ color: "#94A3B8" }}>No Image Created</div>
                )}
              </div>

              {/* Gallery Strip */}
              {galleryImages.length > 1 && (
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginTop: 16 }}>
                  {galleryImages.map(img => (
                    <div
                      key={img.key}
                      onClick={() => setFullImage(img.url)}
                      style={{
                        flexShrink: 0, width: 50, height: 50, borderRadius: 6, overflow: "hidden",
                        cursor: "pointer",
                        border: primaryImage === img.url ? "2px solid #000" : "1px solid #E2E8F0",
                        opacity: primaryImage === img.url ? 1 : 0.7
                      }}
                    >
                      <img src={img.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Info */}
            <div style={{
              flex: "1 1 0%",
              overflowY: "auto",
              padding: 24,
              width: "100%"
            }} className="md:w-[40%] md:flex-none">
              <h3 style={{ marginTop: 0, fontSize: 22, fontWeight: 700, marginBottom: 20, lineHeight: 1.2 }}>{displayName || name}</h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#94A3B8", marginBottom: 8 }}>Base Prompt</label>
                  <p style={{ fontSize: 13, color: "#334155", lineHeight: 1.6, margin: 0, background: "#F8FAFC", padding: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}>
                    {basePrompt || "No prompt description."}
                  </p>
                </div>

                {effectiveVoiceUrl && (
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#94A3B8", marginBottom: 8 }}>Voice Reference</label>
                    <audio controls src={effectiveVoiceUrl} style={{ width: "100%" }} />
                  </div>
                )}

                <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 20, marginTop: 8, display: "flex", justifyContent: "flex-end", gap: 12 }}>
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
                      Delete
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
                    Modify
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}