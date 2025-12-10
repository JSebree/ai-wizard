import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import CharacterStudioDemo from "./CharacterStudioDemo.jsx";
import SettingsStudioDemo from "./SettingsStudioDemo.jsx";

import KeyframeStudioDemo from "./KeyframeStudioDemo.jsx";
import ClipStudioDemo from "./ClipStudioDemo.jsx";
import ProductionStudioDemo from "./ProductionStudioDemo.jsx";

export default function StudiosPage() {
  const nav = useNavigate();
  const location = useLocation(); // Hook to get current path

  // Determine default tab based on URL or LocalStorage
  const getInitialTab = () => {
    if (location.pathname === "/clip-studio-demo") return "clips";
    return localStorage.getItem("studios.activeTab") || "characters";
  };

  const [activeTab, setActiveTab] = useState(getInitialTab());

  // Update tab if location changes (e.g. navigation)
  React.useEffect(() => {
    if (location.pathname === "/clip-studio-demo") {
      setActiveTab("clips");
    }
  }, [location.pathname]);

  React.useEffect(() => {
    if (activeTab === "story") {
      setActiveTab("clips");
    } else if (activeTab) {
      localStorage.setItem("studios.activeTab", activeTab);
    }
  }, [activeTab]);

  return (
    <div
      style={{
        maxWidth: "1040px",
        width: "100%",
        margin: "0 auto",
        padding: 24,
      }}
    >
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>SceneMe Studios (Preview)</h1>
        <p style={{ marginTop: 8, color: "#475569", lineHeight: "1.6" }}>
          Welcome to your new creative workflow. Start by building consistent <b>Characters</b> and <b>Settings</b>, then bring them together into stunning <b>Keyframes</b>. Note those moments, bring them to life in the <b>Clip Studio</b>, and finally, weave it all together into a complete masterpiece in the <b>Scene Studio</b>.
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
            Character
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
            Setting
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("scenes")}
            style={{
              flex: 1,
              padding: "10px 16px",
              border: "none",
              borderBottom:
                activeTab === "scenes" ? "2px solid #111827" : "2px solid transparent",
              background: "transparent",
              cursor: "pointer",
              fontWeight: activeTab === "scenes" ? 700 : 500,
              fontSize: 14,
              color: activeTab === "scenes" ? "#111827" : "#6B7280",
            }}
          >
            Keyframe
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("clips")}
            style={{
              flex: 1,
              padding: "10px 16px",
              border: "none",
              borderBottom:
                activeTab === "clips" ? "2px solid #111827" : "2px solid transparent",
              background: "transparent",
              cursor: "pointer",
              fontWeight: activeTab === "clips" ? 700 : 500,
              fontSize: 14,
              color: activeTab === "clips" ? "#111827" : "#6B7280",
            }}
          >
            Clip
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("production")}
            style={{
              flex: 1,
              padding: "10px 16px",
              border: "none",
              borderBottom:
                activeTab === "production" ? "2px solid #111827" : "2px solid transparent",
              background: "transparent",
              cursor: "pointer",
              fontWeight: activeTab === "production" ? 700 : 500,
              fontSize: 14,
              color: activeTab === "production" ? "#111827" : "#6B7280",
            }}
          >
            Scene
          </button>
        </div>

        {/* Tab body */}
        <div style={{ padding: 16 }}>
          {activeTab === "characters" ? (
            <CharacterStudioDemo />
          ) : activeTab === "settings" ? (
            <SettingsStudioDemo />
          ) : activeTab === "scenes" ? (
            <KeyframeStudioDemo />
          ) : activeTab === "clips" ? (
            <ClipStudioDemo />
          ) : (
            <ProductionStudioDemo />
          )}
        </div>
      </section>
    </div>
  );
}
