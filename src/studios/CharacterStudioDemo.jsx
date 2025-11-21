import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import VoiceStep from "../interview/steps/VoiceStep.jsx";
import CharacterCard from "./components/CharacterCard.jsx";

const STORAGE_KEY = "sceneme.characters";

// Supabase client (anon key from .env.local)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
    
export default function CharacterStudioDemo() {
  const [name, setName] = useState("");
  const [basePrompt, setBasePrompt] = useState("");
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [voiceKind, setVoiceKind] = useState("preset"); // 'preset' | 'character'
  const [voicePreviewUrl, setVoicePreviewUrl] = useState("");
  const [characters, setCharacters] = useState([]);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [activeCharacter, setActiveCharacter] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState("");
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  // Live preview + upload state
  const [previewUrl, setPreviewUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Voice upload state (for user-recorded / uploaded voices)
  const [isVoiceUploading, setIsVoiceUploading] = useState(false);
  const [voiceUploadError, setVoiceUploadError] = useState("");
  const [voiceUploadInfo, setVoiceUploadInfo] = useState(null);

  // Recording state for in-browser voice capture
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState("");
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

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

  // Keep characters in sync with Supabase so new expansion URLs show up automatically
  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;
    let intervalId;

    async function fetchCharactersFromSupabase() {
      try {
        const { data, error } = await supabase
          .from("characters")
          .select("*")
          .eq("is_public", true)
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (!cancelled && Array.isArray(data)) {
          const mapped = data.map((row) => ({
            id: row.id,
            name: row.name,
            basePrompt: row.base_prompt || "",
            // Use base_image_url as the primary thumbnail; fall back to base_hero
            referenceImageUrl: row.base_image_url || row.base_hero || null,
            voiceId: row.voice_id || "",
            voiceRefUrl: row.voice_ref_url || null,
            createdAt: row.created_at || row.createdAt || null,
            updatedAt: row.updated_at || row.updatedAt || null,

            // Extra views used by CharacterCard gallery
            base_image_url: row.base_image_url || null,
            base_hero: row.base_hero || null,
            fullbody_centered: row.fullbody_centered || null,
            fullbody_side: row.fullbody_side || null,
            torso_front: row.torso_front || null,
            headshot_front: row.headshot_front || null,
            headshot_right: row.headshot_right || null,
            headshot_left: row.headshot_left || null,
          }));

          setCharacters(mapped);
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
          } catch (e) {
            console.warn("Failed to cache characters from Supabase", e);
          }
        }
      } catch (e) {
        console.error("Failed to fetch characters from Supabase", e);
      }
    }

    // Initial load
    fetchCharactersFromSupabase();
    // Poll every 15 seconds so newly-expanded image URLs show up automatically
    intervalId = window.setInterval(fetchCharactersFromSupabase, 15000);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  // Register character in shared Supabase registry via n8n
  const registerCharacterInRegistry = async (payload) => {
    setRegisterError("");
    setRegisterSuccess("");
    setIsRegistering(true);

    try {
      const res = await fetch(
        "https://n8n.simplifies.click/webhook/webhook/register-character",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Registry call failed with status ${res.status}`);
      }

      const data = await res.json().catch(() => ({}));

      const displayName =
        payload.name ||
        data.name ||
        payload.id ||
        data.id ||
        "character";

      setRegisterSuccess(
        `Character "${displayName}" successfully added to the shared registry.`
      );
    } catch (err) {
      console.error("Character registry call failed", err);
      setRegisterError(
        err instanceof Error
          ? err.message
          : "Failed to add character to registry."
      );
    } finally {
      setIsRegistering(false);
    }
  };

  // Fire-and-forget expansion workflow to fan out character assets
  const triggerCharacterExpansion = async (payload) => {
    try {
      await fetch(
        "https://n8n.simplifies.click/webhook/generate-character-expansion",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );
    } catch (err) {
      console.error("Character expansion call failed", err);
      // We intentionally do not surface this to the user yet; the
      // base character save + registry write are the primary UX.
    }
  };

  const resetForm = () => {
    setName("");
    setBasePrompt("");
    setReferenceImageUrl("");
    setVoiceId("");
    setVoiceKind("preset");
    setVoicePreviewUrl("");
    setError("");
    setPreviewUrl("");
    setUploadError("");
    setVoiceUploadError("");
    setVoiceUploadInfo(null);
    setIsRecording(false);
    setRecordedBlob(null);
    if (recordedUrl) {
      try {
        URL.revokeObjectURL(recordedUrl);
      } catch {}
    }
    setRecordedUrl("");
    setRegisterError("");
  };
  // Upload a recorded/selected voice file to n8n / DO Spaces staging
  const handleVoiceUpload = async (file) => {
    if (!file) return;
    setVoiceUploadError("");
    setVoiceUploadInfo(null);
    setIsVoiceUploading(true);

    try {
      const endpoint =
        import.meta.env.VITE_UPLOAD_REFERENCE_URL ||
        "https://n8n.simplifies.click/webhook/upload-reference-image";

      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", "voice");

      // Use character name as a base for the voice label if available
      const fileBaseName = file.name
        ? file.name.replace(/\.[^/.]+$/, "")
        : "custom_voice";
      const rawLabel = (name && name.trim()) || fileBaseName;
      formData.append("name", rawLabel);

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

      // Derive a workflow-safe voice id (spaces -> underscores)
      const safeVoiceId = rawLabel
        .normalize("NFKD")
        .replace(/[\u0300-\u036F]/g, "")
        .trim()
        .replace(/\s+/g, "_");

      // Mark this as a character-scoped voice and remember a preview URL
      setVoiceKind("character");
      if (urlFromApi) {
        setVoicePreviewUrl(urlFromApi);
      } else if (recordedUrl) {
        setVoicePreviewUrl(recordedUrl);
      }

      // Store this voice id on the character so pipelines can use it
      setVoiceId(safeVoiceId);
      setVoiceUploadInfo({ voiceId: safeVoiceId, url: urlFromApi || undefined });
    } catch (err) {
      console.error("Voice upload failed", err);
      setVoiceUploadError(
        err instanceof Error ? err.message : "Voice upload failed. Please try again."
      );
    } finally {
      setIsVoiceUploading(false);
    }
  };

  // Start in-browser audio recording using MediaRecorder
  const startRecording = async () => {
    setVoiceUploadError("");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setVoiceUploadError("This browser does not support microphone recording.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        setRecordedBlob(blob);
        if (recordedUrl) {
          try {
            URL.revokeObjectURL(recordedUrl);
          } catch {}
        }
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording", err);
      setVoiceUploadError("Could not access microphone. Check your permissions.");
    }
  };

  const stopRecording = () => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    setIsRecording(false);
  };

  const uploadRecordedVoice = () => {
    if (!recordedBlob) {
      setVoiceUploadError("Record a voice sample first.");
      return;
    }
    const file = new File([recordedBlob], "recording.webm", {
      type: recordedBlob.type || "audio/webm",
    });
    handleVoiceUpload(file);
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

  const handleSave = async () => {
    const rawName = name.trim();
    const rawPrompt = basePrompt.trim();

    if (!rawName) {
      setError("Character name is required.");
      return;
    }
    if (!rawPrompt) {
      setError("Base prompt is required.");
      return;
    }

    // Prefer the preview image; fall back to the uploaded reference image if needed
    const imageUrl = previewUrl || referenceImageUrl.trim() || "";

    // Voice reference URL (uploaded/recorded)
    const voiceRefUrl = voiceUploadInfo?.url || undefined;

    if (!imageUrl) {
      setError(
        "A preview or reference image is required before saving a character."
      );
      return;
    }

    // Replace spaces with underscores for workflow‑safe naming
    const safeName = rawName.replace(/\s+/g, "_");

    const now = new Date().toISOString();

    const newCharacter = {
      id: `char_${Date.now()}`,
      name: safeName,
      basePrompt: rawPrompt,
      referenceImageUrl: imageUrl,
      voiceId: voiceId.trim() || undefined,
      voiceRefUrl: voiceRefUrl || null,
      createdAt: now,
      updatedAt: now,
    };

    // Prepare a lightweight expansion payload for n8n
    const expansionPayload = {
      id: newCharacter.id,
      name: safeName,
      basePrompt: rawPrompt,
      baseImageUrl: imageUrl,
      // No dedicated negative prompt field in the UI yet; the
      // expansion workflow can append its own safety suffix.
      negativePrompt: "",
      voiceId: voiceId.trim() || undefined,
      voiceRefUrl: voiceRefUrl || null,
    };

    const next = [...characters, newCharacter];
    persistCharacters(next);

    // Push into shared Supabase registry via n8n
    await registerCharacterInRegistry({
      id: newCharacter.id,
      name: safeName,
      basePrompt: rawPrompt,
      baseImageUrl: imageUrl,
      voiceId: voiceId.trim() || undefined,
      voiceRefUrl: voiceRefUrl || null,
    });

    // Kick off the character expansion workflow in the background
    triggerCharacterExpansion(expansionPayload);

    resetForm();
  };

  const handleDelete = (id) => {
    const next = characters.filter((c) => c.id !== id);
    persistCharacters(next);
    if (expandedId === id) {
      setExpandedId(null);
    }
    if (activeCharacter && activeCharacter.id === id) {
      setActiveCharacter(null);
    }
  };

  const handleCopyJson = (character) => {
    try {
      const text = JSON.stringify(character, null, 2);
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
        setCopiedId(character.id);
        setTimeout(() => {
          setCopiedId((current) => (current === character.id ? null : current));
        }, 1500);
      }
    } catch (e) {
      console.warn("Failed to copy JSON to clipboard", e);
    }
  };

  // For now, "Generate new character" is a UX affordance that could later
  // wire into an image / model endpoint. Here it just validates base prompt.
  const handleGeneratePreview = async () => {
  const rawPrompt = basePrompt.trim();

  if (!rawPrompt) {
    setError("Base prompt is required before generating a new character.");
    return;
  }

  setError("");
  setRegisterError("");
  setRegisterSuccess("");

  // 🔑 Clear the current preview so the loader state is visible,
  // especially when starting from a reference image
  setPreviewUrl("");

  setIsGeneratingPreview(true);


    try {
      const res = await fetch(
        "https://n8n.simplifies.click/webhook/generate-character-preview",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: rawPrompt,
            // If you later add a character-specific negative prompt field,
            // pass it here instead of the empty string:
            negative_prompt: "",
            // Let n8n decide whether to do t2i or img2img based on this
            reference_image_url: referenceImageUrl || null,
          }),
        }
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          text || `Character preview failed with status ${res.status}`
        );
      }

      const data = await res.json().catch(() => ({}));
      const url =
        data.image_url ||
        data.imageUrl ||
        data.url ||
        data.output?.image_url ||
        "";

      if (!url) {
        throw new Error("Preview completed, but no image_url was returned.");
      }

      setPreviewUrl(url);
    } catch (err) {
      console.error("Character preview generation failed", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate character preview. Please try again."
      );
    } finally {
      setIsGeneratingPreview(false);
    }
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
              ) : isGeneratingPreview ? (
                <p
                  style={{
                    color: "#E5E7EB",
                    fontSize: 13,
                    margin: 16,
                    textAlign: "center",
                  }}
                >
                  Generating character preview…
                </p>
              ) : (
                <p style={{ color: "#9CA3AF", fontSize: 13, margin: 16 }}>
                  No preview yet. Upload a reference image or click{" "}
                  <strong>Generate new character</strong> to see a live preview.
                </p>
              )}
            </div>
            {previewUrl && (
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
                      ? "Enter a character name to add this to your library"
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
                    cursor:
                      !name.trim() || !basePrompt.trim() || isRegistering
                        ? "not-allowed"
                        : "pointer",
                    opacity: isRegistering ? 0.8 : 1,
                  }}
                >
                  <span style={{ fontSize: 14 }}>＋</span>
                  <span>{isRegistering ? "Saving…" : "Add to saved characters"}</span>
                </button>
              </div>
            )}
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <label
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid #111827",
                  background: "#111827",
                  color: "#FFFFFF",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>Choose file</span>
                <input
                  type="file"
                  accept="image/*"
                  key={previewUrl}
                  onChange={(e) =>
                    handleReferenceUpload(e.target.files?.[0] || null)
                  }
                  style={{ display: "none" }}
                />
              </label>
              {referenceImageUrl && (
                <span
                  style={{
                    fontSize: 11,
                    color: "#6B7280",
                  }}
                >
                  File selected from disk
                </span>
              )}
            </div>
            {isUploading && (
              <p style={{ marginTop: 4, fontSize: 12, color: "#6B7280" }}>
                Uploading reference image…
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
                onChange={(idOrObj, label) => {
                  let nextId = "";
                  if (typeof idOrObj === "string") {
                    nextId = idOrObj;
                  } else if (idOrObj && typeof idOrObj === "object" && idOrObj.voiceId) {
                    nextId = idOrObj.voiceId;
                  }
                  setVoiceId(nextId);
                  // Selecting from the registry means this is a preset voice
                  setVoiceKind("preset");
                  // Clear any character-only upload metadata
                  setVoicePreviewUrl("");
                  setVoiceUploadInfo(null);
                }}
                className="text-xs"
              />
            </div>
            <p style={{ marginTop: 4, fontSize: 11, color: "#9CA3AF" }}>
              The selected voice id is stored on this character and can be passed directly into your
              TTS pipeline.
            </p>
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
              Add your voice (optional)
            </label>
            <div
              style={{
                borderRadius: 8,
                border: "1px solid #CBD5E1",
                padding: 8,
                background: "#FFFFFF",
                display: "grid",
                gap: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: "1px solid #111827",
                    background: isRecording ? "#B91C1C" : "#111827",
                    color: "#FFFFFF",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {isRecording ? "Stop recording" : "Start recording"}
                </button>
                <button
                  type="button"
                  onClick={uploadRecordedVoice}
                  disabled={!recordedBlob || isVoiceUploading}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: "1px solid #0369A1",
                    background: !recordedBlob || isVoiceUploading ? "#E5E7EB" : "#EFF6FF",
                    color: !recordedBlob || isVoiceUploading ? "#9CA3AF" : "#0369A1",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor:
                      !recordedBlob || isVoiceUploading ? "not-allowed" : "pointer",
                  }}
                >
                  {isVoiceUploading ? "Saving voice…" : "Save recording as voice"}
                </button>
                {/* Upload pre-recorded voice file */}
                <label
                  style={{
                    fontSize: 11,
                    color: "#4B5563",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>or</span>
                  <span
                    style={{
                      padding: "6px 12px",
                      borderRadius: 999,
                      border: "1px solid #D1D5DB",
                      background: "#F9FAFB",
                      color: "#111827",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Upload voice file
                  </span>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      if (file) {
                        handleVoiceUpload(file);
                      }
                      // reset so the same file can be picked again if needed
                      e.target.value = "";
                    }}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
              {recordedUrl && (
                <audio
                  controls
                  src={recordedUrl}
                  style={{ width: "100%", marginTop: 4 }}
                />
              )}
              {isVoiceUploading && (
                <p style={{ marginTop: 4, fontSize: 12, color: "#6B7280" }}>
                  Uploading voice recording…
                </p>
              )}
              {voiceUploadError && (
                <p style={{ marginTop: 4, fontSize: 12, color: "#B91C1C" }}>
                  {voiceUploadError}
                </p>
              )}
              {voiceUploadInfo && (
                <p style={{ marginTop: 4, fontSize: 12, color: "#16A34A" }}>
                  This character will use voice id <code>{voiceUploadInfo.voiceId}</code>
                  {voiceUploadInfo.url ? " (reference uploaded)" : ""}.
                </p>
              )}
            </div>
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
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#16A34A" }}>
              {registerSuccess}
            </p>
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
            disabled={!basePrompt.trim() || isGeneratingPreview}
            style={{
              padding: "10px 16px",
              borderRadius: 999,
              border: "1px solid #111827",
              background:
                !basePrompt.trim() || isGeneratingPreview ? "#4B5563" : "#111827",
              color: "#FFFFFF",
              fontWeight: 600,
              fontSize: 14,
              cursor:
                !basePrompt.trim() || isGeneratingPreview ? "not-allowed" : "pointer",
              opacity: isGeneratingPreview ? 0.85 : 1,
            }}
          >
            {isGeneratingPreview ? "Generating…" : "Generate new character"}
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
              <div key={c.id} style={{ display: "grid", gap: 4 }}>
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
                          cursor: "pointer",
                        }}
                        onClick={() => setActiveCharacter(c)}
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
                        color: "#374151",
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      {expandedId === c.id ? "Hide JSON" : "View JSON"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyJson(c)}
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
                      {copiedId === c.id ? "Copied!" : "Copy JSON"}
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
                {expandedId === c.id && (
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
                    {JSON.stringify(c, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    {/* CharacterCard modal */}
    {activeCharacter && (
      <CharacterCard
        character={activeCharacter}
        onClose={() => setActiveCharacter(null)}
      />
    )}
    </div>
  );
}