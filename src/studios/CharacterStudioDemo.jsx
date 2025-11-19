import React from "react";
import { useNavigate } from "react-router-dom";

export default function CharacterStudioDemo() {
  const nav = useNavigate();

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: 24 }}>
      <header style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => nav("/")}
          style={{
            border: "none",
            background: "transparent",
            padding: 0,
            marginBottom: 8,
            fontSize: 13,
            color: "#64748B",
            cursor: "pointer",
          }}
        >
          ← Back to SceneMe home
        </button>
        <h1 style={{ margin: 0 }}>Character Studio (Preview)</h1>
        <p style={{ marginTop: 8, color: "#475569" }}>
          Design reusable characters for your stories: faces, vibes, wardrobe, and notes that you
          can bring back in future episodes.
        </p>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginTop: 8,
            padding: "4px 10px",
            borderRadius: 999,
            background: "#FEF3C7",
            color: "#92400E",
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          <span>Preview only</span>
          <span style={{ opacity: 0.7 }}>
            Not yet wired into the one-click Express generator.
          </span>
        </div>
      </header>

      {/* Replace this with your real studio UI as you go */}
      <section
        style={{
          border: "1px solid #E5E7EB",
          borderRadius: 12,
          padding: 16,
          background: "#FFFFFF",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Demo workspace</h2>
        <p style={{ marginTop: 0, marginBottom: 16, color: "#64748B" }}>
          Here you can show the current character-creation UI: name, description, image preview,
          and any studio controls you already have scaffolded.
        </p>

        {/* For now, just a placeholder form – you can hook this up to your existing backend later */}
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Character name
            </label>
            <input
              type="text"
              placeholder="Ari, Mira, Bezzie..."
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #CBD5E1",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Short description
            </label>
            <textarea
              rows={3}
              placeholder="How they look, personality, role in the story..."
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #CBD5E1",
                resize: "vertical",
              }}
            />
          </div>

          <button
            type="button"
            style={{
              alignSelf: "flex-start",
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #111827",
              background: "#111827",
              color: "#FFFFFF",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Save character (demo)
          </button>
        </div>
      </section>
    </div>
  );
}