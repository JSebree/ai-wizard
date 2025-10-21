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
          className="header-logo cursor-pointer select-none flex items-center gap-0"
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
          <span className="text-xl md:text-2xl lg:text-3xl font-semibold tracking-tight leading-none text-gray-900 dark:text-white select-none m-0 p-0">
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

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img
              src={LogoLight}
              alt="SceneMe"
              className="h-8 w-auto object-contain"
            />
            <span className="text-lg font-semibold tracking-tight text-gray-900 select-none">SceneMe</span>
          </div>

          <div className="flex flex-col items-center md:items-end">
            <div className="mb-1 text-sm text-slate-700">Follow SceneMe for AI-powered storytelling</div>
            <nav className="flex items-center gap-6">
              <a
                href="https://youtube.com/@SceneMeAI"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="SceneMe on YouTube"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-6 h-6"
                >
                  <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-2A63.1 63.1 0 0 0 12 4a63.1 63.1 0 0 0-8.59.42A2.78 2.78 0 0 0 1.46 6.4 29.94 29.94 0 0 0 1 12a29.94 29.94 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 2A63.1 63.1 0 0 0 12 20a63.1 63.1 0 0 0 8.59-.42 2.78 2.78 0 0 0 1.95-2A29.94 29.94 0 0 0 23 12a29.94 29.94 0 0 0-.46-5.58z" />
                  <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" />
                </svg>
              </a>

              <a
                href="https://www.tiktok.com/@sceneme_ai"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="SceneMe on TikTok"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-6 h-6"
                >
                  <path d="M16 8.5a5 5 0 0 0 5 5V9a9 9 0 0 1-9-9h-3v16a3 3 0 1 1-3-3" />
                </svg>
              </a>

              <a
                href="https://sceneme.ai"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="SceneMe website"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-6 h-6"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </a>
            </nav>
          </div>
        </div>

        <div className="mt-6 text-xs text-slate-500 text-center md:text-right">
          © {year} SceneMe. All rights reserved.
        </div>
      </div>
    </footer>
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
      <Footer />
    </div>
  );
}

export default function App() {
  return <AppShell />;
}