import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Simple IOS Detection
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

// Template gallery (add more items over time)
const TEMPLATE_KEY = "interview_template_v1";
export const templates = [
  {
    id: "nikola-tesla-doc-1",
    title: "Nikola Tesla — Documentary",
    kind: "Documentary",
    featured: true,
    description: "60s documentary hosted by Nikola Tesla with cinematic cutaways.",
    videoUrl: "https://video-generations.nyc3.digitaloceanspaces.com/upscaled/episodes/Tesla_upscaled.mp4",
    json: {
      "ui": {
        "scene": "A 60 second documentary about Nikola Tesla greatest accomplishments, hosted by Nikola Tesla himself. B-Roll cutaways to clips of his most famous accomplishments",
        "driver": "character",
        "wantsCutaways": true,
        "character": "Nikola Tesla sits in an old Victorian era armchair. He is wearing his usual suit as he looks to the camera to speak",
        "setting": "Nikola Tesla sits in an old Victorian era armchair in an Industrial era executive office. He is wearing his usual suit as he looks to the camera to speak",
        "action": "Nikola Tesla sits in an old Victorian era armchair in an Industrial era executive office. He is wearing his usual suit as he looks to the camera to speak. ",
        "wantsMusic": true,
        "musicCategoryLabel": "Orchestral / Cinematic",
        "wantsCaptions": true,
        "durationSec": 60,
        "referenceText": "Create a viral 60-second documentary video of Nikola Tesla showcasing the top two or three of his greatest inventions. Tesla, in a Victorian armchair within an industrial-era office, narrates his life’s work. Include cinematic B-roll of his experiments, innovations, and achievements as he reflects on his legacy.",
        "research": true,
        "voiceId": "caad6ab8-9cac-49e9-8b7b-21c0f3a18ae2",
        "characterGender": "male",
        "title": "Nikola Tesla",
        "characterName": "Nikola Tesla",
        "userEmail": "",
        "userFirstName": "",
        "userLastName": "",
        "advanced": {
          "enabled": true,
          "style": "Documentary",
          "musicVolume": 0.1,
          "voiceVolume": 1,
          "includeVocals": false,
          "seed": 805577011
        }
      }
    }
  },
  {
    id: "kendra-testimonial-featured",
    title: "Kendra Testimonial Ad — Cutaway",
    kind: "Advertisement",
    featured: true,
    description: "30s car-seat testimonial that ends with a burger B‑roll cutaway + price callout.",
    videoUrl: "https://video-generations.nyc3.digitaloceanspaces.com/upscaled/episodes/Burger_Ad.mp4",
    json: {
      "ui": {
        "scene": "A 30 second testimonial advertisement staring a young woman sitting in here car discussing how delicious and affordable her burger is. end scene with a B-Roll cutaway clip of a gourmet cheeseburger when the narrator says \"the classic crusty burger, now only five ninety-nine!\"",
        "driver": "character",
        "wantsCutaways": true,
        "character": "A beautiful 20 something year old African American woman with expressive eyes and bubbly personality, holding a gourmet cheeseburger in one hand ",
        "setting": "The setting is inside of a car. The scene takes place in the front seat where the character is sitting and holding a juicy gourmet burger in one hand.",
        "action": "The young woman sits in the front seat of her car, delivering a testimonial about a burger that she just ordered. She talks happily as she shows the burger in her hands",
        "wantsMusic": true,
        "musicCategoryLabel": "Lo-Fi / Chillhop",
        "wantsCaptions": true,
        "durationSec": 30,
        "referenceText": "Create a 30‑second testimonial ad. A lively young woman sits in her car holding a juicy cheeseburger, speaking to camera about taste, price, and convenience. End with cinematic burger B‑roll as a narrator says: “The Classic Crusty Burger—now only $5.99!”",
        "research": true,
        "voiceId": "c9dd06ff-04eb-4b8e-b274-62b23bf54242",
        "characterGender": "female",
        "title": "Kendra ad",
        "characterName": "Kendra",
        "userEmail": "",
        "userFirstName": "",
        "userLastName": "",
        "advanced": {
          "enabled": true,
          "style": "Photorealistic",
          "musicVolume": 0.1,
          "voiceVolume": 1,
          "includeVocals": false,
          "seed": 927896146
        }
      }
    }
  },
  {
    id: "tokyo-vlog-1",
    title: "Tokyo Vlog — Jackie",
    kind: "Vlog",
    description: "Travel vlog in Tokyo with A‑roll narration, cinematic style, 30s.",
    // Preview video users can watch
    videoUrl: "https://video-generations.nyc3.digitaloceanspaces.com/upscaled/episodes/Tokyo_Vlog.mp4",
    // The JSON used to generate the video (safe to tweak)
    json: {
      "ui": {
        "scene": "A travel vlog hosted by a beautiful long dark haired lady in her mid to late 20s. She is walking the streets of Tokyo, Japan.",
        "driver": "character",
        "wantsCutaways": false,
        "character": "Jackie, 20 something year old beautiful dark haired woman with a gentle smile and warm demeanor ",
        "setting": "Famous street in Tokyo, Japan with Mount Fuji prominently in the background. Golden hours",
        "action": "Jackie is walking the streets of Tokyo while talking into the camera as she vlogs her thoughts about the city ",
        "wantsMusic": true,
        "musicCategoryLabel": "Orchestral / Cinematic",
        "wantsCaptions": true,
        "durationSec": 30,
        "referenceText": "The most compelling reasons to move to Tokyo from San Francisco in 2026.",
        "research": true,
        "voiceId": "7e131f74-454c-459a-b13e-431a100a0efb",
        "characterGender": "female",
        "title": "Tokyo vlog",
        "characterName": "Jackie",
        "userEmail": "",
        "userFirstName": "",
        "userLastName": "",
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
  },
  {
    id: "lil-cubes-1",
    title: "Tiny Tech Execs — Bezzie",
    kind: "Podcast",
    description: "AI news podcast hosted by Baby Jeff Bezos, 60s Photorealistic.",
    videoUrl: "https://video-generations.nyc3.digitaloceanspaces.com/upscaled/episodes/Lil_Bezzie.mp4",
    json: {
      "ui": {
        "scene": "A podcast about the future of AI tech hosted by Jeff Bezos as a cute cherubic baby",
        "driver": "character",
        "wantsCutaways": false,
        "character": "Jeff Bezos as a cute cherubic baby sitting at a podcast studio table with over the ear headphones and cute chubby cheeks",
        "setting": "Jeff Bezos as a baby sits at a table in a naturally lit podcast studio as he discusses the AI topics of the day.",
        "action": "Jeff Bezos as a baby is sitting at the studio table, moving naturally as if in a live conversation. ",
        "wantsMusic": true,
        "musicCategoryLabel": "Orchestral / Cinematic",
        "wantsCaptions": true,
        "durationSec": 60,
        "referenceText": "Latest, most impactful AI news and developments over the last 48 hours.",
        "research": true,
        "voiceId": "58466a9b-470c-4161-9967-b88f4a95d6b2",
        "characterGender": "male",
        "title": "Tiny Tech Execs",
        "characterName": "Bezzie",
        "userEmail": "",
        "userFirstName": "",
        "userLastName": "",
        "advanced": {
          "enabled": true,
          "style": "Photorealistic",
          "musicVolume": 0.1,
          "voiceVolume": 1,
          "includeVocals": false,
          "seed": 182686378
        }
      }
    }
  },
  {
    id: "newscast-baby-zuck-1",
    title: "Newscast — Baby Zuck",
    kind: "Newscast",
    description: "AI newscast with A‑roll+B‑roll cutaways, 45s.",
    videoUrl: "https://video-generations.nyc3.digitaloceanspaces.com/upscaled/episodes/Baby_Zuck.mp4",
    json: {
      "ui": {
        "scene": "A newscast about the future of AI tech hosted by Mark Zuckerberg as a cute cherubic infant. Cutaway scenes of AI hardware and robotics in line with the topics of the day",
        "driver": "character",
        "wantsCutaways": true,
        "character": "Mark Zuckerberg as a cute cherubic infant with cute chubby cheeks and expressive eyes, sitting in an evening news anchor table and dressed in an anchor host",
        "setting": "Infant Mark Zuckerberg sits at an evening news anchor desk, studio lit room as he discusses breaking AI news topics of the day. B-Roll cutaways featuring AI tech and robotics that are in line with the covered topics of the day",
        "action": "the infant Mark Zuckerberg is sitting at the evening news anchor desk, moving naturally as if in a live conversation as he breaks news. ",
        "wantsMusic": true,
        "musicCategoryLabel": "Ambient / Soundscape",
        "wantsCaptions": true,
        "durationSec": 45,
        "referenceText": "45‑second AI newscast with anchor narration and B‑roll. Cover: lawsuits over AI training data (Apple suit, Anthropic settlement); U.S. NSF AI infrastructure launch; risks from heavy chatbot use; product updates (Google+Adobe, Translate); and global moves (Greece–OpenAI, German Nvidia supercomputer, China humanoid‑robot games).",
        "voiceId": "4080632d-4364-44f2-9e27-451574f1b96f",
        "characterGender": "male",
        "title": "Baby Zuck!",
        "characterName": "Baby Zuck",
        "userEmail": "jerick.sebree@gmail.com",
        "userFirstName": "Jerick",
        "userLastName": "Sebree",
        "advanced": {
          "enabled": true,
          "style": "Pixar-style",
          "musicVolume": 0.1,
          "voiceVolume": 1,
          "includeVocals": false,
          "seed": 446625324
        }
      }
    }
  },
  {
    id: "zombs-ghost-1",
    title: "Zombs — Halloween Ghost Story",
    kind: "Storytelling",
    description: "45 second ghost story told by a teenage zombie around a campfire on Halloween night.",
    videoUrl: "https://video-generations.nyc3.digitaloceanspaces.com/upscaled/episodes/Storytelling_Cartoon.mp4",
    json: {
      "ui": {
        "scene": "A 45 second scary story on Halloween told by a teenage zombie in a dark sleepy haunted Halloween town",
        "driver": "character",
        "wantsCutaways": true,
        "character": "A green-faced tattered skin clothes ripped zombie with red hair and expressive eyes",
        "setting": "A campfire at the edge of the woods beside a sleepy old haunted town on Halloween",
        "action": "A teenage zombie telling a scary story to smaller little zombies Around a campfire. B-Roll cutaways to scenes of the zombies story.",
        "wantsMusic": true,
        "musicCategoryLabel": "Ambient / Soundscape",
        "wantsCaptions": true,
        "durationSec": 45,
        "referenceText": "Generate a 45‑second campfire ghost story for Halloween. A teenage zombie narrates to younger zombies; include quick cutaways to key moments. Keep it spooky but PG.",
        "voiceId": "abc62a09-8c40-4af6-9d48-235d592fd20c",
        "characterGender": "male",
        "title": "Zombs",
        "characterName": "Zombs",
        "userEmail": "",
        "userFirstName": "",
        "userLastName": "",
        "advanced": {
          "enabled": true,
          "style": "Anime",
          "musicVolume": 0.1,
          "voiceVolume": 1,
          "includeVocals": false,
          "seed": 926101120
        }
      }
    }
  },
  {
    id: "storybook-bunny-1",
    title: "Storybook — Little Bunny",
    kind: "Storybook",
    description: "60s children's storybook narration about a small white bunny finding her way home.",
    videoUrl: "https://video-generations.nyc3.digitaloceanspaces.com/upscaled/episodes/Storybook_upscaled.mp4",
    json: {
      "ui": {
        "scene": "A short 60 second children's book about a small white bunny trying to find her way home",
        "driver": "narrator",
        "character": null,
        "setting": "a clearing deep in the forest near a meadow with running streams. it is the golden hour and beginning to get dark",
        "action": "The bunny hops around to other animals looking for her way home",
        "wantsMusic": true,
        "musicCategoryLabel": "Lo-Fi / Chillhop",
        "wantsCaptions": true,
        "durationSec": 60,
        "referenceText": "Create a 60‑second children’s story about a small white bunny finding her way home at sunset through a forest. Gentle, hopeful tone; simple narration; visuals follow the journey.",
        "voiceId": "dcdc1cc3-d4ca-46c0-ae7c-5300b7e34854",
        "characterGender": "female",
        "title": "storybook",
        "characterName": "narrator",
        "userEmail": "",
        "userFirstName": "",
        "userLastName": "",
        "advanced": {
          "enabled": true,
          "style": "Anime",
          "musicVolume": 0.1,
          "voiceVolume": 1,
          "includeVocals": false,
          "seed": 923024407
        }
      }
    }
  }
];

export default function LandingPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    // Check if event already fired (Race Condition Fix)
    if (window.deferredPrompt) {
      setInstallPrompt(window.deferredPrompt);
    }

    const handler = (e) => {
      e.preventDefault();
      window.deferredPrompt = e; // Sync global
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  async function handleInstallClick() {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallPrompt(null);
    }
  }

  // Navigate to a path, injecting user info if a template is provided
  function handleNavigate(path, tpl = null) {
    // If not logged in, redirect to login
    if (!user) {
      nav("/login");
      return;
    }

    // Get user info from auth context
    const userEmail = user.email || "";
    const userFullName = user.user_metadata?.full_name || user.user_metadata?.name || "";
    const nameParts = userFullName.split(" ");
    const userFirstName = nameParts[0] || "";
    const userLastName = nameParts.slice(1).join(" ") || "";

    // If a template was chosen, merge user info & save to localStorage
    if (tpl) {
      const payload = JSON.parse(JSON.stringify(tpl.json));
      if (payload && payload.ui) {
        payload.ui.userFirstName = userFirstName;
        payload.ui.userLastName = userLastName;
        payload.ui.userEmail = userEmail;
      }
      try { localStorage.setItem(TEMPLATE_KEY, JSON.stringify(payload)); } catch { }
      try { localStorage.setItem("interview_step_v1", "scene"); } catch { }
    }

    nav(path);
  }

  // Hide the global "Review" button ONLY on the Landing page
  useEffect(() => {
    // Heuristic: find a top-right "Review" button rendered by the app header
    // and temporarily hide it for this page only.
    const candidates = Array.from(document.querySelectorAll('button, a'));
    const toHide = candidates.find((el) => {
      const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
      return txt === 'review';
    });

    // If found, hide and remember prior inline styles to restore on unmount
    let prevDisplay, prevVisibility;
    if (toHide) {
      prevDisplay = toHide.style.display;
      prevVisibility = toHide.style.visibility;
      toHide.style.display = 'none';
      toHide.style.visibility = 'hidden';
      toHide.setAttribute('data-hidden-by-landing', 'true');
    }

    return () => {
      // Restore when leaving this page so other routes keep the button
      const el = document.querySelector('[data-hidden-by-landing="true"]');
      if (el) {
        el.style.display = prevDisplay ?? '';
        el.style.visibility = prevVisibility ?? '';
        el.removeAttribute('data-hidden-by-landing');
      }
    };
  }, []);

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: 24 }}>
      <style>{`
        .examplesGrid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        @media (min-width: 700px) {
          .examplesGrid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (min-width: 1024px) {
          .examplesGrid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
      <header style={{ marginBottom: 24, textAlign: "center" }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 12px", color: "#111827", lineHeight: 1.2 }}>
          Stop prompting. Start directing. From anywhere.
        </h1>
        <p style={{ marginTop: 0, color: "#475569", lineHeight: 1.5 }}>
          The first Hollywood-grade production studio that fits in your pocket. SceneMe transforms your ideas into consistent, high-fidelity videos—giving you complete control over characters, settings, and soundscapes. Whether you're using our one-click <strong>Express Mode</strong> or building a multi-scene masterpiece in <strong>Studio Mode</strong>, you have the power of a full production team right on your device.
        </p>
      </header>

      {/* --- Primary CTA (centered) --- */}
      <section style={{ textAlign: "center", marginBottom: 20 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            onClick={() => handleNavigate("/interview")}
            className="btn btn-primary"
            style={{
              padding: "12px 18px",
              borderRadius: 8,
              border: "1px solid #111827",
              background: "#111827",
              color: "#fff",
              fontWeight: 700,
            }}
          >
            Express Mode
          </button>
          <button
            type="button"
            onClick={() => handleNavigate("/studios")}
            className="btn btn-secondary"
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              color: "#111827",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Studio Mode
          </button>

          {(installPrompt || (isIOS && !isStandalone)) && (
            <button
              type="button"
              onClick={handleInstallClick}
              className="btn btn-secondary"
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid #E5E7EB",
                background: "#F9FAFB",
                color: "#111827",
                fontWeight: 600,
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Install App
            </button>
          )}
        </div>
      </section>


      {/* --- Examples Gallery --- */}
      < section className="card" style={{ padding: 18, border: "1px solid #E5E7EB", borderRadius: 12, background: "#fff", marginBottom: 16 }
      }>
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>Get inspired</h2>
        <p style={{ marginTop: 0, color: "#475569" }}>
          Explore examples to inspire you—or use them to jump-start your own scene.
        </p>

        <div className="examplesGrid">
          {templates
            .slice()
            .sort((a, b) => {
              // Enforce strict global order by kind
              const ORDER = [
                "Documentary",
                "Vlog",
                "Newscast",
                "Podcast",
                "Advertisement",
                "Storytelling",
                "Storybook",
              ];
              const idx = (k) => {
                const i = ORDER.findIndex((s) => s.toLowerCase() === String(k || "").toLowerCase());
                return i === -1 ? ORDER.length : i;
              };

              const ai = idx(a.kind);
              const bi = idx(b.kind);
              if (ai !== bi) return ai - bi;

              // Within the same kind, prefer featured items first
              if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1;

              // Otherwise preserve original order (stable sort fallback)
              return 0;
            })
            .map((tpl) => (
              <div key={tpl.id} style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 12, background: "#fff" }}>
                <video
                  src={tpl.videoUrl}
                  controls
                  style={{ width: "100%", borderRadius: 8, background: "#000", display: "block" }}
                />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 8px", border: "1px solid #E5E7EB", borderRadius: 999, color: "#334155" }}>
                    {tpl.kind || "Template"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleNavigate("/interview", tpl)}
                    className="btn btn-secondary"
                    style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #111827", background: "#fff", color: "#111827", fontWeight: 600, fontSize: 12 }}
                  >
                    Use as template
                  </button>
                </div>
              </div>
            ))}
        </div>
      </section >



      {/* --- Intake Modal --- */}
      {
        showIOSInstructions && (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2000
            }}
            onClick={() => setShowIOSInstructions(false)}
          >
            <div style={{ width: "90%", maxWidth: 360, background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}>
              <h3 style={{ marginTop: 0, fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Install on iPhone</h3>
              <p style={{ color: "#4B5563", marginBottom: 20 }}>
                iOS doesn't support a direct install button yet. Here is the trick:
              </p>
              <ol style={{ paddingLeft: 20, color: "#374151", marginBottom: 20, lineHeight: 1.6 }}>
                <li>Tap the <strong>Share Icon</strong> <span style={{ fontSize: 18 }}>⎋</span> below.</li>
                <li>Scroll down and tap <strong>Add to Home Screen</strong> <span style={{ fontSize: 18 }}>⊞</span>.</li>
              </ol>
              <button
                onClick={() => setShowIOSInstructions(false)}
                style={{ width: "100%", padding: 12, background: "#111827", color: "#fff", borderRadius: 8, fontWeight: 600 }}
              >
                Got it
              </button>
            </div>
          </div>
        )
      }
    </div >
  );
}