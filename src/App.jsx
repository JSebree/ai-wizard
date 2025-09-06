// src/App.jsx
import React from "react";
import { Routes, Route, Link } from "react-router-dom";
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
          <div className="ml-auto flex items-center gap-3">
            {/* <HeaderResetButton /> */}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<InterviewPage />} />
        <Route path="*" element={<InterviewPage />} />
      </Routes>
    </AppShell>
  );
}