import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Template gallery (add more items over time)
const TEMPLATE_KEY = "interview_template_v1";
const templates = [
  {
    id: "tokyo-vlog-1",
    title: "Tokyo Vlog — Jackie",
    description: "Travel vlog in Tokyo with A‑roll narration, cinematic style, 30s.",
    // Preview video users can watch
    videoUrl: "https://n8n-nca-bucket.nyc3.digitaloceanspaces.com/n8n-nca-bucket/376082a1-bf47-4ae1-9737-27914a352f8d_output_0.mp4",
    // The JSON used to generate the video (safe to tweak)
    json: {
      "ui": {
        "scene": "A travel vlog hosted by a beautiful long fair haired lady in her mid to late 20s. She is walking the streets of Tokyo, Japan.",
        "driver": "character",
        "wantsCutaways": false,
        "character": "Jackie, 20 something year old beautiful dark haired woman with a gentle smile and warm demeanor ",
        "setting": "Famous street in Tokyo, Japan with Mount Fufi prominently in the background. Golden hours",
        "action": "Jackie is walking the streets of Tokyo while talking into the camera as she vlogs her thoughts about the city ",
        "wantsMusic": true,
        "musicCategoryLabel": "Orchestral / Cinematic",
        "wantsCaptions": true,
        "durationSec": 30,
        "referenceText": "Find the 3 best things and 3 worst thing about visiting Tokyo, Japan and explore those in the vlog script",
        "voiceId": "7e131f74-454c-459a-b13e-431a100a0efb",
        "characterGender": "female",
        "title": "Tokyo vlog",
        "characterName": "Jackie",
        "userEmail": "",        // will be filled from landing inputs
        "userFirstName": "",    // will be filled from landing inputs
        "userLastName": "",     // will be filled from landing inputs
        "advanced": {
          "enabled": true,
          "style": "Cinematic",
          "musicVolume": 0.1,
          "voiceVolume": 1,
          "includeVocals": false,
          "seed": 390869799
        }
      }
    }
  }
];

const EMAIL_KEY = "interview_email_v1";
const FIRSTNAME_KEY = "interview_firstname_v1";
const LASTNAME_KEY = "interview_lastname_v1";

function isValidEmail(s) {
  const v = String(s || "").trim();
  // Simple but effective check
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function LandingPage() {
  const nav = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  // Prefill if user has already visited
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem(EMAIL_KEY);
      const savedFirstName = localStorage.getItem(FIRSTNAME_KEY);
      const savedLastName = localStorage.getItem(LASTNAME_KEY);
      if (savedEmail) setEmail(savedEmail);
      if (savedFirstName) setFirstName(savedFirstName);
      if (savedLastName) setLastName(savedLastName);
    } catch {}
  }, []);

  function handleUseTemplate(tpl) {
    // Save current user info
    const fName = String(firstName || "").trim();
    const lName = String(lastName || "").trim();
    const v = String(email || "").trim();

    if (!fName) return alert("Please enter your first name.");
    if (!lName) return alert("Please enter your last name.");
    if (!isValidEmail(v)) return alert("Please enter a valid email.");

    // Persist user info
    try { localStorage.setItem(FIRSTNAME_KEY, fName); } catch {}
    try { localStorage.setItem(LASTNAME_KEY, lName); } catch {}
    try { localStorage.setItem(EMAIL_KEY, v); } catch {}

    // Merge user info into the template JSON (without mutating the original)
    const payload = JSON.parse(JSON.stringify(tpl.json));
    if (payload && payload.ui) {
      payload.ui.userFirstName = fName;
      payload.ui.userLastName = lName;
      payload.ui.userEmail = v;
    }

    // Save the template so the Interview wizard can prefill from it
    try { localStorage.setItem(TEMPLATE_KEY, JSON.stringify(payload)); } catch {}

    // Ensure the wizard starts at the first step
    try { localStorage.setItem("interview_step_v1", "scene"); } catch {}

    // Go to the interview
    nav("/interview");
  }

  function handleStart(e) {
    e.preventDefault();
    const fName = String(firstName || "").trim();
    const lName = String(lastName || "").trim();
    const v = String(email || "").trim();
    if (!fName) {
      alert("Please enter your first name.");
      return;
    }
    if (!lName) {
      alert("Please enter your last name.");
      return;
    }
    if (!isValidEmail(v)) {
      alert("Please enter a valid email.");
      return;
    }
    try { localStorage.setItem(FIRSTNAME_KEY, fName); } catch {}
    try { localStorage.setItem(LASTNAME_KEY, lName); } catch {}
    try { localStorage.setItem(EMAIL_KEY, v); } catch {}
    try { localStorage.setItem("interview_step_v1", "scene"); } catch {}
    nav("/interview");
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: 24 }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>SceneMe</h1>
        <p style={{ marginTop: 8, color: "#475569" }}>
          Turn ideas into polished AI video—start with a quick interview or pick a ready‑made template. SceneMe orchestrates voices, visuals, and music into a cohesive story.
        </p>
      </header>

      {/* --- Examples Gallery --- */}
      <section className="card" style={{ padding: 18, border: "1px solid #E5E7EB", borderRadius: 12, background: "#fff", marginBottom: 16 }}>
            <h2 style={{ marginTop: 0, marginBottom: 12 }}>See what you can make</h2>
            <p style={{ marginTop: 0, color: "#475569" }}>
              Browse a few ready‑made examples. Watch the preview, then start from a template and customize anything in the wizard.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
              {templates.map((tpl) => (
                <div key={tpl.id} style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 12 }}>
                  <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <video
                      src={tpl.videoUrl}
                      controls
                      style={{ width: 360, maxWidth: "100%", borderRadius: 8, background: "#000" }}
                    />
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <h3 style={{ marginTop: 0, marginBottom: 6 }}>{tpl.title}</h3>
                      <p style={{ marginTop: 0, marginBottom: 12, color: "#475569" }}>{tpl.description}</p>
                      <button
                        type="button"
                        onClick={() => handleUseTemplate(tpl)}
                        className="btn btn-secondary"
                        style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #111827", background: "#fff", color: "#111827" }}
                      >
                        Start with this template
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
      </section>

      <form onSubmit={handleStart} className="card" style={{ padding: 18, border: "1px solid #E5E7EB", borderRadius: 12, background: "#fff" }}>
        <label htmlFor="firstName" style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>First name</label>
        <input
          id="firstName"
          type="text"
          placeholder="First name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #CBD5E1", marginBottom: 12 }}
          required
        />
        <label htmlFor="lastName" style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Last name</label>
        <input
          id="lastName"
          type="text"
          placeholder="Last name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #CBD5E1", marginBottom: 12 }}
          required
        />
        <label htmlFor="email" style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Your email</label>
        <input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #CBD5E1" }}
          required
        />
        <small style={{ display: "block", marginTop: 6, color: "#667085" }}>
          We’ll use this for status updates and delivery. No spam.
        </small>

        <div style={{ marginTop: 16 }}>
          <button type="submit" className="btn btn-primary" style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #111827", background: "#111827", color: "#fff" }}>
            Start
          </button>
        </div>
      </form>
    </div>
  );
}