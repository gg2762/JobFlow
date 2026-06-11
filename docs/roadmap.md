# Product Requirements Document (PRD)
## Project Name: Agentic Career Pipeline (Codename: JobFlow-OS)
**License:** AGPLv3 (Open-Core Model)  
**Author:** JOBFLOW project  
**Target Audience:** Engineering & Product Professionals (OSS) / Turnkey Job Seekers (SaaS)

---

## 1. Executive Summary & Strategy
JobFlow-OS is an AI-native job application system designed to minimize the conversion friction of the job search. The product uses a browser-based capture extension, a multi-model generative refinement engine, and asynchronous background tracking to transform a chaotic job hunt into a high-yield programmatic funnel. 

### The Open-Core Monetization Thesis:
- **The Core (Open Source - AGPLv3):** The local Chrome Extension, the markdown career canonical parsing engine, the local n8n generative pipeline, and the schema templates. Free for developers to self-host.
- **The Cloud (Commercial SaaS):** A hosted Next.js multi-tenant dashboard, managed zero-divergence Vercel/Supabase infrastructure, background email syncing agents, and the headless autonomous visual application agent (Playwright/Computer-Use).

---

## 2. Phase Map: MVP to v3 Evolution

### Phase 0: Local MVP (Personal Sandbox)
**Objective:** De-risk the data extraction, PDF generation layout, and basic tracking loop for a single user.
- **Chrome Extension (Local):** - Manifest V3 script triggered manually via extension popup button on active tab.
  - Extracts raw DOM text (`document.body.innerText`) and URL from LinkedIn, Greenhouse, and Lever.
  - POSTs payload directly to a local or personal cloud n8n webhook.
- **Orchestration Layer (n8n):**
  - Webhook ingestion node parses incoming job description.
  - Injector node merges job text with a statically hosted `canon_history.md`.
  - LLM Node (Anthropic/Gemini) generates optimized, tailored resume bullets mapped to job requirements.
- **Fulfillment & Generation:**
  - Automated translation of tailored Markdown into a strict, single-page, ATS-compliant **PDF layout** (guaranteeing no formatting fragmentation).
- **Data Storage:** - Simple local CSV logging or private Supabase table tracking: `Company`, `Role`, `URL`, `Generated_Resume_Path`, `Status (Queued)`.

### Phase 1: v1.0 - The Open-Source Launch (The Developer Engine)
**Objective:** Establish developer adoption, secure GitHub stars, and validate the framework under AGPLv3.
- **Modular Architecture:** Refactor the codebase so infrastructure is decoupled. Provide explicit setup documentation for developer-hosted Supabase and n8n instances.
- **Automated Resume Queuing:** - Introduce an intermediate "Review & Queue" state in the database.
  - Generated resumes are marked as `Pending Review`. The user can approve via a lightweight CLI script or a simple text interface before the pipeline marks them ready for submission.
- **The "Interview" Initialization Engine:**
  - An LLM-driven setup script that prompts the user through their career history to generate a hyper-optimized, high-signal `canon_history.md` tailored for AI context windows.
- **Developer Documentation (DX):**
  - Inclusion of `llms.txt` and `llms-full.txt` at the root directory so other developers can use Cursor, Claude Code, or local agents to instantly spin up, deploy, and modify the repo.

### Phase 2: v2.0 - The Hosted Dashboard & Email Ingestion (The SaaS Bridge)
**Objective:** Bridge the gap for non-technical users and introduce the first layers of passive system intelligence.
- **Next.js & Supabase Web App:** - A beautiful, responsive web interface deployed on Vercel replacing the CSV tracker.
  - Built as a Kanban board (`Discovered` -> `Generated` -> `Applied` -> `Interviewing` -> `Offer/Closed`).
- **Dedicated Email Alias & Tracking Agent:**
  - Integration of a dedicated email address workflow.
  - Background crons poll the dedicated inbox via IMAP/Gmail API.
  - An inbound parsing agent identifies metadata from incoming confirmations (`Stripe`, `Greenhouse`, `Workday`) and moves the Kanban board status automatically with zero user intervention.
- **Analytics & Funnel Instrumentation:**
  - Integrated PostHog tracking to measure pipeline conversions (e.g., Application-to-Interview ratio sliced by resume variance).

### Phase 3: v3.0 - Full Autonomous Agentic Execution (The Commercial Moat)
**Objective:** Deliver the ultimate end-state product feature—fully automated, authenticated job submission.
- **Headless Application Engine:**
  - Deployment of a background worker running Playwright and multi-modal AI models (e.g., Claude Computer Use).
  - The worker fires up an isolated browser instance, navigates to the target application form (Greenhouse/Lever/Workday), and programmatically fills out text boxes, drops down menus, and uploads the tailored PDF.
- **CAPTCHA & Exception Resolution Loop:**
  - Real-time notification system that alerts the user if the agent hits a complex manual block (like a specific multi-factor auth wall or dynamic CAPTCHA), prompting a quick manual takeover.
- **Multi-Tenant Enterprise Security:**
  - Fully sandboxed user data encryption to guarantee candidate information remains completely secure while operating background workers.

---

## 3. Core Functional Requirements (Deep Dive)

### R1: The Character/Career Consistency Guardrails
The generation script must never synthesize or hallucinate titles, metrics, or technologies not explicitly authorized in the verified `canon_history.md`. It must evaluate the generated output across four strict constraints before passing to the PDF rendering gate:
- **Role Accuracy:** Alignment between user history and targeted scope.
- **Metric Integrity:** Preservation of original revenue/scale numbers.
- **Technical Stack Alignment:** Ensuring correct keyword mapping (e.g., explicitly matching Vercel, Supabase, n8n, PostHog where relevant).
- **Executive Gravity:** Maintaining dense, impact-focused, single-sentence bullet points.

### R2: Async Reconciliation and Anti-Failure Loop
To prevent silent integration failures (such as a dropped webhook or form submission error):
- Every application state must have a persistent log in Supabase.
- A daily automated reconciliation script must scan the database for applications stuck in a transitionary state (e.g., `Generating` for > 10 minutes) and trigger an alert or retry sequence.