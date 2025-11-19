import React, { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "sceneme.settings";

export default function SettingsStudioDemo() {
  const [name, setName] = useState("");
  const [basePrompt, setBasePrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [mood, setMood] = useState("");
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [settings, setSettings] = useState([]);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  // Live preview state
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Load saved settings from localStorage on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setSettings(parsed);
      }
    } catch (e) {
      console.warn("Failed to load settings from localStorage", e);
    }
  }, []);

  const persistSettings = (next) => {
    setSettings(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn("Failed to save settings to localStorage", e);
    }
  };

  const resetForm = () => {
    setName("");
    setBasePrompt("");
    setNegativePrompt("");
    setMood("");
    setReferenceImageUrl("");
    setUploadStatus("");
    setUploadError("");
    setPreviewImageUrl("");
    setPreviewError("");
    setError("");
  };

  const handleReferenceImageUpload = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploadError("");
      setUploadStatus("Uploading…");

      try {
        const endpoint =
          import.meta.env.VITE_UPLOAD_REFERENCE_URL ||
          "https://n8n.simplifies.click/webhook/upload-reference-image";
        if (!endpoint) {
          throw new Error(
            "Upload endpoint is not configured (VITE_UPLOAD_REFERENCE_URL)."
          );
        }

        const formData = new FormData();
        formData.append("kind", "setting");
        formData.append("name", name.trim() || "Untitled setting");
        formData.append("file", file);

        const resp = await fetch(endpoint, {
          method: "POST",
          body: formData,
        });

        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          throw new Error(`Upload failed: ${resp.status} ${text}`);
        }

        const data = await resp.json();
        const url =
          data?.publicUrl || data?.public_url || data?.url || data?.image_url;
        if (!url) {
          throw new Error("Upload response did not include a publicUrl.");
        }

        // Store the URL so it can be saved with the setting later
        setReferenceImageUrl(url);

        // Always show the freshly uploaded image in the live preview panel
        setPreviewImageUrl(url);

        setUploadStatus("Uploaded successfully — preview below.");
      } catch (err) {
        console.error(err);
        setUploadError(
          err instanceof Error
            ? err.message
            : "Failed to upload reference image."
        );
        setUploadStatus("");
      }
    },
    [name]
  );

  const handleSave = () => {
    if (!name.trim()) {
      setError("Setting name is required.");
      return;
    }
    if (!basePrompt.trim()) {
      setError("Base prompt is required.");
      return;
    }

    const now = new Date().toISOString();

    const newSetting = {
      id: `setting_${Date.now()}`,
      name: name.trim(),              // maps to settings_name
      basePrompt: basePrompt.trim(),  // maps to base_prompt
      negativePrompt: negativePrompt.trim() || undefined,
      mood: mood.trim() || undefined,
      referenceImageUrl: referenceImageUrl.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    const next = [...settings, newSetting];
    persistSettings(next);
    resetForm();
  };

  const handleDelete = (id) => {
    const next = settings.filter((s) => s.id !== id);
    persistSettings(next);
    if (expandedId === id) {
      setExpandedId(null);
    }
  };

  const handleGeneratePreview = useCallback(async () => {
    setPreviewError("");

    if (!basePrompt.trim()) {
      setPreviewError("Base prompt is required to generate a preview.");
      return;
    }

    setIsGenerating(true);
    try {
      // TODO: Replace this with your real settings preview endpoint.
      // For example: import.meta.env.VITE_SETTINGS_PREVIEW_URL
      const endpoint = import.meta.env.VITE_SETTINGS_PREVIEW_URL || "";
      if (!endpoint) {
        throw new Error("Preview endpoint is not configured (VITE_SETTINGS_PREVIEW_URL).");
      }

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: basePrompt.trim(),
          negative_prompt: negativePrompt.trim() || "",
          mood: mood.trim() || "",
          reference_image_url: referenceImageUrl.trim() || undefined,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Preview request failed: ${resp.status} ${text}`);
      }

      const data = await resp.json();
      const url =
        data?.image_url ||
        data?.preview_url ||
        (Array.isArray(data?.images) ? data.images[0] : null);

      if (!url) {
        throw new Error("Preview response did not include an image_url.");
      }

      setPreviewImageUrl(url);
    } catch (err) {
      console.error(err);
      setPreviewError(err instanceof Error ? err.message : "Failed to generate preview.");
      setPreviewImageUrl("");
    } finally {
      setIsGenerating(false);
    }
  }, [basePrompt, negativePrompt, mood, referenceImageUrl]);

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
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Settings workspace</h2>
        <p style={{ marginTop: 0, marginBottom: 16, color: "#64748B", fontSize: 14 }}>
          Define reusable environments for your stories. These settings can later be converted
          directly into payloads for your n8n workflows, including base prompts and negative
          prompts for your T2I / I2I models.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          {/* Preview panel */}
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 10,
              border: "1px dashed #CBD5E1",
              background: "#F9FAFB",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
                Live preview
              </span>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>
                Uses base prompt, negative prompt, and optional reference image
              </span>
            </div>
            {previewError && (
              <p style={{ margin: 0, marginBottom: 6, fontSize: 11, color: "#B91C1C" }}>
                {previewError}
              </p>
            )}
            {isGenerating && (
              <p style={{ margin: 0, fontSize: 12, color: "#64748B" }}>
                Generating preview image…
              </p>
            )}
            {!isGenerating && previewImageUrl && (
              <div
                style={{
                  marginTop: 6,
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "1px solid #E5E7EB",
                  display: "inline-block",
                  maxWidth: "100%",
                }}
              >
                <img
                  src={previewImageUrl}
                  alt="Setting preview"
                  style={{
                    display: "block",
                    maxWidth: "100%",
                    height: "auto",
                  }}
                />
              </div>
            )}
            {!isGenerating && !previewImageUrl && !previewError && (
              <p style={{ margin: 0, fontSize: 11, color: "#9CA3AF" }}>
                No preview yet. Enter a base prompt and click “Generate preview” to see a sample
                render of this setting.
              </p>
            )}
          </div>

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
              onChange={handleReferenceImageUpload}
              style={{
                width: "100%",
                padding: 8,
                borderRadius: 8,
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
              }}
            />
            {uploadStatus && (
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 11,
                  color: "#15803D",
                }}
              >
                {uploadStatus}
              </p>
            )}
            {uploadError && (
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 11,
                  color: "#B91C1C",
                }}
              >
                {uploadError}
              </p>
            )}
            {referenceImageUrl && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  color: "#64748B",
                }}
              >
                Current image:{" "}
                <a
                  href={referenceImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#0369A1" }}
                >
                  Open in new tab
                </a>
              </div>
            )}
          </div>

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
              placeholder="A high-ceiling loft with exposed beams, large daylight windows, a fabric sectional sofa, bookshelves, plants, framed art, and a wooden coffee table with light clutter..."
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

          <div>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              Negative prompt (optional)
            </label>
            <textarea
              rows={3}
              placeholder="fisheye warping, surreal lighting, cartoon colors, mirrored symmetry, clutter overload..."
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #CBD5E1",
                resize: "vertical",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              Mood (optional)
            </label>
            <input
              type="text"
              placeholder="cozy, cinematic, moody, bright..."
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #CBD5E1",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              Setting name *
            </label>
            <input
              type="text"
              placeholder="Loft, Lake platform, Train station..."
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

          {error && (
            <p style={{ margin: 0, fontSize: 12, color: "#B91C1C" }}>{error}</p>
          )}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 4,
              alignItems: "center",
            }}
          >
            <button
              type="button"
              onClick={handleSave}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid #111827",
                background: "#111827",
                color: "#FFFFFF",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Save setting
            </button>
            <button
              type="button"
              onClick={resetForm}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #E5E7EB",
                background: "#FFFFFF",
                color: "#374151",
                fontWeight: 500,
                fontSize: 13,
              }}
            >
              Clear form
            </button>
            <button
              type="button"
              onClick={handleGeneratePreview}
              disabled={isGenerating}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #0369A1",
                background: isGenerating ? "#E0F2FE" : "#F0F9FF",
                color: "#0C4A6E",
                fontWeight: 500,
                fontSize: 13,
              }}
            >
              {isGenerating ? "Generating preview…" : "Generate preview"}
            </button>
          </div>
        </div>
      </section>

      {/* Saved settings list */}
      <section
        style={{
          border: "1px solid #E5E7EB",
          borderRadius: 12,
          padding: 16,
          background: "#FFFFFF",
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>Saved settings</h3>
        {settings.length === 0 ? (
          <p style={{ marginTop: 0, color: "#9CA3AF", fontSize: 13 }}>
            No settings saved yet. Create a setting above to start your environments library.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {settings.map((s) => (
              <div
                key={s.id}
                style={{
                  border: "1px solid #E5E7EB",
                  borderRadius: 10,
                  padding: 10,
                  background: "#F9FAFB",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        marginBottom: 2,
                      }}
                    >
                      {s.name}
                    </div>
                    {s.basePrompt && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#6B7280",
                          marginBottom: 2,
                          maxHeight: 40,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {s.basePrompt}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: 11,
                        color: "#9CA3AF",
                      }}
                    >
                      Created: {new Date(s.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId((prev) => (prev === s.id ? null : s.id))
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
                      {expandedId === s.id ? "Hide JSON" : "View JSON"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id)}
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
                {expandedId === s.id && (
                  <pre
                    style={{
                      marginTop: 8,
                      fontSize: 11,
                      background: "#111827",
                      color: "#E5E7EB",
                      padding: 8,
                      borderRadius: 8,
                      overflowX: "auto",
                    }}
                  >
                    {JSON.stringify(s, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}