import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Template gallery (add more items over time)
const TEMPLATE_KEY = "interview_template_v1";
const templates = [
  {
    id: "nikola-tesla-doc-1",
    title: "Nikola Tesla — Documentary",
    kind: "Documentary",
    featured: true,
    description: "60s documentary hosted by Nikola Tesla with cinematic cutaways.",
    videoUrl: "https://n8n-nca-bucket.nyc3.digitaloceanspaces.com/n8n-nca-bucket/07c21780-8dad-44d2-a190-02a0ed5a4b3f_output_0.mp4",
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
    videoUrl: "https://n8n-nca-bucket.nyc3.digitaloceanspaces.com/n8n-nca-bucket/79fcae61-ae4c-4159-a04d-460e88051194_output_0.mp4",
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
    videoUrl: "https://n8n-nca-bucket.nyc3.digitaloceanspaces.com/n8n-nca-bucket/65b20950-c34c-4d4f-97c2-b455dffd5dca_output_0.mp4",
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
    videoUrl: "https://n8n-nca-bucket.nyc3.digitaloceanspaces.com/n8n-nca-bucket/0ef8e79d-aa51-4ba5-8167-4cae3c12f13a_output_0.mp4",
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
    videoUrl: "https://n8n-nca-bucket.nyc3.digitaloceanspaces.com/n8n-nca-bucket/20e15a25-a114-49b8-afc0-e7185c23de6c_output_0.mp4",
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
    videoUrl: "https://n8n-nca-bucket.nyc3.digitaloceanspaces.com/n8n-nca-bucket/9033b835-7633-4531-a196-7a26d5b1cdb6_output_0.mp4",
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
    videoUrl: "https://n8n-nca-bucket.nyc3.digitaloceanspaces.com/n8n-nca-bucket/8f2b0d5b-8046-46ac-9c86-1ab61db3c1c5_output_0.mp4",
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
  const [showForm, setShowForm] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState(null);

  function openForm(tpl = null) {
    setPendingTemplate(tpl);
    setShowForm(true);
  }
  function closeForm() {
    setPendingTemplate(null);
    setShowForm(false);
  }

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

  function handleSubmitUser(e) {
    if (e) e.preventDefault();

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
    try { localStorage.setItem("interview_step_v1", "scene"); } catch {}

    // If a template was chosen, merge user info & proceed via existing logic
    if (pendingTemplate) {
      const tpl = pendingTemplate;
      const payload = JSON.parse(JSON.stringify(tpl.json));
      if (payload && payload.ui) {
        payload.ui.userFirstName = fName;
        payload.ui.userLastName = lName;
        payload.ui.userEmail = v;
      }
      try { localStorage.setItem(TEMPLATE_KEY, JSON.stringify(payload)); } catch {}
      closeForm();
      nav("/interview");
      return;
    }

    // No template → just go to interview
    closeForm();
    nav("/interview");
  }

  function handleUseTemplate(tpl) {
    openForm(tpl);
  }

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
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>SceneMe</h1>
        <p style={{ marginTop: 8, color: "#475569" }}>
          SceneMe transforms ideas into consistent AI videos—complete with character voices, visuals, and music. No juggling APIs, no stitching together messy clips—just bring your imagination, and SceneMe does the rest. Create your own today, or start from a template below.
        </p>
      </header>

      {/* --- Primary CTA (centered) --- */}
      <section style={{ textAlign: "center", marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => openForm(null)}
          className="btn btn-primary"
          style={{ padding: "12px 18px", borderRadius: 8, border: "1px solid #111827", background: "#111827", color: "#fff", fontWeight: 700 }}
        >
          Create your own
        </button>
      </section>

      {/* --- Examples Gallery --- */}
      <section className="card" style={{ padding: 18, border: "1px solid #E5E7EB", borderRadius: 12, background: "#fff", marginBottom: 16 }}>
            <h2 style={{ marginTop: 0, marginBottom: 12 }}>Get inspired</h2>
            <p style={{ marginTop: 0, color: "#475569" }}>
              Explore examples to inspire you—or use them to jump-start your own scene.
            </p>

            <div className="examplesGrid">
              {templates
                .slice()
                .sort((a, b) => {
                  // Prioritize featured templates first
                  if (a.featured && !b.featured) return -1;
                  if (b.featured && !a.featured) return 1;
                  const order = { "Documentary": 0, "Vlog": 1, "Newscast": 2, "Podcast": 3, "Advertisement": 4, "Storytelling": 5, "Storybook": 6 };
                  const ai = order[a.kind] || 99;
                  const bi = order[b.kind] || 99;
                  return ai - bi;
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
                      onClick={() => openForm(tpl)}
                      className="btn btn-secondary"
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #111827", background: "#fff", color: "#111827", fontWeight: 600, fontSize: 12 }}
                    >
                      Use as template
                    </button>
                  </div>
                </div>
              ))}
            </div>
      </section>

      {/* --- Intake Modal --- */}
      {showForm && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
          onClick={(e) => {
            // close when clicking backdrop only
            if (e.target === e.currentTarget) closeForm();
          }}
        >
          <div style={{ width: "100%", maxWidth: 520, background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
            <h3 style={{ marginTop: 0, marginBottom: 6 }}>
              {pendingTemplate ? "Use template" : "Create your own"}
            </h3>
            <p style={{ marginTop: 0, color: "#475569" }}>
              Tell us where to send status updates and your finished video.
            </p>
            <form onSubmit={handleSubmitUser}>
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

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                <button
                  type="button"
                  onClick={closeForm}
                  className="btn btn-secondary"
                  style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", color: "#111827" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #111827", background: "#111827", color: "#fff" }}
                >
                  Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}