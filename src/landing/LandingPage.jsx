import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

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
          Turn ideas into polished AI video—start with a quick interview. SceneMe orchestrates voices, visuals, and music into a cohesive story.
        </p>
      </header>

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