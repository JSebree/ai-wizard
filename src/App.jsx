import React from "react";
import { Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import InterviewPage from "./interview/InterviewPage.jsx";
import LandingPage from "./landing/LandingPage.jsx";
import LogoLight from "./assets/sceneme_black_icon_transparent.png"; // black logo for light mode

function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <header>
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3 min-h-[56px]">
        <Link
          to="/"
          onClick={(e) => {
            if (location.pathname === "/") {
              e.preventDefault();
              try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}
            } else {
              e.preventDefault();
              navigate("/");
            }
          }}
          className="font-semibold tracking-tight cursor-pointer select-none"
          title="Start a new interview"
        >
          <span className="sr-only">SceneMe</span>
          <img
            src={LogoLight}
            alt="SceneMe"
            className="h-8 w-auto"
            height={32}
          />
        </Link>
        <button
          type="button"
          onClick={() => {
            if (location.pathname !== "/interview") {
              navigate("/interview");
              // Give InterviewPage a moment to mount before dispatching
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent("interview:goReviewStep"));
              }, 250);
            } else {
              window.dispatchEvent(new CustomEvent("interview:goReviewStep"));
            }
          }}
          className="text-sm px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
          title="Go to Review step"
        >
          Review
        </button>
      </div>
    </header>
  );
}

function AppShell() {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/interview" element={<InterviewPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return <AppShell />;
}