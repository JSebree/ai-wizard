import React from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import InterviewPage from "./interview/InterviewPage.jsx";

function AppHeader() {
  return (
    <header>
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3 min-h-[56px]">
        <Link
          to="/"
          onClick={(e) => {
            if (window.location.pathname === "/") {
              e.preventDefault();
              try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}
              window.dispatchEvent(new CustomEvent("interview:goFirstStep"));
            }
          }}
          className="font-semibold tracking-tight cursor-pointer select-none"
          title="Start a new interview"
        >
          SceneMe
        </Link>
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent("interview:goReviewStep"));
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
          <Route path="/" element={<InterviewPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}