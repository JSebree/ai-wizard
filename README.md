# SceneMe: The AI Director Platform

**SceneMe** is an autonomous narrative orchestration engine. It transforms high-level intent (e.g., *"A 60s noir film"*) into fully produced video assets by coordinating a hybrid pipeline of LLMs, Diffusion Models, and TTS engines.

> 🚀 **Engineering Case Study:** [Read how we built the Hybrid Orchestrator](./docs/engineering_case_study.md)  
> 🦄 **Product Vision:** [The "Operating System" for Generative Video](./docs/product_tech_brief.md)

---

## 🏗 System Architecture
This project implements a **Hybrid Architecture** balancing velocity and reliability:
*   **The Director (Node.js/Express):** State management, Intent Routing, and "Lip-Sync" timing logic.
*   **The Worker Layer (n8n/BullMQ):** Asynchronous job queues leveraging SOTA models (LTX, ElevenLabs, SDXL) via a Model-Agnostic interface.
*   **Persistence (Supabase):** "Asset-based" storage allowing for **Episodic Templates** and Character Consistency across sessions.

## 📂 Documentation (Strategic)
*   [**Engineering Case Study:**](./docs/engineering_case_study.md) A deep dive into the "Orchestrator Pattern" and solving the Cloudflare Timeout constraint with Async Queues.
*   [**Product Brief:**](./docs/product_tech_brief.md) How SceneMe solves the "Innovator's Dilemma" for AI video tools.
*   [**Artifacts Roadmap:**](./docs/strategic_artifacts_roadmap.md) Plan for future system diagrams and whitepapers.

---

## 🚀 Release Process
*(Standard dev notes below)*

### **1. Commit All Local Changes**
```bash
git add .
git commit -m "your message here"
```

### **2. Push to `main`**
```bash
git push -u origin main
```

### **3. Tag the Stable Release**
```bash
git tag -a v0.7.1 -m "Stable release: Express Mode + Studio Hybrid"
git push origin v0.7.1
```

### **6. Deployment Notes**
- Cloudflare Pages will deploy whatever branch you configure (usually `main` or `stable`).
- Environment variables (`.env`, `.env.local`) are NOT committed—update them manually in Cloudflare.
