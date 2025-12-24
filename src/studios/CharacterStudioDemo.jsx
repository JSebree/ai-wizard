import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../libs/supabaseClient";
import { API_CONFIG } from "../config/api";
import CharacterCard from "./components/CharacterCard";

const STORAGE_KEY = "sceneme.characters";

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
  const [characterToDelete, setCharacterToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // [v67] Mobile Safari Support: Detect optimal MIME type
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/aac')) {
        mimeType = 'audio/aac';
      }
      console.log("Using MIME Type for Recording:", mimeType);

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      // Store mimeType for onstop reference
      mediaRecorderRef.current.mimeTypeFromOpts = mimeType;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const type = mediaRecorderRef.current.mimeTypeFromOpts || 'audio/webm';
        const ext = type.split('/')[1];
        const audioBlob = new Blob(audioChunksRef.current, { type });
        const audioFile = new File([audioBlob], `recording_${Date.now()}.${ext}`, { type });
        await uploadVoiceFile(audioFile);

        // Stop all tracks to release mic
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Microphone access denied or not supported.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const [voices, setVoices] = useState([]);

  // Load Voices
  // Load Voices (Directly from Speakers Table)
  useEffect(() => {
    async function loadVoices() {
      // 1. Try fetching from local JSON registry first (most reliable)
      try {
        const res = await fetch('/voices.json');
        if (res.ok) {
          const json = await res.json();
          const list = Array.isArray(json) ? json : json.voices || [];
          setVoices(list.map(v => ({
            id: v.id || v.voice_id,
            name: v.name,
            previewUrl: v.preview_url || v.audio_url || v.url || ""
          })));
          return;
        }
      } catch (err) {
        console.warn("Local voices.json not found, trying Supabase...", err);
      }

      // 2. Fallback to Supabase
      if (!supabase) return;
      try {
        const { data, error } = await supabase
          .from('speakers')
          .select('id, name, preview_url, voice_id')
          .order('name');

        if (data && data.length > 0) {
          setVoices(data.map(v => ({
            id: v.id,
            name: v.name,
            previewUrl: v.preview_url || ""
          })));
        }
      } catch (err) {
        console.error("Failed to load speakers:", err);
      }
    }
    loadVoices();
  }, []);

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
  const fetchSupabase = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from("characters").select("*").order("created_at", { ascending: false });
      if (data) {
        // SANITIZATION: Fix corrupted voice IDs
        const cleanId = (val) => {
          if (typeof val !== 'string') return val;
          if (val.includes('?id=eq.')) {
            const match = val.match(/id=eq\.([^&]+)/);
            return match ? match[1] : val;
          }
          return val;
        };

        const mapped = data.map(row => ({
          id: row.id,
          name: row.name,
          displayName: row.display_name,
          basePrompt: row.base_prompt,
          referenceImageUrl: row.base_image_url || row.base_hero,
          voiceId: cleanId(row.voice_id),
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
  }, []);

  useEffect(() => {
    fetchSupabase();
    const interval = setInterval(fetchSupabase, 20000);
    return () => clearInterval(interval);
  }, [fetchSupabase]);

  // Modify Workflow
  const handleModifyCharacter = (char) => {
    setName(char.name || "");
    setBasePrompt(char.basePrompt || "");
    setReferenceImageUrl(char.referenceImageUrl || "");
    setPreviewUrl(char.referenceImageUrl || ""); // Show current image as preview

    // Voice
    const vId = char.voiceId || "";
    setVoiceId(vId);
    setVoicePreviewUrl(char.voiceRefUrl || "");

    // Determine Kind
    // If exact ID "recording" OR ID not found in library -> Clone
    const isLibraryVoice = voices.some(v => v.id === vId);
    const isClone = vId === "recording" || !isLibraryVoice;

    setVoiceKind(isClone ? "clone" : "preset");

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

      const res = await fetch(API_CONFIG.UPLOAD_REFERENCE_IMAGE, {
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

  const uploadVoiceFile = async (file) => {
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", "voice_clone");
      // Use standard upload endpoint, assuming it handles audio or generic files
      const res = await fetch(API_CONFIG.UPLOAD_REFERENCE_IMAGE, {
        method: "POST",
        body: formData
      });

      if (!res.ok) throw new Error("Voice upload failed");
      const data = await res.json();
      const url = data.publicUrl || data.url || data.image_url;

      if (url) {
        setVoicePreviewUrl(url);
        setVoiceId(`clone_${Date.now()} `); // Generate a temporary ID for the clone
      }
    } catch (err) {
      console.error("Voice upload error", err);
      setError(`Voice upload failed: ${err.message}`);
      alert("Failed to upload voice recording. Please try again.");
    }
  };

  const handleGeneratePreview = async () => {
    if (!basePrompt.trim()) return;
    setIsGeneratingPreview(true);
    try {
      const res = await fetch(API_CONFIG.GENERATE_ASSET_PREVIEW, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: basePrompt,
          name: name,
          reference_image_url: referenceImageUrl || null,
          asset_type: "character",
          mood: null
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

    const id = `char_${Date.now()} `;

    // STRICT VOICE LOGIC:
    // 1. Library: ID = UUID from registry
    // 2. Clone: ID = "recording" literal (Required by backend logic)
    const finalVoiceId = voiceKind === "clone" ? "recording" : (voiceId || "recording");

    const newChar = {
      id,
      name,
      basePrompt,
      referenceImageUrl: imageUrl,
      voiceId: finalVoiceId,
      voiceRefUrl: voiceKind === "clone" ? voicePreviewUrl : null,
      createdAt: new Date().toISOString()
    };

    // Optimistic
    const next = [newChar, ...characters];
    persistCharacters(next);

    // Supabase Register
    try {
      const res = await fetch(API_CONFIG.REGISTER_CHARACTER, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name,
          base_prompt: basePrompt,
          base_image_url: imageUrl,
          voice_id: finalVoiceId,
          // [v69] STRICT: Only send voice_ref_url if it's a clone. Registry voices don't need it.
          voice_ref_url: voiceKind === "clone" ? (voicePreviewUrl || null) : null,
          kind: "character"
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Registration failed (${res.status}): ${errText}`);
      }

      // Attempt to retrieve real UUID from response
      const data = await res.json().catch(() => ({}));
      const realId = data.id || data.uuid || data.character_id;
      if (realId) {
        console.log("Received real ID from registry:", realId);
        setCharacters(prev => prev.map(c => c.id === id ? { ...c, id: realId } : c));
      }

      // Trigger Expansion (Include voice data to prevent overwrite)
      void fetch(API_CONFIG.GENERATE_CHARACTER_EXPANSION, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // [v68] BUGFIX: Include voice_id and audio_url so n8n update doesn't wipe them
        body: JSON.stringify({
          id,
          name,
          base_prompt: basePrompt,
          base_image_url: imageUrl,
          voice_id: finalVoiceId,
          audio_url: voiceKind === "clone" ? (voicePreviewUrl || null) : null,
          kind: "character"
        })
      }).catch(console.error);

      // Refresh list multiple times to ensure we catch the DB write
      setTimeout(fetchSupabase, 1000);
      setTimeout(fetchSupabase, 3000);
      setTimeout(fetchSupabase, 5000);

    } catch (e) {
      console.error("Registration failed", e);
      alert(`Error saving character: ${e.message}`);
    }

    setName("");
    setBasePrompt("");
    setReferenceImageUrl("");
    setPreviewUrl("");
    // CLEANUP: Reset voice state to prevent pollution
    setVoiceId("");
    setVoicePreviewUrl("");
    setVoiceKind("preset");
  };

  const handleDelete = (id) => {
    setCharacterToDelete(id);
  };

  const handleConfirmDelete = async () => {
    const id = characterToDelete;
    if (!id) return;

    setIsDeleting(true);

    // Optimistic update
    const previousCharacters = [...characters];
    setCharacters(prev => prev.filter(c => c.id !== id));

    try {
      // 1. Delete from Supabase if client exists
      if (supabase) {
        let deleteId = id;

        // Lazy ID Resolution: If ID is temporary/optimistic, try to find real UUID by name
        if (id.startsWith("char_")) {
          const charName = characters.find(c => c.id === id)?.name;
          if (charName) {
            const { data: lookup } = await supabase
              .from("characters")
              .select("id")
              .eq("name", charName)
              .order("created_at", { ascending: false })
              .limit(1)
              .single();

            if (lookup && lookup.id) {
              deleteId = lookup.id;
            } else {
              console.warn("Could not resolve real UUID for temporary ID. Deletion might fail if row exists.");
            }
          }
        }

        const { data, error } = await supabase
          .from("characters")
          .delete()
          .eq("id", deleteId)
          .select();

        if (error) throw error;

        if (!data || data.length === 0) {
          console.warn("Delete op returned no data. Possible ID mismatch or row already gone. ID was:", deleteId);
        }
      }

      // 2. Persist local
      const next = characters.filter(c => c.id !== id);
      persistCharacters(next);

      // 3. Close modal if active
      if (activeCharacter?.id === id) setActiveCharacter(null);

    } catch (err) {
      console.error("Failed to delete character:", err);
      // Revert optimistic
      setCharacters(previousCharacters);
      alert("Failed to delete character. See console for details.");
    } finally {
      setIsDeleting(false);
      setCharacterToDelete(null);
    }
  };


  return (
    <div style={{ paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Character Studio</h2>
        <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>
          Define reusable characters. Capture their look and voice for use in scene generation.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

        {/* Form Container */}
        <section style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 20, background: "#FFFFFF" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Create Character</h3>
            {(name || basePrompt || voiceId || previewUrl) && (
              <button onClick={() => {
                setName("");
                setBasePrompt("");
                setReferenceImageUrl("");
                setPreviewUrl("");
                setVoiceId("");
                setVoicePreviewUrl("");
                setVoiceKind("preset");
                setActiveCharacter(null); // Clear editing context if any
              }} style={{ fontSize: 11, color: "#64748B", background: "none", border: "1px solid #E2E8F0", borderRadius: 4, padding: "2px 6px", cursor: "pointer" }}>
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

            {/* Voice Section */}
            <div style={{ paddingTop: 16, borderTop: "1px solid #E2E8F0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155" }}>Voice</label>
                <div style={{ display: "flex", background: "#F1F5F9", borderRadius: 6, padding: 2 }}>
                  <button
                    onClick={() => setVoiceKind("preset")}
                    style={{
                      padding: "4px 12px", borderRadius: 4, fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer",
                      background: voiceKind === "preset" ? "#FFFFFF" : "transparent",
                      color: voiceKind === "preset" ? "#0F172A" : "#64748B",
                      boxShadow: voiceKind === "preset" ? "0 1px 2px rgba(0,0,0,0.05)" : "none"
                    }}
                  >
                    Library
                  </button>
                  <button
                    onClick={() => setVoiceKind("clone")}
                    style={{
                      padding: "4px 12px", borderRadius: 4, fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer",
                      background: voiceKind === "clone" ? "#FFFFFF" : "transparent",
                      color: voiceKind === "clone" ? "#0F172A" : "#64748B",
                      boxShadow: voiceKind === "clone" ? "0 1px 2px rgba(0,0,0,0.05)" : "none"
                    }}
                  >
                    Clone
                  </button>
                </div>
              </div>

              {voiceKind === "preset" ? (
                <div>
                  <select
                    value={voiceId}
                    onChange={(e) => {
                      setVoiceId(e.target.value);
                      const hit = voices.find(v => v.id === e.target.value);
                      setVoicePreviewUrl(hit ? hit.previewUrl : "");
                    }}
                    style={{
                      width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #E2E8F0",
                      fontSize: 14, outline: "none", background: "#F8FAFC", cursor: "pointer"
                    }}
                  >
                    <option value="">Select a voice...</option>
                    {voices.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Option A: Upload */}
                  <label style={{ border: "1px dashed #CBD5E1", borderRadius: 8, padding: 16, textAlign: "center", cursor: "pointer", background: "#F8FAFC", display: "block" }}>
                    <span style={{ fontSize: 12, color: "#64748B", fontWeight: 500 }}>
                      {voicePreviewUrl ? "✅ Audio Uploaded" : "📁 Upload Audio File (MP3/WAV)"}
                    </span>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) uploadVoiceFile(e.target.files[0]);
                      }}
                      style={{ display: "none" }}
                    />
                  </label>

                  {/* Divider */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#94A3B8", fontSize: 11, fontWeight: 600 }}>
                    <div style={{ height: 1, flex: 1, background: "#E2E8F0" }} /> OR <div style={{ height: 1, flex: 1, background: "#E2E8F0" }} />
                  </div>

                  {/* Option B: Record */}
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    style={{
                      padding: "12px",
                      borderRadius: 8,
                      background: isRecording ? "#FEF2F2" : "#F0F9FF",
                      border: isRecording ? "1px solid #EF4444" : "1px solid #0EA5E9",
                      color: isRecording ? "#EF4444" : "#0284C7",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8
                    }}
                  >
                    {isRecording ? (
                      <>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", animation: "pulse 1s infinite" }} />
                        Stop Recording
                      </>
                    ) : (
                      <>
                        <span>🎤</span> Record Voice
                      </>
                    )}
                  </button>
                  <style>{`@keyframes pulse { 0 % { opacity: 1; } 50 % { opacity: 0.5; } 100 % { opacity: 1; } } `}</style>
                </div>
              )}

              {/* Audio Preview Player */}
              {voicePreviewUrl && (
                <div style={{ marginTop: 12 }}>
                  <audio controls src={voicePreviewUrl} style={{ width: "100%", height: 32 }} />
                </div>
              )}
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
            <div className="overflow-x-auto flex gap-4 pb-4 border-b border-gray-100 min-h-[120px]">
              {characters.map(char => (
                <div
                  key={char.id}
                  onClick={() => setActiveCharacter(char)}
                  className="flex-shrink-0 w-48 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-all group flex flex-col"
                >
                  <div className="aspect-square bg-slate-200 relative overflow-hidden">
                    <img
                      src={char.referenceImageUrl || char.base_image_url || char.base_hero}
                      className="w-full h-full object-cover"
                      alt={char.displayName}
                    />
                  </div>
                  <div className="p-2 flex flex-col flex-1 gap-2">
                    <div className="font-bold text-xs text-slate-800 truncate" title={char.displayName || char.name}>{char.displayName || char.name}</div>
                    <div className="mt-auto flex justify-between items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleModifyCharacter(char); }}
                        className="flex-1 text-[10px] font-bold text-slate-700 border border-slate-200 rounded py-1 hover:bg-white hover:border-slate-400 transition-colors"
                      >Modify</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(char.id); }}
                        className="text-[10px] font-bold text-red-500 hover:text-red-700 px-1"
                        title="Delete"
                      >Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      {/* Confirmation Modal */}
      {characterToDelete && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div style={{ background: "white", padding: 24, borderRadius: 12, maxWidth: 400, width: "90%", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
            <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 18, fontWeight: 700, color: "#1F2937" }}>Confirm Deletion</h3>
            <p style={{ color: "#4B5563", marginBottom: 24, lineHeight: 1.5 }}>
              Are you sure you want to delete this character? This action cannot be undone.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                onClick={() => setCharacterToDelete(null)}
                disabled={isDeleting}
                style={{
                  padding: "8px 16px", borderRadius: 6,
                  border: "1px solid #D1D5DB", background: "white", color: "#374151",
                  fontWeight: 600, cursor: isDeleting ? "not-allowed" : "pointer",
                  opacity: isDeleting ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                style={{
                  padding: "8px 16px", borderRadius: 6,
                  border: "none", background: "#EF4444", color: "white",
                  fontWeight: 600, cursor: isDeleting ? "not-allowed" : "pointer",
                  opacity: isDeleting ? 0.7 : 1
                }}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeCharacter && (
        <CharacterCard
          character={activeCharacter}
          onClose={() => setActiveCharacter(null)}
          onModify={() => handleModifyCharacter(activeCharacter)}
          onDelete={() => handleDelete(activeCharacter.id)}
        />
      )}
    </div>
  );
}