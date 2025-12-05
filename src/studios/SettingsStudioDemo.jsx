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

  const handleModifySetting = (setting) => {
    setName(setting.name || "");
    setBasePrompt(setting.basePrompt || "");
    setNegativePrompt(setting.negativePrompt || "");
    setMood(setting.mood || "");

    // Choose the best image to show as preview/reference
    const img = setting.base_hero || setting.referenceImageUrl || setting.base_image_url;
    setReferenceImageUrl(img || "");
    setPreviewImageUrl(img || "");

    setSelectedSetting(null); // Close modal if open
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const handleGeneratePreview = useCallback(async () => {
    setPreviewError("");

    if (!basePrompt.trim()) {
      setPreviewError("Base prompt is required to generate a preview.");
      return;
    }

    setIsGenerating(true);
    try {
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
    <div style={{ paddingBottom: 60 }}>
      {/* Header (Matching Scene Studio) */}
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Setting Studio</h2>
        <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>
          Define reusable environments and locations. Create a base setting for your stories.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {/* Form */}
        <section style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 20, background: "#FFFFFF" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Create Setting</h3>
            {name || basePrompt ? (
              <button
                type="button"
                onClick={resetForm}
                style={{ fontSize: 11, color: "#64748B", background: "none", border: "1px solid #E2E8F0", borderRadius: 4, padding: "2px 6px", cursor: "pointer" }}
              >
                Reset
              </button>
            ) : null}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#334155" }}>
                Setting Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Victorian Loft"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                  fontSize: 14,
                  outline: "none",
                  background: "#F8FAFC"
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#334155" }}>
                Core Prompt *
              </label>
              <textarea
                rows={3}
                placeholder="Describe the environment..."
                value={basePrompt}
                onChange={(e) => setBasePrompt(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                  fontSize: 14,
                  outline: "none",
                  resize: "vertical",
                  background: "#F8FAFC"
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#334155" }}>
                Mood <span style={{ fontWeight: 400, color: "#94A3B8" }}>(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Cinematic, Gloomy"
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                  fontSize: 14,
                  outline: "none",
                  background: "#F8FAFC"
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#334155" }}>
                Reference Image <span style={{ fontWeight: 400, color: "#94A3B8" }}>(Optional)</span>
              </label>
              <label style={{
                border: "1px dashed #CBD5E1",
                borderRadius: 8,
                padding: 16,
                textAlign: "center",
                cursor: "pointer",
                background: "#F8FAFC",
                display: "block"
              }}>
                <span style={{ fontSize: 12, color: "#64748B", fontWeight: 500 }}>
                  {uploadStatus || "Click to upload reference"}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleReferenceImageUpload}
                  style={{ display: "none" }}
                />
              </label>
            </div>
          </div>

          {/* Errors & Status */}
          {(error || uploadError || registerError) && (
            <div style={{ marginTop: 16, padding: "8px 12px", borderRadius: 6, background: "#FEF2F2", color: "#B91C1C", fontSize: 12 }}>
              {error || uploadError || registerError}
            </div>
          )}

          {registerSuccess && (
            <div style={{ marginTop: 16, padding: "8px 12px", borderRadius: 6, background: "#ECFDF5", color: "#059669", fontSize: 12 }}>
              {registerSuccess}
            </div>
          )}

          <div style={{ marginTop: 24 }}>
            <button
              onClick={handleGeneratePreview}
              disabled={isGenerating || !name.trim() || !basePrompt.trim()}
              title={(!name.trim() || !basePrompt.trim()) ? "Please enter a Name and Prompt first" : ""}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 999,
                background: (isGenerating || !name.trim() || !basePrompt.trim()) ? "#94A3B8" : "#000",
                color: "white",
                fontWeight: 600,
                fontSize: 14,
                border: "none",
                cursor: (isGenerating || !name.trim() || !basePrompt.trim()) ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8
              }}
            >
              {isGenerating && (
                <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", animation: "spin 1s linear infinite" }} />
              )}
              {isGenerating ? "Generating..." : "Generate Preview"}
            </button>

            <style>{`
                        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                    `}</style>
          </div>
        </section>

        {/* Preview Box */}
        <div style={{
          position: "relative",
          minHeight: 400,
          background: "#F1F5F9",
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid #E2E8F0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}>
          {previewImageUrl ? (
            <div style={{ width: "100%", height: "100%", position: "relative" }}>
              <img src={previewImageUrl} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "contain", background: "black" }} />
            </div>
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#CBD5E1", gap: 12 }}>
              <div style={{ fontSize: 24 }}>🏔️</div>
              <div style={{ fontSize: 14 }}>Preview will appear here</div>
            </div>
          )}

          {isGenerating && (
            <div style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              flexDirection: "column",
              gap: 12,
              backdropFilter: "blur(2px)"
            }}>
              <div style={{ width: 32, height: 32, border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>AI is crafting your setting...</span>
            </div>
          )}
        </div>

        {/* Save Action */}
        {previewImageUrl && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -16 }}>
            <button
              onClick={handleSave}
              disabled={!name.trim() || isRegistering}
              style={{
                padding: "10px 24px",
                borderRadius: 999,
                background: !name.trim() ? "#94A3B8" : "#000",
                color: "white",
                fontSize: 14,
                fontWeight: 600,
                border: "none",
                cursor: !name.trim() ? "not-allowed" : "pointer",
              }}
            >
              {name.trim() ? "Save Setting" : "Name required"}
            </button>
          </div>
        )}

        {/* Saved Settings Grid */}
        <section style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 20, background: "#FFFFFF" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px" }}>Saved Settings</h3>
          {settings.length === 0 ? (
            <p style={{ fontSize: 13, color: "#94A3B8" }}>No settings saved yet.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
              {settings.map(setting => {
                const thumb = setting.referenceImageUrl || setting.base_hero || setting.base_image_url;
                return (
                  <div
                    key={setting.id}
                    onClick={() => setSelectedSetting(setting)}
                    style={{
                      border: "1px solid #E2E8F0",
                      borderRadius: 8,
                      overflow: "hidden",
                      background: "#F8FAFC",
                      cursor: "pointer",
                      transition: "transform 0.1s ease-in-out"
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"}
                    onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                  >
                    <div style={{ aspectRatio: "16/9", background: "#E2E8F0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {thumb ? (
                        <img src={thumb} alt={setting.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span style={{ fontSize: 24, opacity: 0.3 }}>🏞️</span>
                      )}
                    </div>
                    <div style={{ padding: 12 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{setting.name}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleModifySetting(setting); }}
                          style={{ fontSize: 11, color: "#000", background: "none", border: "1px solid #E2E8F0", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}
                        >
                          Modify
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(setting.id); }}
                          style={{ fontSize: 11, color: "#EF4444", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {selectedSetting && (
        <SettingCard
          setting={selectedSetting}
          onClose={() => setSelectedSetting(null)}
          onModify={() => handleModifySetting(selectedSetting)}
        />
      )}
    </div>
  );
}