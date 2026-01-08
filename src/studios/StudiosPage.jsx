import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import CharacterStudioDemo from "./CharacterStudioDemo.jsx";
import SettingsStudioDemo from "./SettingsStudioDemo.jsx";

import KeyframeStudioDemo from "./KeyframeStudioDemo.jsx";
import ClipStudioDemo from "./ClipStudioDemo.jsx";
import ProductionStudioDemo from "./ProductionStudioDemo.jsx";

// Define tab names and their corresponding indices
const TAB_NAMES = ["characters", "settings", "scenes", "clips", "production"];
const STORAGE_KEY_TAB = "sceneme.activeTab";

export default function StudiosPage() {
  const nav = useNavigate();
  const location = useLocation(); // Hook to get current path

  // Determine default tab based on URL or LocalStorage
  const getInitialTab = () => {
    // Prioritize URL for clip studio demo
    if (location.pathname === "/clip-studio-demo") return "clips";

    // Then check localStorage
    const savedIndex = localStorage.getItem(STORAGE_KEY_TAB);
    if (savedIndex !== null) {
      const idx = parseInt(savedIndex, 10);
      // Validate bounds and return corresponding tab name, or default to "clips"
      if (idx >= 0 && idx < TAB_NAMES.length) {
        return TAB_NAMES[idx];
      }
    }
    // Default to "characters" if nothing valid is found
    return "characters";
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);

  // Persist tab selection to localStorage
  React.useEffect(() => {
    const tabIndex = TAB_NAMES.indexOf(activeTab);
    if (tabIndex !== -1) {
      localStorage.setItem(STORAGE_KEY_TAB, tabIndex.toString());
    }
  }, [activeTab]);

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
      <header style={{ marginBottom: 24, textAlign: "center" }}>
        <p style={{ marginTop: 0, color: "#475569", lineHeight: "1.6" }}>
          <span style={{ display: "block", fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Welcome to SceneMe Studios.</span>
          <b>Creative control of your cast, sets, and sound.</b> Build consistent <b>Characters</b> and <b>Settings</b>, compose them into cinematic <b>Keyframes</b>, bring them to life in the <b>Clip Studio</b>, and direct full masterpieces in the <b>Scene Studio</b>—all from the palm of your hand.
        </p>
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
