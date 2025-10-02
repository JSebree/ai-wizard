import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Template gallery (add more items over time)
const TEMPLATE_KEY = "interview_template_v1";
const templates = [
  {
    id: "tokyo-vlog-1",
    title: "Tokyo Vlog — Jackie",
    kind: "Vlog",
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
        "setting": "Famous street in Tokyo, Japan with Mount Fuji prominently in the background. Golden hours",
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
  },
  {
    id: "lil-cubes-1",
    title: "Lil Cubes!",
    kind: "Podcast",
    description: "AI news podcast hosted by Baby Mark Cuban, 60s Photorealistic.",
    videoUrl: "https://n8n-nca-bucket.nyc3.digitaloceanspaces.com/n8n-nca-bucket/982b419d-3131-4bed-95f0-8fb4691fafdc_output_0.mp4",
    json: {
      "ui": {
        "scene": "A podcast about the future of AI tech hosted by Mark Cuban as a cute cherubic baby",
        "driver": "character",
        "wantsCutaways": false,
        "character": "Mark Cuban as a cute cherubic baby sitting at a podcast studio table with over the ear headphones and cute chubby cheeks",
        "setting": "Baby Mark Cuban sits at a table in a naturally lit podcast studio as he discusses the AI topics of the day.",
        "action": "the baby is sitting at the studio table, moving naturally as if in a live conversation. ",
        "wantsMusic": true,
        "musicCategoryLabel": "Orchestral / Cinematic",
        "wantsCaptions": true,
        "durationSec": 60,
        "referenceText": "Today's top AI news includes a lawsuit against Apple by authors for using copyrighted books in AI training, a settlement by Anthropic for a similar issue, the launch of a national AI infrastructure program by the U.S. National Science Foundation, concerns over \\\"AI psychosis\\\" from heavy chatbot use, and the ongoing competition to dominate the AI landscape with new hardware and applications like Google's AI-powered translation tools and Adobe's Firefly integration, as reported by Reuters and other outlets. \\nLegal & Regulatory Actions\\nApple Sued:\\n.\\nReuters reports that Apple is being sued by authors for allegedly using their copyrighted books to train its AI systems. \\nAnthropic Settlement:\\n.\\nAI company Anthropic agreed to a $1.5 billion settlement in a class-action lawsuit over the use of books in AI training, according to Reuters and Reddit users. \\nUS AI Infrastructure:\\n.\\nThe U.S. National Science Foundation launched the Integrated Data Systems and Services (IDSS) program, a new national-scale AI infrastructure project, to support AI research. \\nAI Applications & Technology\\nAI Psychosis Concern:\\n.\\nReports of a phenomenon called \\\"AI psychosis,\\\" where users lose touch with reality after heavy chatbot use, are gaining traction, according to NBC News. \\nGoogle AI Updates:\\n.\\nGoogle is integrating its Gemini AI into Adobe's Firefly for image editing and is also rolling out AI-powered live translation and a language learning tool within Google Translate, notes YouTube. \\nAI in Health:\\n.\\nAI is being used to detect dangerous heart conditions with an AI stethoscope and to predict virus evolution for flu vaccine strain selection. \\nInternational & Corporate Developments\\nGreece & OpenAI Deal:\\n.\\nGreece and OpenAI have agreed to a deal to promote innovation in schools and small businesses, according to Reuters. \\nNvidia Supercomputer in Germany:\\n.\\nGermany's Merz inaugurated a Nvidia supercomputer dedicated to research, according to Reuters. \\nHumanoid Robot Competitions:\\n.\\nChina recently hosted the world's first humanoid robot games, showcasing robots competing in sports like soccer and boxing, as highlighted by The Wall Street Journal. ",
        "voiceId": "95207c9d-1460-4cde-8f44-77d1a15af200",
        "characterGender": "male",
        "title": "Lil Cubes!",
        "characterName": "Lil Cubes",
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
    videoUrl: "https://n8n-nca-bucket.nyc3.digitaloceanspaces.com/n8n-nca-bucket/22d17095-c11d-4ec2-9f32-24a5bcb1ded6_output_0.mp4",
    json: {
      "ui": {
        "scene": "A newscast about the future of AI tech hosted by Mark Zuckerberg as a cute cherubic baby. Cutaway scenes of AI hardware and robotics in line with the topics of the day",
        "driver": "character",
        "wantsCutaways": true,
        "character": "Mark Zuckerberg as a cute cherubic baby sitting in a newsroom table and dressed like a news reporter",
        "setting": "Baby Mark Zuckerberg sits at a newsroom desk in a naturally lit room as he discusses the AI topics of the day. B-Roll cutaways featuring AI tech and robotics that are in line with the covered topics of the day",
        "action": "the baby is sitting at the newsroom desk, moving naturally as if in a live conversation. ",
        "wantsMusic": true,
        "musicCategoryLabel": "Lo-Fi / Chillhop",
        "wantsCaptions": true,
        "durationSec": 45,
        "referenceText": "Today's top AI news includes a lawsuit against Apple by authors for using copyrighted books in AI training, a settlement by Anthropic for a similar issue, the launch of a national AI infrastructure program by the U.S. National Science Foundation, concerns over \\\"AI psychosis\\\" from heavy chatbot use, and the ongoing competition to dominate the AI landscape with new hardware and applications like Google's AI-powered translation tools and Adobe's Firefly integration, as reported by Reuters and other outlets. \\nLegal & Regulatory Actions\\nApple Sued:\\n.\\nReuters reports that Apple is being sued by authors for allegedly using their copyrighted books to train its AI systems. \\nAnthropic Settlement:\\n.\\nAI company Anthropic agreed to a $1.5 billion settlement in a class-action lawsuit over the use of books in AI training, according to Reuters and Reddit users. \\nUS AI Infrastructure:\\n.\\nThe U.S. National Science Foundation launched the Integrated Data Systems and Services (IDSS) program, a new national-scale AI infrastructure project, to support AI research. \\nAI Applications & Technology\\nAI Psychosis Concern:\\n.\\nReports of a phenomenon called \\\"AI psychosis,\\\" where users lose touch with reality after heavy chatbot use, are gaining traction, according to NBC News. \\nGoogle AI Updates:\\n.\\nGoogle is integrating its Gemini AI into Adobe's Firefly for image editing and is also rolling out AI-powered live translation and a language learning tool within Google Translate, notes YouTube. \\nAI in Health:\\n.\\nAI is being used to detect dangerous heart conditions with an AI stethoscope and to predict virus evolution for flu vaccine strain selection. \\nInternational & Corporate Developments\\nGreece & OpenAI Deal:\\n.\\nGreece and OpenAI have agreed to a deal to promote innovation in schools and small businesses, according to Reuters. \\nNvidia Supercomputer in Germany:\\n.\\nGermany's Merz inaugurated a Nvidia supercomputer dedicated to research, according to Reuters. \\nHumanoid Robot Competitions:\\n.\\nChina recently hosted the world's first humanoid robot games, showcasing robots competing in sports like soccer and boxing, as highlighted by The Wall Street Journal. ",
        "voiceId": "4080632d-4364-44f2-9e27-451574f1b96f",
        "characterGender": "male",
        "title": "Baby Zuck!",
        "characterName": "Baby Zuck",
        "userEmail": "",
        "userFirstName": "",
        "userLastName": "",
        "advanced": {
          "enabled": true,
          "style": "Newscast",
          "musicVolume": 0.1,
          "voiceVolume": 1,
          "includeVocals": false,
          "seed": 968539143
        }
      }
    }
  },
  {
    id: "zombs-ghost-1",
    title: "Zombs — Halloween Ghost Story",
    kind: "Storytelling",
    description: "45 second ghost story told by a teenage zombie around a campfire on Halloween night.",
    videoUrl: "https://n8n-nca-bucket.nyc3.digitaloceanspaces.com/n8n-nca-bucket/5d94d9cb-9b47-49c3-aa4c-c981f4510c16_output_0.mp4",
    json: {
      "ui": {
        "scene": "A 45 second ghost story on Halloween told by a teenage zombie in a dark sleepy haunted Halloween town",
        "driver": "character",
        "wantsCutaways": true,
        "character": "A green-faced tattered skin clothes ripped zombie with red hair and expressive eyes",
        "setting": "A campfire at the edge of the woods beside a sleepy old haunted town on Halloween",
        "action": "A teenage zombie telling a ghost story to smaller little zombies Around a campfire. B-Roll cutaways to ghost scenes that support the story.",
        "wantsMusic": true,
        "musicCategoryLabel": "Lo-Fi / Chillhop",
        "wantsCaptions": true,
        "durationSec": 45,
        "referenceText": "Generate a 45 second ghost story that is short but thrilling, fitting for a Halloween campfire story.",
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
          "seed": 928453185
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
              Quick examples you can start from.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
              {templates.map((tpl) => (
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
                      onClick={() => handleUseTemplate(tpl)}
                      className="btn btn-secondary"
                      style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #111827", background: "#fff", color: "#111827", fontWeight: 600 }}
                    >
                      Use as template
                    </button>
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