import React from "react";
import { Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import InterviewPage from "./interview/InterviewPage.jsx";
import LandingPage from "./landing/LandingPage.jsx";
import LogoLight from "./assets/SceneMe_black_text_transparent.png"; // black logo with text for light mode
import LogoDark from "./assets/SceneMe_white_text_transparent.png"; // white logo with text for dark mode

function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <header>
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-3 flex items-center justify-between gap-4 min-h-[96px] md:min-h-[124px]">
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
          className="header-logo cursor-pointer select-none flex items-center gap-3"
          title="Start a new interview"
        >
          <span className="sr-only">SceneMe</span>
          {/* Light mode: black logo */}
          <img
            src={LogoLight}
            alt="SceneMe"
            className="h-20 md:h-32 lg:h-36 w-auto object-contain overflow-visible block shrink-0 box-content p-1.5 md:p-2 lg:p-2.5"
            style={{ imageRendering: 'auto' }}
          />
          {/* Dark mode: white logo */}
          <img
            src={LogoDark}
            alt="SceneMe"
            className="h-20 md:h-32 lg:h-36 w-auto object-contain overflow-visible hidden dark:inline-block shrink-0 box-content p-1.5 md:p-2 lg:p-2.5"
            style={{ imageRendering: 'auto' }}
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