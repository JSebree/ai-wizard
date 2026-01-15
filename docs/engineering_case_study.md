# Case Study: Building SceneMe – A Hybrid AI Video Orchestrator

**Role:** Lead Creative AI Engineer
**Tech Stack:** React, Node.js (Express/Fastify), BullMQ (Redis), PostgreSQL (Supabase), n8n, Cloudflare Pages.
**Key Models:** A Modular Ensemble of 11+ SOTA Models (LTX, Qwen, Hunyuan, etc.).

---

## 1. The Challenge: Orchestrating Chaos
Generative AI models (LLMs, Diffusion, TTS) are powerful but isolated. They produce "raw materials," not products. To build a coherent video, one must manually pipeline data through 11+ disconnected APIs, managing context, timing, and consistency.

**The Mission:** Build an **Autonomous Director System**. A platform that accepts a high-level intent (e.g., *"A 60s noir detective story"*) and orchestrates the entire production pipeline—scripting, casting, shooting (generating), and editing—without human intervention.

## 2. System Design: The "Hybrid" Architecture
I architected a solution that balances **Velocity** (rapid prototyping of new AI models) vs. **Reliability** (enterprise-grade uptime).

### 2.1 The "Director" Engine (Node.js/TypeScript)
The brain of the system is the **Orchestration Layer**, built on a scalable Node.js backend.
*   **Semantic Routing:** The `Director` analyzes user intent to determine the "Route" (A-Roll vs B-Roll vs Combo), dynamically selecting the optimal pipeline.
*   **State Machine:** The `Orchestrator` breaks a linear script into parallelizable jobs. It manages the global state (Character Consistency, Pacing, Tone) and injects it into every atomic generation task.
*   **Deterministic Timing:** An algorithm calculates TTS read-rates to ensure generated video clips match audio duration to the millisecond, solving the "lip-flap" sync issue common in AI video.

### 2.2 The "Ensemble" Worker Layer (n8n API Gateway)
**Architectural Decision:** Instead of relying on a single monolith model, I orchestrated a "Best-in-Class" Ensemble using **n8n** as a low-code gateway.

**The 11-Model Stack:**
*   **Visuals:** LTX-2 (Video), Qwen Image 2512 (Keyframes), Qwen Edit 2511 (In-painting).
*   **World:** WorldGen (3D Environments), InfCam (Camera Trajectory).
*   **Audio:** InfiniteTalk (Lipsync), Higgs Audio V2 (Voice), SeedVC (Style Transfer), Hunyuan Foley (SFX), Ace Step (Music).
*   **Utility:** Real-ESRGAN (Upscaling).

### 2.3 Async Job Queue (Solving the Timeout Constraint)
**Problem:** High-quality video generation with this many models takes minutes. Serverless functions timeout after ~100s.
**Solution:** I implemented a decoupled **Job Queue Pattern** using **BullMQ on Redis**.
1.  **Ingest:** API accepts request -> Pushes to Redis -> Returns `job_id`.
2.  **Process:** Distributed Workers pick up jobs, managing long-running generation tasks.
3.  **Poll:** Client polls a lightweight status endpoint for updates.

## 3. Operational Philosophy: The "AI-Native" Team
I designed the system to be maintained by a "Cyborg" team—lean, high-leverage, and AI-assisted—rather than a traditional army of engineers.
*   **NoOps Mentalty:** By offloading model inference to serverless endpoints (RunPod/ElevenLabs) and logic to n8n, we eliminated the need for a dedicated ML Ops team.
*   **Leverage:** The "Coordinator" pattern allows a single engineer to manage the complexity of stacking 11 different models into a coherent product.

## 4. Key Technical Innovations

### A. The "Showrunner" Persistence Model
I moved beyond "Session-based" generation to "asset-based" persistence.
*   **Data Normalization:** Characters, Voices, and Settings are stored as normalized entities in Postgres (Supabase).
*   **Episodic Generation:** The engine can "rehydrate" a character's context (Reference Image + LoRA + Voice Config) at runtime. This allows for **Template-driven generation**, where users can create "Episode 2" using the exact same creative DNA as "Episode 1".

### B. "Model Agnostic" Infrastructure
The system is unopinionated about the underlying models, preventing vendor lock-in.
*   **Interface Segregation:** The `assets/video.ts` module defines a strict contract.
*   **Hot-Swapping:** We can route valid jobs to other models based on cost/availability without deploying new code.

### C. Narrative Consistency Logic
To solve "Hallucination Drift" (where characters morph between shots), I engineered a ** Context Injection** pipeline.
*   **Master Keyframe:** The Orchestrator generates a canonical visual reference for the protagonist.
*   **Prompt Bonding:** Every subsequent shot's prompt is chemically bonded with this master description + style tokens, ensuring visual continuity.

## 5. Impact & Results
*   **Engineering Velocity:** "Hybrid" architecture allowed the team to integrate new models (like LTX) in <24 hours.
*   **User Experience:** "Express Mode" generates a full unique video in <2 minutes, a 100x speedup over manual workflows.
*   **Scalability:** The decoupled Queue architecture allows for horizontal scaling.
