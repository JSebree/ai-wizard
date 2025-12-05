import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import CharacterCard from "./components/CharacterCard.jsx";

const STORAGE_KEY = "sceneme.characters";

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
  const [voiceKind, setVoiceKind] = useState("preset");
  const [voicePreviewUrl, setVoicePreviewUrl] = useState("");
  const [characters, setCharacters] = useState([]);
  const [error, setError] = useState("");
  const [activeCharacter, setActiveCharacter] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState("");
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  // Live preview + upload state
  const [previewUrl, setPreviewUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  // Load saved characters
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setCharacters(JSON.parse(raw));
    } catch (e) { console.warn(e); }
  }, []);

  const persistCharacters = (next) => {
    setCharacters(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) { }
  };

  // Sync Supabase
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    async function fetchSupabase() {
      try {
        const { data, error } = await supabase.from("characters").select("*").order("created_at", { ascending: false });
        if (data && !cancelled) {
          const mapped = data.map(row => ({
            id: row.id,
            name: row.name,
            basePrompt: row.base_prompt,
            referenceImageUrl: row.base_image_url || row.base_hero,
            voiceId: row.voice_id,
            voiceRefUrl: row.voice_ref_url,
            createdAt: row.created_at,
            // Map ALL gallery fields
            base_image_url: row.base_image_url,
            base_hero: row.base_hero,
            fullbody_centered: row.fullbody_centered,
            fullbody_side: row.fullbody_side,
            torso_front: row.torso_front,
            headshot_front: row.headshot_front,
            headshot_left: row.headshot_left,
            headshot_right: row.headshot_right
          }));
          setCharacters(mapped);
          persistCharacters(mapped);
        }
      } catch (e) { console.error(e); }
    }
    fetchSupabase();
    const interval = setInterval(fetchSupabase, 20000);
    return () => { cancelled = true; clearInterval(interval); }
  }, []);

  // Modify Workflow
  const handleModifyCharacter = (char) => {
    setName(char.name || "");
    setBasePrompt(char.basePrompt || "");
    setReferenceImageUrl(char.referenceImageUrl || "");
    setPreviewUrl(char.referenceImageUrl || ""); // Show current image as preview

    // Voice
    setVoiceId(char.voiceId || "");
    setVoicePreviewUrl(char.voiceRefUrl || "");

    setActiveCharacter(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReferenceUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", "character");
      formData.append("name", name || "Untitled");

      const res = await fetch("https://n8n.simplifies.click/webhook/upload-reference-image", {
        method: "POST",
        body: formData
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      const url = data.publicUrl || data.url || data.image_url;
      if (!url) throw new Error("No URL returned");

      setReferenceImageUrl(url);
      setPreviewUrl(url);
    } catch (err) {
      setUploadError("Upload failed.");
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleGeneratePreview = async () => {
    if (!basePrompt.trim()) return;
    setIsGeneratingPreview(true);
    try {
      const res = await fetch("https://n8n.simplifies.click/webhook/generate-character-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: basePrompt,
          reference_image_url: referenceImageUrl || null
        })
      });
      const data = await res.json();
      const url = data.image_url || data.url;
      if (url) setPreviewUrl(url);
    } catch (e) {
      console.error(e);
      setError("Preview generation failed.");
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { setError("Name required"); return; }
    const imageUrl = previewUrl || referenceImageUrl;
    if (!imageUrl) { setError("Image required"); return; }

    const id = `char_${Date.now()}`;
    const newChar = {
      id,
      name,
      basePrompt,
      referenceImageUrl: imageUrl,
      voiceId,
      voiceRefUrl: voicePreviewUrl,
      createdAt: new Date().toISOString()
    };

    // Optimistic
    const next = [newChar, ...characters];
    persistCharacters(next);

    // Supabase Register
    try {
      await fetch("https://n8n.simplifies.click/webhook/webhook/register-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id, name, base_prompt: basePrompt, base_image_url: imageUrl, voice_id: voiceId, kind: "character"
        })
      });

      // Trigger Expansion
      void fetch("https://n8n.simplifies.click/webhook/generate-character-expansion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name, base_prompt: basePrompt, base_image_url: imageUrl, kind: "character" })
      }).catch(console.error);

    } catch (e) { console.error("Registration failed", e); }

    setName("");
    setBasePrompt("");
    setReferenceImageUrl("");
    setPreviewUrl("");
  };

  const handleDelete = (id) => {
    const next = characters.filter(c => c.id !== id);
    persistCharacters(next);
  };


  return (
    <div style={{ paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Character Studios</h2>
        <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>
          Define reusable characters. Capture their look and voice for use in scene generation.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

        {/* Form Container */}
        <section style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 20, background: "#FFFFFF" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Create Character</h3>
            {(name || basePrompt) && (
              <button onClick={() => { setName(""); setBasePrompt(""); setPreviewUrl(""); }} style={{ fontSize: 11, color: "#64748B", background: "none", border: "1px solid #E2E8F0", borderRadius: 4, padding: "2px 6px", cursor: "pointer" }}>
                Reset
              </button>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#334155" }}>Name *</label>
              <input
                type="text"
                placeholder="e.g. Cyberpunk Detective"
                value={name}
                onChange={e => setName(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 14, outline: "none", background: "#F8FAFC" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#334155" }}>Description *</label>
              <textarea
                rows={3}
                placeholder="Visual description of the character..."
                value={basePrompt}
                onChange={e => setBasePrompt(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 14, outline: "none", background: "#F8FAFC", resize: "vertical" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#334155" }}>Reference Image <span style={{ fontWeight: 400, color: "#94A3B8" }}>(Optional)</span></label>
              <label style={{ border: "1px dashed #CBD5E1", borderRadius: 8, padding: 16, textAlign: "center", cursor: "pointer", background: "#F8FAFC", display: "block" }}>
                <span style={{ fontSize: 12, color: "#64748B", fontWeight: 500 }}>{isUploading ? "Uploading..." : "Click to upload reference"}</span>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleReferenceUpload} style={{ display: "none" }} />
              </label>
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <button
              onClick={handleGeneratePreview}
              disabled={isGeneratingPreview || !basePrompt}
              style={{ width: "100%", padding: "12px", borderRadius: 999, background: (isGeneratingPreview || !basePrompt) ? "#94A3B8" : "#000", color: "white", fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer" }}
            >
              {isGeneratingPreview ? "Generating..." : "Generate Preview"}
            </button>
          </div>
        </section>

        {/* Preview */}
        <div style={{ position: "relative", minHeight: 400, background: "#F1F5F9", borderRadius: 8, overflow: "hidden", border: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {previewUrl ? (
            <img src={previewUrl} style={{ width: "100%", height: "100%", objectFit: "contain", background: "black" }} />
          ) : (
            <div style={{ textAlign: "center", color: "#CBD5E1" }}>
              <div style={{ fontSize: 24 }}>👤</div>
              <div style={{ fontSize: 14 }}>Preview will appear here</div>
            </div>
          )}

          {isGeneratingPreview && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
              Generating...
            </div>
          )}
        </div>

        {/* Save */}
        {previewUrl && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -16 }}>
            <button
              onClick={handleSave}
              disabled={!name}
              style={{ padding: "10px 24px", borderRadius: 999, background: name ? "#000" : "#94A3B8", color: "white", fontWeight: 600, border: "none", cursor: name ? "pointer" : "not-allowed" }}
            >
              {name ? "Save Character" : "Name Required"}
            </button>
          </div>
        )}

        {/* Saved Grid */}
        <section style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 20, background: "#FFFFFF" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px" }}>Saved Characters</h3>
          {characters.length === 0 ? <p style={{ color: "#94A3B8", fontSize: 13 }}>No characters saved.</p> : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
              {characters.map(char => (
                <div
                  key={char.id}
                  onClick={() => setActiveCharacter(char)}
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
                  <div style={{ aspectRatio: "1", background: "#E2E8F0" }}>
                    <img src={char.referenceImageUrl || char.base_image_url || char.base_hero} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <div style={{ padding: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{char.name}</div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleModifyCharacter(char); }}
                        style={{ fontSize: 11, color: "#000", background: "none", border: "1px solid #E2E8F0", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}
                      >Modify</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(char.id); }}
                        style={{ fontSize: 11, color: "#EF4444", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      >Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      {activeCharacter && <CharacterCard character={activeCharacter} onClose={() => setActiveCharacter(null)} onModify={() => handleModifyCharacter(activeCharacter)} />}
    </div>
  );
}