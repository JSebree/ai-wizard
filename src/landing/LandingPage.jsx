import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Template gallery (add more items over time)
const TEMPLATE_KEY = "interview_template_v1";
const templates = [
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
        "referenceText": "Generate a 30 second testimonial advertisement that features a delicious cheeseburger. Be sure to highlight the delicious taste, affordability, and convenience. End scene with a B-Roll cutaway clip of a gourmet cheeseburger when the narrator says \"the classic crusty burger, now only five ninety-nine!\"",
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
    videoUrl: "https://n8n-nca-bucket.nyc3.digitaloceanspaces.com/n8n-nca-bucket/17fc44ac-c8ea-4308-94cf-1914d03060fe_output_0.mp4",
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
        "referenceText": "Today's top AI news includes a lawsuit against Apple by authors for using copyrighted books in AI training, a settlement by Anthropic for a similar issue, the launch of a national AI infrastructure program by the U.S. National Science Foundation, concerns over \\\"AI psychosis\\\" from heavy chatbot use, and the ongoing competition to dominate the AI landscape with new hardware and applications like Google's AI-powered translation tools and Adobe's Firefly integration, as reported by Reuters and other outlets. \\nLegal &amp; Regulatory Actions\\nApple Sued:\\n.\\nReuters reports that Apple is being sued by authors for allegedly using their copyrighted books to train its AI systems. \\nAnthropic Settlement:\\n.\\nAI company Anthropic agreed to a $1.5 billion settlement in a class-action lawsuit over the use of books in AI training, according to Reuters and Reddit users. \\nUS AI Infrastructure:\\n.\\nThe U.S. National Science Foundation launched the Integrated Data Systems and Services (IDSS) program, a new national-scale AI infrastructure project, to support AI research. \\nAI Applications &amp; Technology\\nAI Psychosis Concern:\\n.\\nReports of a phenomenon called \\\"AI psychosis,\\\" where users lose touch with reality after heavy chatbot use, are gaining traction, according to NBC News. \\nGoogle AI Updates:\\n.\\nGoogle is integrating its Gemini AI into Adobe's Firefly for image editing and is also rolling out AI-powered live translation and a language learning tool within Google Translate, notes YouTube. \\nAI in Health:\\n.\\nAI is being used to detect dangerous heart conditions with an AI stethoscope and to predict virus evolution for flu vaccine strain selection. \\nInternational &amp; Corporate Developments\\nGreece &amp; OpenAI Deal:\\n.\\nGreece and OpenAI have agreed to a deal to promote innovation in schools and small businesses, according to Reuters. \\nNvidia Supercomputer in Germany:\\n.\\nGermany's Merz inaugurated a Nvidia supercomputer dedicated to research, according to Reuters. \\nHumanoid Robot Competitions:\\n.\\nChina recently hosted the world's first humanoid robot games, showcasing robots competing in sports like soccer and boxing, as highlighted by The Wall Street Journal. ",
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
  },
  {
    id: "kendra-testimonial-1",
    title: "Kendra Testimonial Ad",
    kind: "Testimonial",
    description: "30s car-seat testimonial ad about a delicious, affordable burger.",
    videoUrl: "https://n8n-nca-bucket.nyc3.digitaloceanspaces.com/n8n-nca-bucket/15b73581-e625-4d7d-812e-e05f968322c6_output_0.mp4",
    json: {
      "ui": {
        "scene": "A 30 second testimonial advertisement staring a young woman sitting in here car discussing how delicious and affordable her burger is",
        "driver": "character",
        "wantsCutaways": false,
        "character": "A beautiful 20 something year old African American woman with expressive eyes and bubbly personality ",
        "setting": "The setting is inside of a car. The scene takes place in the front seat where the character is sitting and holding a juicy gourmet burger in one hand.",
        "action": "The young woman sits in the front seat of her car, delivering a testimonial about a burger that she just ordered. She talks happily as she shows the burger in her hands",
        "wantsMusic": true,
        "musicCategoryLabel": "Lo-Fi / Chillhop",
        "wantsCaptions": true,
        "durationSec": 30,
        "referenceText": "Generate a 30 second testimonial advertisement that features a delicious cheeseburger. Be sure to highlight the delicious taste, affordability, and convenience ",
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
                  const order = { "Featured": 0, "Advertisement": 0, "Newscast": 1, "Podcast": 2, "Vlog": 3, "Storytelling": 4 };
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