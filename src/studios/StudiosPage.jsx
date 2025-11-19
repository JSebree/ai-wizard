import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import CharacterStudioDemo from "./CharacterStudioDemo.jsx";
import SettingsStudioDemo from "./SettingsStudioDemo.jsx";

export default function StudiosPage() {
  const nav = useNavigate();
  const [activeTab, setActiveTab] = useState("characters"); // "characters" | "settings"

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      {/* Header / Breadcrumb */}
      <header style={{ marginBottom: 20 }}>
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
        <h1 style={{ margin: 0 }}>SceneMe Studios (Preview)</h1>
        <p style={{ marginTop: 8, color: "#475569", maxWidth: 720 }}>
          Early access tools for building reusable creative assets. Use the Character Studio to
          define persistent characters, and the Settings Studio to design reusable environments
          your stories can return to. These are functional preview tools and are not yet wired
          into the one-click Express video generator.
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
          <span style={{ opacity: 0.75 }}>
            Studios run separately from the Express workflow for now.
          </span>
        </div>
      </header>

      {/* Tabs */}
      <section
        style={{
          border: "1px solid #E5E7EB",
          borderRadius: 12,
          background: "#FFFFFF",
          overflow: "hidden",
        }}
      >
        {/* Tab header */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #E5E7EB",
            background: "#F9FAFB",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("characters")}
            style={{
              flex: 1,
              padding: "10px 16px",
              border: "none",
              borderBottom:
                activeTab === "characters" ? "2px solid #111827" : "2px solid transparent",
              background: "transparent",
              cursor: "pointer",
              fontWeight: activeTab === "characters" ? 700 : 500,
              fontSize: 14,
              color: activeTab === "characters" ? "#111827" : "#6B7280",
            }}
          >
            Character Studio
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            style={{
              flex: 1,
              padding: "10px 16px",
              border: "none",
              borderBottom:
                activeTab === "settings" ? "2px solid #111827" : "2px solid transparent",
              background: "transparent",
              cursor: "pointer",
              fontWeight: activeTab === "settings" ? 700 : 500,
              fontSize: 14,
              color: activeTab === "settings" ? "#111827" : "#6B7280",
            }}
          >
            Settings Studio
          </button>
        </div>

        {/* Tab body */}
        <div style={{ padding: 16 }}>
          {activeTab === "characters" ? (
            <CharacterStudioDemo />
          ) : (
            <SettingsStudioDemo />
          )}
        </div>
      </section>
    </div>
  );
}
