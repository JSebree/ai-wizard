import React, { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import SettingCard from "./components/SettingCard";

const STORAGE_KEY = "sceneme.settings";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

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
  const [copiedId, setCopiedId] = useState(null);
  const [selectedSetting, setSelectedSetting] = useState(null);

  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState("");

  const fileInputRef = useRef(null);

  // Live preview state
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Load saved settings from Supabase or localStorage on mount, and poll for updates
  useEffect(() => {
    let cancelled = false;

    const loadFromLocalStorage = () => {
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
    };

    const loadFromSupabase = async () => {
      // If Supabase client is not configured, fall back to localStorage
      if (!supabase) {
        loadFromLocalStorage();
        return;
      }

      try {
        const { data, error } = await supabase
          .from("setting")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (!Array.isArray(data) || cancelled) return;

        const mapped = data.map((row) => ({
          id: row.id,
          name: row.name,
          basePrompt: row.core_prompt,
          negativePrompt: null,
          mood: row.mood,
          referenceImageUrl: row.base_image_url,
          base_image_url: row.base_image_url,
          base_hero: row.base_hero,
          scene_n: row.scene_n,
          scene_ne: row.scene_ne,
          scene_e: row.scene_e,
          scene_se: row.scene_se,
          scene_s: row.scene_s,
          scene_sw: row.scene_sw,
          scene_w: row.scene_w,
          scene_nw: row.scene_nw,
          establishing_overhead: row.establishing_overhead,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));

        setSettings(mapped);

        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
        } catch (e) {
          console.warn("Failed to save settings to localStorage", e);
        }
      } catch (err) {
        console.error("Failed to load settings from Supabase", err);
        // On error, fall back to whatever is in localStorage
        loadFromLocalStorage();
      }
    };

    // Initial load
    loadFromSupabase();

    // Poll every 20 seconds so new expanded views appear automatically
    const intervalId = window.setInterval(() => {
      loadFromSupabase();
    }, 20000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
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
    setRegisterError("");
    // Note: we intentionally do NOT clear registerSuccess here so the user
    // can still see the "logged" confirmation after the form resets.
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const registerSettingInRegistry = async ({
    id,
    name,
    corePrompt,
    mood,
    baseImageUrl,
  }) => {
    setRegisterError("");
    setRegisterSuccess("");
    setIsRegistering(true);

    try {
      const endpoint =
        import.meta.env.VITE_REGISTER_SETTING_URL ||
        "https://n8n.simplifies.click/webhook/webhook/register-setting";

      const payload = {
        id,
        name,
        core_prompt: corePrompt,
        mood: mood || null,
        base_image_url: baseImageUrl,
        kind: "setting",
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Registry call failed with status ${res.status}`);
      }

      // Success
      setRegisterSuccess("Setting successfully added to the shared registry.");
    } catch (err) {
      console.error("Failed to register setting", err);
      setRegisterError(
        err instanceof Error
          ? err.message
          : "Failed to register setting in shared catalog.",
      );
    } finally {
      setIsRegistering(false);
    }
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

  const handleSave = async () => {
    const rawName = name.trim();
    const rawPrompt = basePrompt.trim();
    const rawMood = mood.trim();

    if (!rawName) {
      setError("Setting name is required.");
      return;
    }
    if (!rawPrompt) {
      setError("Base prompt is required.");
      return;
    }

    // Prefer the current preview image; fall back to the last uploaded reference image
    const imageUrl = (previewImageUrl || referenceImageUrl.trim() || "").trim();
    if (!imageUrl) {
      setError("Generate or upload a reference image before saving this setting.");
      return;
    }

    setError("");

    // Replace spaces with underscores for workflow-safe naming
    const safeName = rawName.replace(/\s+/g, "_");
    const now = new Date().toISOString();
    const id = `setting_${Date.now()}`;

    const newSetting = {
      id,
      name: safeName,               // maps to settings_name
      basePrompt: rawPrompt,        // maps to base_prompt
      negativePrompt: negativePrompt.trim() || undefined,
      mood: rawMood || undefined,
      referenceImageUrl: imageUrl,
      createdAt: now,
      updatedAt: now,
    };

    const next = [...settings, newSetting];
    persistSettings(next);

    // 1) Register this setting in the shared registry (Supabase)
    try {
      await registerSettingInRegistry({
        id,
        name: safeName,
        corePrompt: rawPrompt,
        mood: rawMood,
        baseImageUrl: imageUrl,
      });
    } catch (err) {
      // registerSettingInRegistry already sets error state; don't block expansion on failure
      console.error("Registry registration failed (continuing to expansion):", err);
    }

    // 2) Fire-and-forget expansion workflow in n8n so it can render additional views
    try {
      const expansionEndpoint =
        import.meta.env.VITE_SETTING_EXPANSION_URL ||
        "https://n8n.simplifies.click/webhook/generate-setting-expansion";

      const expansionPayload = {
        id,
        name: safeName,
        base_prompt: rawPrompt,
        negative_prompt: negativePrompt.trim() || "",
        mood: rawMood || null,
        base_image_url: imageUrl,
        kind: "setting",
      };

      void fetch(expansionEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(expansionPayload),
      }).catch((err) => {
        console.error("Failed to trigger setting expansion workflow", err);
      });
    } catch (err) {
      console.error("Unexpected error while triggering setting expansion workflow", err);
    }

    resetForm();
  };

  const handleDelete = (id) => {
    const next = settings.filter((s) => s.id !== id);
    persistSettings(next);
  };

  const handleCopyJson = (setting) => {
    try {
      const text = JSON.stringify(setting, null, 2);
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
        setCopiedId(setting.id);
        setTimeout(() => {
          setCopiedId((current) => (current === setting.id ? null : current));
        }, 1500);
      }
    } catch (e) {
      console.warn("Failed to copy JSON to clipboard", e);
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
      // Prefer VITE_SETTINGS_PREVIEW_URL, otherwise fallback to n8n webhook
      const endpoint =
        import.meta.env.VITE_SETTINGS_PREVIEW_URL ||
        "https://n8n.simplifies.click/webhook/generate-setting-preview";

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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 4 }}>Settings workspace</h2>
            <p
              style={{
                marginTop: 0,
                marginBottom: 0,
                color: "#64748B",
                fontSize: 14,
              }}
            >
              Define reusable environments for your stories. These settings can later be converted
              directly into payloads for your n8n workflows, including base prompts and negative
              prompts for your T2I / I2I models.
            </p>
          </div>
          <button
            type="button"
            onClick={resetForm}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              color: "#4B5563",
              fontSize: 12,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Clear form
          </button>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {/* Preview panel */}
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 10,
              border: "1px solid #CBD5E1",
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
              <p
                style={{
                  margin: 0,
                  marginBottom: 6,
                  fontSize: 11,
                  color: "#B91C1C",
                }}
              >
                {previewError}
              </p>
            )}

            <div
              style={{
                marginTop: 6,
                borderRadius: 8,
                overflow: "hidden",
                border: "1px solid #0F172A",
                background: "#0F172A",
                minHeight: 180,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isGenerating ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "999px",
                      border: "3px solid #1F2937",
                      borderTopColor: "#E5E7EB",
                      boxSizing: "border-box",
                    }}
                  />
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: "#E5E7EB",
                    }}
                  >
                    Generating preview image…
                  </p>
                </div>
              ) : previewImageUrl ? (
                <img
                  src={previewImageUrl}
                  alt="Setting preview"
                  style={{
                    display: "block",
                    width: "100%",
                    height: "auto",
                    objectFit: "contain",
                  }}
                />
              ) : (
                !previewError && (
                  <p
                    style={{
                      margin: 16,
                      fontSize: 11,
                      color: "#E5E7EB",
                      textAlign: "center",
                    }}
                  >
                    No preview yet. Enter a base prompt and click {" "}
                    <strong>Generate new setting</strong> to see a sample render of this
                    environment.
                  </p>
                )
              )}
            </div>

            {!isGenerating && previewImageUrl && (
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!name.trim() || !basePrompt.trim() || isRegistering}
                  title={
                    !name.trim()
                      ? "Enter a setting name to add this to your library"
                      : undefined
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid #0F172A",
                    background: "#0F172A",
                    color: "#FFFFFF",
                    fontSize: 12,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: 14 }}>＋</span>
                  <span>
                    {isRegistering ? "Saving to catalog…" : "Add to saved settings"}
                  </span>
                </button>
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
              Reference image (optional)
            </label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: "1px solid #0F172A",
                  background: "#0F172A",
                  color: "#F9FAFB",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Choose file
              </button>
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleReferenceImageUpload}
              ref={fileInputRef}
              style={{ display: "none" }}
            />
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
          {registerError && (
            <p style={{ margin: 0, fontSize: 12, color: "#B91C1C" }}>
              {registerError}
            </p>
          )}
          {registerSuccess && (
            <p style={{ margin: 0, fontSize: 12, color: "#059669" }}>
              {registerSuccess}
            </p>
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
              onClick={handleGeneratePreview}
              disabled={isGenerating}
              style={{
                padding: "10px 16px",
                borderRadius: 999,
                border: "1px solid #0F172A",
                background: "#0F172A",
                color: "#FFFFFF",
                fontWeight: 500,
                fontSize: 13,
                cursor: isGenerating ? "default" : "pointer",
              }}
            >
              {isGenerating ? "Generating new setting…" : "Generate new setting"}
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
              <div key={s.id} style={{ display: "grid", gap: 4 }}>
                <div
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
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                    onClick={() => setSelectedSetting(s)}
                  >
                    <div
                      style={{
                        width: 80,
                        height: 60,
                        borderRadius: 6,
                        overflow: "hidden",
                        border: "1px solid #E5E7EB",
                        background: "#E5E7EB",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {s.referenceImageUrl ? (
                        <img
                          src={s.referenceImageUrl}
                          alt={s.name || "Setting thumbnail"}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            fontSize: 10,
                            color: "#9CA3AF",
                            padding: 4,
                            textAlign: "center",
                          }}
                        >
                          No image
                        </span>
                      )}
                    </div>
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
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId((current) => (current === s.id ? null : s.id));
                      }}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1px solid #D1D5DB",
                        background: "#FFFFFF",
                        color: "#374151",
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      {expandedId === s.id ? "Hide JSON" : "View JSON"}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyJson(s);
                      }}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1px solid #0369A1",
                        background: "#EFF6FF",
                        color: "#0369A1",
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      {copiedId === s.id ? "Copied!" : "Copy JSON"}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(s.id);
                      }}
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
                      margin: 0,
                      padding: 10,
                      borderRadius: 8,
                      border: "1px solid #E5E7EB",
                      background: "#0F172A",
                      color: "#E5E7EB",
                      fontSize: 11,
                      overflowX: "auto",
                      whiteSpace: "pre",
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
      {selectedSetting && (
        <SettingCard
          setting={selectedSetting}
          onClose={() => setSelectedSetting(null)}
        />
      )}
    </div>
  );
}