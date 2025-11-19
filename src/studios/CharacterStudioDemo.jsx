import React, { useState, useEffect } from "react";

const STORAGE_KEY = "sceneme.characters";

export default function CharacterStudioDemo() {
  const [name, setName] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [appearanceNotes, setAppearanceNotes] = useState("");
  const [personalityNotes, setPersonalityNotes] = useState("");
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [characters, setCharacters] = useState([]);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);

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
    setShortDescription("");
    setAppearanceNotes("");
    setPersonalityNotes("");
    setReferenceImageUrl("");
    setVoiceId("");
    setError("");
  };

  const handleSave = () => {
    if (!name.trim()) {
      setError("Character name is required.");
      return;
    }

    const now = new Date().toISOString();

    const newCharacter = {
      id: `char_${Date.now()}`,
      name: name.trim(),
      shortDescription: shortDescription.trim(),
      appearanceNotes: appearanceNotes.trim(),
      personalityNotes: personalityNotes.trim(),
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
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Character workspace</h2>
        <p style={{ marginTop: 0, marginBottom: 16, color: "#64748B", fontSize: 14 }}>
          Capture the core of a reusable character: how they look, who they are, and how they
          sound. These definitions can later be wired into your image, video, and voice pipelines.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
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

          <div>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              Short description
            </label>
            <textarea
              rows={2}
              placeholder="One or two lines that sum them up in the story."
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
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
              Appearance notes
            </label>
            <textarea
              rows={3}
              placeholder="Hair, skin tone, clothing, age, posture, physical quirks..."
              value={appearanceNotes}
              onChange={(e) => setAppearanceNotes(e.target.value)}
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
              Personality notes
            </label>
            <textarea
              rows={3}
              placeholder="Energy level, quirks, how they speak, decision style..."
              value={personalityNotes}
              onChange={(e) => setPersonalityNotes(e.target.value)}
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
              Reference image URL (optional)
            </label>
            <input
              type="text"
              placeholder="https://.../ari_main.png"
              value={referenceImageUrl}
              onChange={(e) => setReferenceImageUrl(e.target.value)}
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
              Voice ID (optional)
            </label>
            <input
              type="text"
              placeholder="higgs_voice_ari_01 or UUID from your voice registry"
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
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

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
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
              Save character
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
                      {c.name}
                    </div>
                    {c.shortDescription && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "#6B7280",
                          marginBottom: 2,
                        }}
                      >
                        {c.shortDescription}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: 11,
                        color: "#9CA3AF",
                      }}
                    >
                      Created: {new Date(c.createdAt).toLocaleString()}
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
                {expandedId === c.id && (
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
                    {JSON.stringify(c, null, 2)}
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