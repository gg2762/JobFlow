# JOBFLOW

> **Looking for jobs is fine. Applying to them is the grind.**
> JOBFLOW is the agentic application stack that takes over the moment you find a role you like.

<p align="center">
  <img src="assets/logo.png" alt="JOBFLOW" width="640"/>
</p>

---

## The problem

Finding jobs you like isn't the bottleneck. Job boards, LinkedIn alerts, network referrals — discovery is fine, sometimes even fun. **What hurts is everything that happens after.**

JOBFLOW is not a job discovery tool. It's the layer that sits on top of every job posting you've already decided you want to apply to, and solves three specific pains:

### 1. Tailoring resumes and application materials is cumbersome

Every role wants slightly different keywords, a tweaked summary, a re-ordered skills section. Doing this by hand across 20 applications is an evening you won't get back. Doing it by pasting your résumé into ChatGPT introduces hallucinations: invented metrics, jobs you didn't have, languages you don't speak.

### 2. Tracking the pipeline is a mess

Where did I send the Acronis application? What did I write for Spotify's "tell us about a time" essay? Which roles am I still waiting on? Which ones rejected me? Spreadsheets rot, browser bookmarks scatter, and the answer to "did I apply to that?" becomes a 10-minute search.

### 3. Generic LLMs hallucinate when you ask them to tailor your CV

The standard workflow — paste résumé + JD into ChatGPT, ask for a tailored version — produces a confident document that quietly invents facts. You catch the obvious ones; the subtle ones make it into PDFs that recruiters and interviewers will hold against you.

---

## What JOBFLOW does

One Chrome-extension click per job posting kicks off an end-to-end pipeline:

- **Captures the JD** from the active tab into a local CSV queue and a dashboard
- **Picks the right resume archetype** from your sealed blueprints (you maintain 5, one per role family)
- **Generates a tailored one-page `.docx` + `.pdf`** with surgical ATS keyword swaps gated by an explicit whitelist of terms you've signed off on
- **Refuses to fabricate** — anything outside your blueprints + whitelist is logged as an unfulfilled gap, never silently injected
- **Catches application questions** ("Why this role?", "Tell us about a time…") and answers them from a personal `answer_bank.md` that holds your verified facts and stock responses
- **Tracks every application end-to-end** — Queued → Ready → Submitted → Interview / Rejected — from a local dashboard at `localhost:3737`

The output: more applications shipped per evening, every one of them factually clean, every one of them tracked.

---

## Why this and not generic ChatGPT

| | Generic LLM workflow | JOBFLOW |
|---|---|---|
| Fact boundary | None — the model invents | Sealed blueprints + ATS whitelist; fabrication is structurally blocked |
| Output format | Plain text you reformat in Word | Programmatic `.docx` + `.pdf`, QA-gated (1 page, font, margins, Skills row line-wrap) |
| Per-application memory | None — every chat starts blank | Persistent CSV + dashboard with full history per role |
| Application questions | Re-typed every time | Drawn from your `answer_bank.md` canon |
| Data residency | Your résumé sits on someone else's server | Everything is local; the server binds to `127.0.0.1` |
| Repeatability | Hand-driven, drifts session to session | Deterministic Claude Code skills with explicit contracts |

JOBFLOW is opinionated where generic tools are loose, and quiet where you don't want a model to improvise.

---

## A typical loop

1. You're on a job posting in your browser. Click the **JOBFLOW Capture** extension.
2. The JD lands in your queue. The dashboard at `localhost:3737` shows it as `Queued`.
3. In Claude Code, run `/process-queue`. The skill picks the right blueprint, applies whitelist-checked ATS swaps, renders the `.docx` + `.pdf`, runs the QA gate, marks the row `Ready`.
4. If the application form had screening questions, paste them into the row's expanded panel and run `/answer-questions`. Answers come back drawn from your `answer_bank.md`.
5. Submit the application. Tick the row's **Submitted** box.
6. Outcomes (Interview / Rejected / Pending) update from the dashboard as your funnel progresses.

All data lives on your disk. Nothing leaves your machine.

---

## Architecture

```
┌──────────────────┐  POST  ┌────────────────────┐  append  ┌───────────────────┐
│ Chrome extension │ ─────▶ │ Local Node server  │ ───────▶ │ user_data/        │
│   "Queue Job"    │ :3737  │ (LaunchAgent)      │          │   queue.csv       │
└──────────────────┘        └────────────────────┘          └───────────────────┘
                                       │                              │
                                       ▼                              ▼
                            ┌────────────────────┐         ┌───────────────────┐
                            │ Dashboard          │         │ Claude Code       │
                            │ localhost:3737/    │◀────────│ /process-queue    │
                            │ (sort, filter,     │  reads  │ /answer-questions │
                            │  outcomes, Q&A)    │         └───────────────────┘
                            └────────────────────┘                  │
                                                                    ▼
                                                       ┌───────────────────────┐
                                                       │ One-page tailored PDF │
                                                       │ + QA gate (LibreOffice│
                                                       │  page count, line wrap│
                                                       │  font/margins)        │
                                                       └───────────────────────┘
```

See [docs/server.md](docs/server.md) for the server operations reference.

---

## Repository layout

```
jobflow/
├── .claude/skills/             # The 3 Claude Code skills (project-scoped)
│   ├── resume-builder/         # Single-JD pipeline (when you paste a JD directly)
│   ├── process-queue/          # Batch-process pending queue rows
│   └── answer-questions/       # Tailor application-form answers
├── server.js                   # The local capture server (no deps, native Node)
├── qa_resume.js                # PDF QA gate: 1 page, Skills line, font, margins
├── extension/                  # Chrome extension (MV3) source
│   ├── manifest.json
│   ├── popup.html / popup.js
│   └── icon.png
├── blueprints/                 # OPEN-SOURCE: archetype templates + sample
│   ├── _schema.md              # The canonical blueprint structure
│   ├── _archetype_*.md         # 5 empty scaffolds with section guidance
│   ├── _skill_overrides_template.md   # User-specific behavioral rules (template)
│   ├── _ats_whitelist_template.md     # ATS keyword whitelist (template)
│   └── sample/                 # Filled-in example so you see what one looks like
│       └── blueprint_strategy_growth_sample.md
├── docs/
│   ├── server.md               # Server operations reference
│   └── roadmap.md              # Open-core, autonomous-submit, multi-tenant vision
├── launchd/
│   └── com.jobflow.server.plist.template
├── assets/
│   └── logo.png
├── user_data/                  # GITIGNORED — your personal data lives here
│   ├── blueprints/             #   your 5 filled-in blueprints
│   ├── ats_whitelist.md        #   your ATS keyword catalog (fabrication boundary)
│   ├── skill_overrides.md      #   your behavioral overrides
│   ├── answer_bank.md          #   your factual answer canon
│   └── queue.csv               #   captured JDs + status tracker
├── LICENSE                     # AGPL-3.0
├── CONTRIBUTING.md
├── CHANGELOG.md
└── README.md
```

---

## Quick start

### Prerequisites

| | Tested with |
|---|---|
| macOS | 14+ (Sonoma) |
| Node.js | 20 LTS or newer |
| Claude Code Desktop | 2.1.72+ |
| Homebrew | Any recent version |
| LibreOffice | Any recent version (used for the PDF QA gate) |
| Google Chrome | Any recent version |

### 1. Clone and install dependencies

```bash
git clone https://github.com/<your-username>/jobflow.git ~/jobflow
cd ~/jobflow

# LibreOffice is the only system dep (used by qa_resume.js to convert .docx → .pdf)
brew install --cask libreoffice
brew install poppler  # provides pdfinfo + pdftotext for QA checks

# Node deps (only the `docx` package is needed)
npm install --global docx@9
```

### 2. Set up your blueprints + answer bank

In Claude Code, run the interview skill *(coming soon — `/interview-canon`)*. It walks you through ~20 questions and generates `user_data/blueprints/*.md` and `user_data/answer_bank.md`.

**Until that skill ships:** copy the archetype scaffolds and fill them in by hand.

```bash
mkdir -p user_data/blueprints
cp blueprints/_archetype_adtech.md          user_data/blueprints/blueprint_adtech.md
cp blueprints/_archetype_data_infra.md      user_data/blueprints/blueprint_data_infra.md
cp blueprints/_archetype_strategy_growth.md user_data/blueprints/blueprint_strategy_growth.md
cp blueprints/_archetype_regulated_saas.md  user_data/blueprints/blueprint_regulated_saas.md
cp blueprints/_archetype_ai_founder.md      user_data/blueprints/blueprint_ai_founder.md

# Then edit each file to reflect your actual career, archetype by archetype.
# See blueprints/sample/blueprint_strategy_growth_sample.md for a worked example.

# Copy the ATS whitelist template — this is the file that gates fabrication.
# Without it the skill falls back to a softer heuristic.
cp blueprints/_ats_whitelist_template.md user_data/ats_whitelist.md
```

Then create your `user_data/answer_bank.md` — same idea, copy the structure from the example in [docs/](docs/) and fill in your salary anchors, notice period, references, etc. And edit `user_data/ats_whitelist.md` to reflect the terms you can actually defend: every term in the whitelist becomes injectable per PHASE 3, everything outside it is structurally refused.

### 3. Install the server as a LaunchAgent

```bash
# Personalize the plist template with your username + path
sed -e "s|{{USER}}|$USER|g" -e "s|{{JOBFLOW_HOME}}|$HOME/jobflow|g" \
  launchd/com.jobflow.server.plist.template \
  > ~/Library/LaunchAgents/com.jobflow.server.plist

launchctl load ~/Library/LaunchAgents/com.jobflow.server.plist

# Verify
curl http://localhost:3737/health   # → {"ok":true}
```

The server auto-starts at login, auto-restarts on crash. See [docs/server.md](docs/server.md) for ops.

### 4. Install the Chrome extension

1. Open `chrome://extensions/`
2. Toggle **Developer mode** on (top-right)
3. Click **Load unpacked** → select `jobflow/extension/`
4. Pin the **JOBFLOW Capture** icon to your toolbar

Done. Click any job posting → click the extension icon → click **Queue Job**.

### 5. Use it

- Browse to a JD page (LinkedIn, Greenhouse, Lever, Ashby, etc.) → JOBFLOW icon → **Queue Job**.
- Open the dashboard at `http://localhost:3737/` to see captured rows.
- In Claude Code, `cd ~/jobflow` and run `/process-queue`. Claude picks blueprints, generates resumes, runs QA, drops `.docx` + `.pdf` in your output folder.
- Got application questions on a row? Expand the row in the dashboard, paste them in, click **Save questions**, then run `/answer-questions` in Claude Code.
- Mark applications **Submitted** → **Interview** / **Rejected** / **Pending** as your funnel progresses.

---

## The five blueprint archetypes

JOBFLOW ships with five archetype scaffolds. Pick the ones that match your career and fill them in. You can rename or add archetypes — the skills load whatever lives in `user_data/blueprints/`.

| Archetype | Target roles |
|---|---|
| **AdTech** | AdTech PM, CTV/Programmatic PM, Measurement & Identity PM |
| **Data Infra** | Technical PM, Platform PM, Data Infrastructure PM, MLOps |
| **Strategy / Growth** | Strategy, Corp Dev, Growth PM, PLG, BizOps, Consulting, Chief of Staff |
| **Regulated SaaS** | Healthcare PM, Fintech PM, Data Governance / Compliance PM, IAM/Security |
| **AI Founder** | AI PM, GenAI PM, EIR, Founding PM at AI-native companies |

Each blueprint is **sealed**: skills never rewrite bullets at execution time. The only per-JD customization is surgical ATS keyword swaps in the Skills row, and those swaps are gated by [`blueprints/_ats_whitelist_template.md`](blueprints/_ats_whitelist_template.md) — your private catalog of terms you can defend in an interview. Blueprints are refined out-of-band when you notice a recurring gap.

See [`blueprints/_schema.md`](blueprints/_schema.md) for the structural contract and [`blueprints/sample/blueprint_strategy_growth_sample.md`](blueprints/sample/blueprint_strategy_growth_sample.md) for a worked example.

---

## Configuration

| Variable | Default | What it does |
|---|---|---|
| `JOBFLOW_PORT` | `3737` | Server port. Change if `3737` clashes. |
| `JOBFLOW_OUTPUT_DIR` | `~/Desktop/Jobs/Resume/` | Where rendered `.docx` + `.pdf` files land. |

Set these in your shell profile if you want non-defaults, then reload the LaunchAgent so the server picks them up.

---

## Roadmap

JOBFLOW is structured as an open-core project. See [docs/roadmap.md](docs/roadmap.md) for the full picture. In short:

- **Phase 0 (this repo, today):** Local MVP — Chrome extension + Node server + CSV + Claude Code skills.
- **Phase 1 (next):** Developer-hosted open source. Modular Supabase/n8n backends, the `/interview-canon` onboarding skill, automated install script.
- **Phase 2:** Hosted Next.js dashboard, email-based application tracking, multi-tenant.
- **Phase 3:** Autonomous headless application submission (Playwright + Claude Computer Use).

---

## Contributing

PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

[AGPL-3.0](LICENSE). The "open" half of the open-core model — anyone can fork, self-host, and modify, but networked re-distribution requires source-availability.

---

## Acknowledgements

- The Chrome extension's `innerText` approach is from [the early WebVoyager pattern](https://arxiv.org/abs/2401.13919) — simple beats site-specific selectors for MVP coverage.
- The QA gate uses [LibreOffice](https://www.libreoffice.org/) for headless PDF conversion and [poppler](https://poppler.freedesktop.org/) for page/text inspection.
- The dashboard uses [Inter](https://rsms.me/inter/) and [JetBrains Mono](https://www.jetbrains.com/mono/) via Google Fonts.
