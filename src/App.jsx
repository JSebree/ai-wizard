// src/interview/steps/ReviewStep.jsx
import React, { useState, useMemo } from "react";

export default function ReviewStep(props) {
  const { ui } = props;
  // existing useState/useMemo declarations here

  // Safe JSON utilities (fallbacks if not provided by parent)
  function handleCopyJson() {
    try {
      const text = JSON.stringify(ui, null, 2);
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
      }
      // optional: toast/alert removed to avoid blocking UI
    } catch (e) { console.error('Copy JSON failed:', e); }
  }
  function handleDownloadJson() {
    try {
      const blob = new Blob([JSON.stringify(ui, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'ui-payload.json';
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
    } catch (e) { console.error('Download JSON failed:', e); }
  }

  return (
    // existing JSX here
    <div>
      {/* existing content */}
    </div>
  );
}


// src/interview/InterviewPage.jsx
import React, { useState, useEffect, useMemo } from "react";
import ReviewStep from "./steps/ReviewStep.jsx";
// other imports

export default function InterviewPage() {
  const steps = useMemo(() => [
    // your steps here
  ], []);

  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    function onGoFirstStep() {
      try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}
      setStepIndex(0);
    }
    window.addEventListener("interview:goFirstStep", onGoFirstStep);
    return () => window.removeEventListener("interview:goFirstStep", onGoFirstStep);
  }, []);

  useEffect(() => {
    function onGoReview() {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
      const last = steps.length - 1;
      setStepIndex((idx) => (last >= 0 ? last : idx));
    }
    window.addEventListener('interview:goReviewStep', onGoReview);
    return () => window.removeEventListener('interview:goReviewStep', onGoReview);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    // existing JSX here
    <div>
      {/* your component content */}
    </div>
  );
}