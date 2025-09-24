import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const EMAIL_KEY = "interview_email_v1";

function isValidEmail(s) {
  const v = String(s || "").trim();
  // Simple but effective check
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function LandingPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");

  // Prefill if user has already visited
  useEffect(() => {
    try {
      const saved = localStorage.getItem(EMAIL_KEY);
      if (saved) setEmail(saved);
    } catch {}
  }, []);

  function handleStart(e) {
    e.preventDefault();
    const v = String(email || "").trim();
    if (!isValidEmail(v)) {
      alert("Please enter a valid email.");
      return;
    }
    try { localStorage.setItem(EMAIL_KEY, v); } catch {}
    nav("/interview");
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: 24 }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>SceneMe</h1>
        <p style={{ marginTop: 8, color: "#475569" }}>
          Turn ideas into polished AI video—start with a quick interview. SceneMe orchestrates voices, visuals, and music into a cohesive story.
        </p>
      </header>

      <form onSubmit={handleStart} className="card" style={{ padding: 18, border: "1px solid #E5E7EB", borderRadius: 12, background: "#fff" }}>
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
            Start Interview →
          </button>
        </div>
      </form>
    </div>
  );
}