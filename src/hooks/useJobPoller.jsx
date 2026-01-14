import { useState, useEffect, useRef } from 'react';

const API_BASE = '/api'; // Assumes proxy or same-origin

export function useJobPoller() {
    const [jobId, setJobId] = useState(null);
    const [status, setStatus] = useState('idle'); // idle, queuing, processing, completed, failed
    const [progress, setProgress] = useState(0);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const pollInterval = useRef(null);

    const startJob = async (payload) => {
        try {
            setStatus('queuing');
            setProgress(0);
            setError(null);

            const res = await fetch(`${API_BASE}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error(`Failed to start job: ${res.statusText}`);

            const result = await res.json();
            setJobId(result.jobId);
            setStatus('processing');
        } catch (err) {
            console.error("Job Start Error:", err);
            setError(err.message);
            setStatus('failed');
        }
    };

    useEffect(() => {
        if (!jobId || status === 'completed' || status === 'failed') return;

        const poll = async () => {
            try {
                const res = await fetch(`${API_BASE}/status/${jobId}`);
                if (!res.ok) {
                    if (res.status === 404) return; // Wait for job to appear
                    throw new Error("Status check failed");
                }

                const jobState = await res.json();

                // Map BullMQ state + Custom Data to UI State
                if (jobState.state === 'completed') {
                    setStatus('completed');
                    setProgress(100);
                    setData(jobState.returnvalue); // Final result
                } else if (jobState.state === 'failed') {
                    setStatus('failed');
                    setError(jobState.failedReason);
                } else {
                    // Active state
                    setStatus('processing');
                    // Prefer custom status object from data if available, else generic progress
                    if (jobState.data?.status) {
                        // Backend 'director' updates this custom object
                        // jobState.data.status = { stage: 'visuals', progress: 20, message: ... }
                        setProgress(jobState.data.status.progress || jobState.progress);
                    } else {
                        setProgress(jobState.progress);
                    }
                }
            } catch (err) {
                console.warn("Poll Error:", err);
                // Don't fail immediately on network blip, just retry next interval
            }
        };

        // Poll immediately then every 2s
        poll();
        pollInterval.current = setInterval(poll, 2000);

        return () => clearInterval(pollInterval.current);
    }, [jobId, status]);

    return {
        startJob,
        jobId,
        status,
        progress,
        data,
        error
    };
}
