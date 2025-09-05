// src/App.jsx
import React from "react";
import { Routes, Route, Navigate, Link } from "react-router-dom";
import InterviewPage from "./interview/InterviewPage.jsx";

// If you created a global reset button component, import it; otherwise you can delete the usage below.
// import HeaderResetButton from "./components/ui/HeaderResetButton.jsx";

function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
          <Link to="/" className="font-semibold tracking-tight">
            SceneMe
          </Link>
          <nav className="ml-4 flex items-center gap-4 text-sm">
            <Link to="/interview" className="hover:text-indigo-600">
              Interview
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {/* <HeaderResetButton /> */}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

function Home() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Welcome to SceneMe</h1>
      <div className="prose prose-slate">
        <p>
          Start a new project with the guided interview. It asks 12 quick questions and builds
          the exact payload your render pipeline expects.
        </p>
      </div>
      <div>
        <Link
          to="/interview"
          className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
        >
          Start Interview
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/interview" element={<InterviewPage />} />
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/interview" replace />} />
      </Routes>
    </AppShell>
  );
}