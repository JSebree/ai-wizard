import React from "react";
import { Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import InterviewPage from "./interview/InterviewPage.jsx";
import LandingPage from "./landing/LandingPage.jsx";
import LogoLight from "./assets/SceneMe_black_icon_transparent.png"; // black icon for light mode
import LogoDark from "./assets/SceneMe_white_icon_transparent.png"; // white icon for dark mode

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
          {/* Light mode: black icon */}
          <img
            src={LogoLight}
            alt="SceneMe"
            className="h-16 md:h-20 lg:h-24 w-auto object-contain block dark:hidden shrink-0"
          />
          {/* Dark mode: white icon */}
          <img
            src={LogoDark}
            alt="SceneMe"
            className="h-16 md:h-20 lg:h-24 w-auto object-contain hidden dark:inline-block shrink-0"
          />
          <span className="ml-3 md:ml-4 text-2xl md:text-3xl lg:text-4xl font-semibold tracking-tight leading-none text-gray-900 dark:text-white select-none">
            SceneMe
          </span>
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