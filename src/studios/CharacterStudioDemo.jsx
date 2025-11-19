import React, { useState, useEffect } from "react";
import VoiceStep from "../interview/steps/VoiceStep.jsx";

const STORAGE_KEY = "sceneme.characters";

export default function CharacterStudioDemo() {
  const [name, setName] = useState("");
  const [basePrompt, setBasePrompt] = useState("");
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [characters, setCharacters] = useState([]);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  // Live preview + upload state
  const [previewUrl, setPreviewUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Load saved characters from localStorage on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setCharacters(parsed);
      }
    } catch (e) {
      console.warn("Failed to load characters from localStorage", e);
    }
  }, []);

  const persistCharacters = (next) => {
    setCharacters(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn("Failed to save characters to localStorage", e);
    }
  };

  const resetForm = () => {
    setName("");
    setBasePrompt("");
    setReferenceImageUrl("");
    setVoiceId("");
    setError("");
    setPreviewUrl("");
    setUploadError("");
  };

  // Upload reference image to n8n / DO Spaces staging
  const handleReferenceUpload = async (file) => {
    if (!file) return;
    setUploadError("");
    setIsUploading(true);

    try {
      const endpoint =
        import.meta.env.VITE_UPLOAD_REFERENCE_URL ||
        "https://n8n.simplifies.click/webhook/upload-reference-image";

      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", "character");
      // name is optional at this point; user can still be exploring
      if (name.trim()) {
        formData.append("name", name.trim());
      }

      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Upload failed with status ${res.status}`);
      }

      const data = await res.json();
      const urlFromApi =
        data?.publicUrl ||
        data?.normalized?.publicUrl ||
        data?.url ||
        "";

      if (!urlFromApi) {
        throw new Error("Upload succeeded, but no public URL was returned.");
      }

      setReferenceImageUrl(urlFromApi);
      setPreviewUrl(urlFromApi);
    } catch (err) {
      console.error("Character reference upload failed", err);
      setUploadError(
        err instanceof Error ? err.message : "Upload failed. Please try again."
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      setError("Character name is required.");
      return;
    }
    if (!basePrompt.trim()) {
      setError("Base prompt is required.");
      return;
    }

    const now = new Date().toISOString();

    const newCharacter = {
      id: `char_${Date.now()}`,
      name: name.trim(),
      basePrompt: basePrompt.trim(),
      referenceImageUrl: referenceImageUrl.trim() || undefined,
      voiceId: voiceId.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    const next = [...characters, newCharacter];
    persistCharacters(next);
    resetForm();
  };

  const handleDelete = (id) => {
    const next = characters.filter((c) => c.id !== id);
    persistCharacters(next);
    if (expandedId === id) {
      setExpandedId(null);
    }
  };

  // For now, "Generate new character" is a UX affordance that could later
  // wire into an image / model endpoint. Here it just validates base prompt.
  const handleGeneratePreview = () => {
    if (!basePrompt.trim()) {
      setError("Base prompt is required before generating a new character.");
      return;
    }
    setError("");
    // In the future, hook this up to your T2I / pose model.
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Form section */}
      <section
        style={{
          border: "1px solid #E5E7EB",
          borderRadius: 12,
          padding: 16,
          background: "#FFFFFF",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 4 }}>Character workspace</h2>
            <p
              style={{
                margin: 0,
                color: "#64748B",
                fontSize: 14,
                maxWidth: 640,
              }}
            >
              Capture the core of a reusable character: how they look, who they are, and how they
              sound. These definitions can later be wired into your image, video, and voice
              pipelines.
            </p>
          </div>
          <button
            type="button"
            onClick={resetForm}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              color: "#374151",
              fontSize: 13,
            }}
          >
            Clear form
          </button>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          {/* Live preview */}
          <div
            style={{
              borderRadius: 10,
              border: "1px solid #E5E7EB",
              background: "#F9FAFB",
              padding: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600 }}>Live preview</span>
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                Uses base prompt and optional reference image
              </span>
            </div>
            <div
              style={{
                borderRadius: 8,
                overflow: "hidden",
                border: "1px solid #E5E7EB",
                background: "#0F172A",
                minHeight: 180,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Character preview"
                  style={{
                    display: "block",
                    width: "100%",
                    height: "auto",
                    objectFit: "contain",
                  }}
                />
              ) : (
                <p style={{ color: "#9CA3AF", fontSize: 13, margin: 16 }}>
                  No preview yet. Upload a reference image or click{" "}
                  <strong>Generate new character</strong> once wired into your model endpoint.
                </p>
              )}
            </div>
          </div>

          {/* Reference image uploader */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              Reference image (optional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleReferenceUpload(e.target.files?.[0] || null)}
              style={{
                display: "block",
                width: "100%",
                padding: 8,
                borderRadius: 8,
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
              }}
            />
            {isUploading && (
              <p style={{ marginTop: 4, fontSize: 12, color: "#6B7280" }}>
                Uploading reference image…
              </p>
            )}
            {!isUploading && previewUrl && !uploadError && (
              <p style={{ marginTop: 4, fontSize: 12, color: "#16A34A" }}>
                Uploaded successfully — preview above.
              </p>
            )}
            {uploadError && (
              <p style={{ marginTop: 4, fontSize: 12, color: "#B91C1C" }}>{uploadError}</p>
            )}
          </div>

          {/* Base prompt */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              Base prompt *
            </label>
            <textarea
              rows={5}
              placeholder="A confident young Black woman with shoulder-length natural curls shaped into a rounded silhouette..."
              value={basePrompt}
              onChange={(e) => setBasePrompt(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #CBD5E1",
                resize: "vertical",
              }}
            />
          </div>

          {/* Character name at the bottom so users can explore first */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              Character name *
            </label>
            <input
              type="text"
              placeholder="Ari, Mira, Bezzie..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #CBD5E1",
              }}
            />
          </div>

          {/* Voice selector */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              Voice (optional)
            </label>
            <div
              style={{
                borderRadius: 8,
                border: "1px solid #CBD5E1",
                padding: 8,
                background: "#020617",
              }}
            >
              <VoiceStep
                value={voiceId}
                onChange={(id) => {
                  if (typeof id === "string") {
                    setVoiceId(id);
                  } else if (id && typeof id === "object" && id.voiceId) {
                    setVoiceId(id.voiceId);
                  }
                }}
                className="text-xs"
              />
            </div>
            <p style={{ marginTop: 4, fontSize: 11, color: "#9CA3AF" }}>
              The selected voice id is stored on this character and can be passed directly into your
              TTS pipeline.
            </p>
          </div>

          {error && (
            <p style={{ margin: 0, fontSize: 12, color: "#B91C1C" }}>{error}</p>
          )}

          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 4,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={handleGeneratePreview}
              style={{
                padding: "10px 16px",
                borderRadius: 999,
                border: "1px solid #111827",
                background: "#111827",
                color: "#FFFFFF",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Generate new character
            </button>
            <button
              type="button"
              onClick={handleSave}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid #111827",
                background: "#FFFFFF",
                color: "#111827",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 18,
                  height: 18,
                  borderRadius: "999px",
                  border: "1px solid #111827",
                  fontSize: 12,
                  lineHeight: 1,
                }}
              >
                +
              </span>
              <span>Add to saved characters</span>
            </button>
          </div>
        </div>
      </section>

      {/* Saved characters list */}
      <section
        style={{
          border: "1px solid #E5E7EB",
          borderRadius: 12,
          padding: 16,
          background: "#FFFFFF",
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>Saved characters</h3>
        {characters.length === 0 ? (
          <p style={{ marginTop: 0, color: "#9CA3AF", fontSize: 13 }}>
            No characters saved yet. Create a character above to start your library.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {characters.map((c) => (
              <div
                key={c.id}
                style={{
                  border: "1px solid #E5E7EB",
                  borderRadius: 10,
                  padding: 10,
                  background: "#F9FAFB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {c.referenceImageUrl ? (
                    <div
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 8,
                        overflow: "hidden",
                        border: "1px solid #E5E7EB",
                        background: "#0F172A",
                        flexShrink: 0,
                      }}
                    >
                      <img
                        src={c.referenceImageUrl}
                        alt={c.name}
                        style={{
                          display: "block",
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 8,
                        border: "1px dashed #D1D5DB",
                        background: "#F3F4F6",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        color: "#9CA3AF",
                        flexShrink: 0,
                      }}
                    >
                      No image
                    </div>
                  )}
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        marginBottom: 2,
                      }}
                    >
                      {c.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#9CA3AF",
                      }}
                    >
                      Created: {new Date(c.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId((prev) => (prev === c.id ? null : c.id))
                    }
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      border: "1px solid #D1D5DB",
                      background: "#FFFFFF",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    {expandedId === c.id ? "Hide JSON" : "View JSON"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      border: "1px solid #FCA5A5",
                      background: "#FEF2F2",
                      color: "#B91C1C",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}