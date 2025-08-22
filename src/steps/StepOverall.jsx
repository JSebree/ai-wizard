// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./index.css";

import WizardStepper from "./components/WizardStepper.jsx";
import StepConcept from "./steps/StepConcept.jsx";
import StepCharacter from "./steps/StepCharacter.jsx";
import StepSetting from "./steps/StepSetting.jsx";
import StepBroll from "./steps/StepBroll.jsx";
import StepMusic from "./steps/StepMusic.jsx";
import StepFlags from "./steps/StepFlags.jsx";
import StepReview from "./steps/StepReview.jsx";

import { useLocalStorage } from "./hooks/useLocalStorage.js";
import { inferStyleKey } from "./libs/inferStyleKey.js";
import { ensureDefaults, REQUIRED, validateStep } from "./libs/required.js";
import { buildN8nPayload } from "./libs/buildN8nPayload.js";

const STEPS = [
  { key: "Concept",    title: "Concept",          Component: StepConcept },
  { key: "character",  title: "Character",        Component: StepCharacter },
  { key: "setting",    title: "Setting & Keyframes", Component: StepSetting },
  { key: "broll",      title: "B-roll Prompts",   Component: StepBroll },
  { key: "music",      title: "Music",            Component: StepMusic },
  { key: "flags",      title: "Settings",         Component: StepFlags },
  { key: "review",     title: "Review",           Component: StepReview },
];

export default function App() {
  const [state, setState] = useLocalStorage("aiwiz:state", ensureDefaults({}));
  const [stepIndex, setStepIndex] = useLocalStorage("aiwiz:step", 0);
  const [errors, setErrors] = useState({});

  // Push sensible defaults in on first load
  useEffect(() => {
    setState(prev => ensureDefaults(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // derived styleKey for header
  const styleKey = useMemo(() => {
    const s = ensureDefaults(state);
    try {
      return inferStyleKey({
        title: s.minimalInput?.title,
        subject: s.minimalInput?.subject,
        referenceText: s.referenceText,
        tags: s.tags,
        route: s.minimalInput?.route,
        style: s.minimalInput?.style,
        packHints: s.minimalInput?.packHints,
        personaKind: s.minimalInput?.packHints?.personaKind,
      });
    } catch {
      return "generic-video";
    }
  }, [state]);

  const go = (dir) => {
    const next = Math.min(STEPS.length - 1, Math.max(0, stepIndex + dir));
    setStepIndex(next);
  };

  const setPart = (key, value) => {
    setState(prev => ({ ...prev, [key]: value }));
  };

  // validate current step to gate navigation
  const currentKey = STEPS[stepIndex].key;
  const currentRequired = REQUIRED[currentKey] || [];
  const currentValue =
    currentKey === "Concept"   ? state.minimalInput :
    currentKey === "character" ? state.character :
    currentKey === "setting"   ? state.setting :
    currentKey === "broll"     ? state.broll :
    currentKey === "music"     ? state.music :
    currentKey === "flags"     ? state.flags :
    state; // review

  const onNext = () => {
    const e = validateStep(currentKey, currentValue);
    setErrors(prev => ({ ...prev, [currentKey]: e }));
    if (Object.keys(e).length === 0) go(+1);
  };

  const onBack = () => go(-1);

  // wire each step's onChange setter
  const stepSetters = {
    Concept:   (v) => setPart("minimalInput", v),
    character: (v) => setPart("character", v),
    setting:   (v) => setPart("setting", v),
    broll:     (v) => setPart("broll", v),
    music:     (v) => setPart("music", v),
    flags:     (v) => setPart("flags", v),
  };

  const stepValues = {
    Concept:   state.minimalInput || {},
    character: state.character || {},
    setting:   state.setting || {},
    broll:     state.broll || {},
    music:     state.music || {},
    flags:     state.flags || {},
  };

  const payload = useMemo(() => buildN8nPayload(ensureDefaults(state)), [state]);

  const { Component } = STEPS[stepIndex];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 dark:text-slate-100">
      <div className="max-w-5xl mx-auto p-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">AI Wizard</h1>
          <div className="text-sm text-slate-600 dark:text-slate-300">
            <span className="font-semibold">Required fields</span> are marked with{" "}
            <span className="text-red-600">*</span>.
          </div>
        </header>

        <div className="mt-4 text-slate-500 dark:text-slate-400 text-sm">styleKey: {styleKey}</div>

        <WizardStepper
          steps={STEPS.map(s => s.title)}
          index={stepIndex}
          onBack={onBack}
          onNext={onNext}
        />

        <div className="mt-6">
          <Component
            value={stepValues[currentKey]}
            onChange={stepSetters[currentKey] || (() => {})}
            errors={errors[currentKey] || {}}
            required={currentRequired}
            fullState={state}
            payload={payload}
          />
        </div>
      </div>
    </div>
  );
}

// src/steps/StepConcept.jsx
import React from "react";

const LABEL = ({ id, text, required }) => (
  <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
    {text} {required ? <span className="text-red-600">*</span> : null}
  </label>
);

export default function StepConcept({ value, onChange, errors = {}, required = [] }) {
  const v = value || {};
  const isReq = (k) => required.includes(k);
  const set = (k, val) => onChange({ ...v, [k]: val });

  return (
  <div className="space-y-5">
    <div className="text-xs text-slate-600">Fields marked <span className="text-red-600">*</span> are required.</div>

    <div>
      <label className="text-sm font-medium text-slate-700">Title{mark("title")}</label>
      <input className={cls("title")} value={v.title || ""} onChange={(e)=>set("title", e.target.value)} placeholder="e.g., Tiny Tech Execs" />
      {err("title") && <p className="text-xs text-red-600 mt-1">{err("title")}</p>}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div>
        <label className="text-sm font-medium text-slate-700">Subject{mark("subject")}</label>
        <input className={cls("subject")} value={v.subject || ""} onChange={(e)=>set("subject", e.target.value)} placeholder="What is this about?" />
        {err("subject") && <p className="text-xs text-red-600 mt-1">{err("subject")}</p>}
      </div>
      <div>
        <label className="text-sm font-medium text-slate-700">Duration (sec){mark("durationSec")}</label>
        <input type="number" min={6} max={300} className={cls("durationSec")}
               value={v.durationSec ?? 60} onChange={(e)=>set("durationSec", Number(e.target.value||0))} />
        {err("durationSec") && <p className="text-xs text-red-600 mt-1">{err("durationSec")}</p>}
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div>
        <label className="text-sm font-medium text-slate-700">Route{mark("route")}</label>
        <select className={cls("route")} value={v.route || "aroll"} onChange={(e)=>set("route", e.target.value)}>
          <option value="aroll">A–roll</option>
          <option value="broll">B–roll</option>
          <option value="combo">Combo</option>
          <option value="podcast">Podcast</option>
        </select>
        {err("route") && <p className="text-xs text-red-600 mt-1">{err("route")}</p>}
      </div>
      <div className="grid grid-cols-2 gap-5">
        <div>
          <label className="text-sm font-medium text-slate-700">Style adjectives</label>
          <input className={cls("style")} value={v.style || "default"} onChange={(e)=>set("style", e.target.value)} placeholder="e.g., cinematic, clean" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Tone</label>
          <input className={cls("tone")} value={v.tone || "neutral"} onChange={(e)=>set("tone", e.target.value)} placeholder="e.g., educational" />
        </div>
      </div>
    </div>

    <div>
      <label className="text-sm font-medium text-slate-700">Reference Text</label>
      <textarea rows={4} className={cls("referenceText")} value={v.referenceText || ""}
                onChange={(e)=>set("referenceText", e.target.value)} placeholder="Any guidance or script notes" />
      <div className="mt-2">
        <label className="text-sm font-medium text-slate-700">Attach reference (doc/pdf/text)</label>
        <input type="file" accept=".txt,.md,.pdf,.doc,.docx" className="mt-1 block w-full"
               onChange={(e)=> set("referenceUploadMeta", e.target.files?.[0]
                 ? { name: e.target.files[0].name, size: e.target.files[0].size, type: e.target.files[0].type }
                 : null)} />
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div>
        <label className="text-sm font-medium text-slate-700">Templates</label>
        <select multiple className={cls("templates")} value={v.templates || []}
                onChange={(e)=> set("templates", Array.from(e.target.selectedOptions).map(o=>o.value))}>
          {TEMPLATE_PRESETS.map(t=> <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium text-slate-700">Audience</label>
        <input className={cls("audience")} value={v.audience || ""} onChange={(e)=>set("audience", e.target.value)}
               placeholder="kids, professionals, casual" />
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div>
        <label className="text-sm font-medium text-slate-700">Tags</label>
        <input className={cls("tags")} value={v.tags || ""} onChange={(e)=>set("tags", e.target.value)} placeholder="comma,separated,tags" />
      </div>
      <div>
        <label className="text-sm font-medium text-slate-700">Location</label>
        <input className={cls("location")} value={v.location || ""} onChange={(e)=>set("location", e.target.value)} placeholder="e.g., Tokyo, street" />
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div className="flex items-end gap-2">
        <input id="matchPrior" type="checkbox" checked={!!v.matchPriorEpisode} onChange={(e)=>set("matchPriorEpisode", e.target.checked)} />
        <label htmlFor="matchPrior" className="text-sm">Match prior episode</label>
      </div>
      <div className="flex items-end gap-2">
        <input id="seriesMode" type="checkbox" checked={!!v.seriesMode} onChange={(e)=>set("seriesMode", e.target.checked)} />
        <label htmlFor="seriesMode" className="text-sm">Series mode</label>
      </div>
    </div>
  </div>
  );
}