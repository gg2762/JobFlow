---
name: process-queue
description: >
  Processes pending job descriptions captured by the JobFlow-OS Chrome extension. Reads
  ./user_data/queue.csv via the local server, picks one of the
  5 sealed Blueprints per JD, runs surgical ATS injection, renders the .docx + .pdf with the
  mandatory QA gate, and writes back blueprint + paths + status to each row. Use when the user
  says "process my queue", "process pending JDs", "run the queue", or invokes /process-queue.
  Operates autonomously — does not prompt the user for blueprint picks or ATS choices per JD.
---

# Process-Queue Skill

Batch-processes pending JDs captured by the Chrome extension. Treats each `Queued` row in `queue.csv` as a JD the user pasted and runs the full `resume-builder` v2 pipeline autonomously.

**Hard rule:** never modify a blueprint `.md` during a queue run. Blueprint refinement is out-of-band per resume-builder SKILL.md. If a blueprint won't fit (QA fails) for the JD, mark the row as `Failed` with reason and move on.

---

## Invocation

User says any of: "process my queue", "process pending", "run the queue", "/process-queue", or this skill is invoked directly. No arguments needed.

---

## Pipeline

### Step 1 — Fetch the queue

```bash
curl -sS 'http://localhost:3737/queue?full=1'
```

Returns a JSON array of all rows including full `jd_text`. Filter to `status === 'Queued'`. If empty, print:
> "Queue is empty. Nothing to process."
and stop.

### Step 2 — For each Queued row, run the pipeline

For each row, autonomously execute the `resume-builder` v2 pipeline (see `.claude/skills/resume-builder/SKILL.md`). Specifically:

#### 2.1 — Derive Company + Title from the row

- `page_title` often follows patterns like `"{Title} - {Company}"`, `"{Title} @ {Company}"`, `"{Title} | {Company}"`, or `"{Title} at {Company}"`.
- If `page_title` doesn't yield a clear company, fall back to `source_domain` (strip `www.`, `jobs.`, `job-boards.`, etc.).
- Sanitize for the filename: replace spaces with `_`, drop special chars. Match `resume-builder` filename rules: `{Company}_{Position}_GG.docx` and `.pdf`.

#### 2.2 — PHASE 1.1 (Apply/Don't Apply)

Make the structural fit call from the JD text. If DON'T APPLY:
- Write a one-sentence reason
- Skip rendering
- POST `/row/<id>/update` with:
  ```json
  { "status": "Skipped", "notes": "Don't apply: <reason>", "processed_at": "<ISO timestamp>" }
  ```
- Log to terminal: `[<page_title>] SKIPPED — <reason>`
- Move to next row

#### 2.3 — PHASE 1.2 / 1.3 (Parse + Pick Blueprint)

Run JD parse and blueprint selection per resume-builder SKILL.md. Pick exactly one of:
- `blueprint_adtech.md`
- `blueprint_data_infra.md`
- `blueprint_strategy_growth.md`
- `blueprint_regulated_saas.md`
- `blueprint_ai_founder.md`

Log the choice with one-sentence reasoning. Do NOT prompt the user — pick autonomously.

If no blueprint cleanly maps (truly ambiguous role): use closest match, log a warning, and proceed. Do NOT skip just because the fit is imperfect.

#### 2.4 — PHASE 3 (ATS Skills Override design)

Per JD vocabulary, decide Skills.Product (and optionally Skills.Technical) overrides. Same constraints as resume-builder SKILL.md PHASE 3:
- Only Skills row overrides — never modify bullets
- Each Skills row must stay on one visual line
- Preserve JD-mirroring vocabulary
- Drop poor-fit jargon (e.g., ORTB/UID2 for a CRM JD)

#### 2.5 — PHASE 4 (Render)

Write a transient `./resume_manifest.js` following the resume-builder pattern. Read the chosen blueprint, apply Skills overrides, render to `.docx` at `${JOBFLOW_OUTPUT_DIR:-$HOME/Desktop/Jobs/Resume}/{Company}_{Position}_GG.docx`.

Run via:
```bash
NODE_PATH=${JOBFLOW_NODE_PATH:-$HOME/.npm-global/lib/node_modules} node ./resume_manifest.js
```

The manifest MUST call `qaResume()` from `./qa_resume.js` and exit non-zero on QA failure (PHASE 4.5 mandatory gate).

#### 2.6 — On QA PASS

POST `/row/<id>/update` with:
```json
{
  "status": "Ready",
  "blueprint": "blueprint_<name>.md",
  "docx_path": "${JOBFLOW_OUTPUT_DIR:-$HOME/Desktop/Jobs/Resume}/<Company>_<Position>_GG.docx",
  "pdf_path":  "${JOBFLOW_OUTPUT_DIR:-$HOME/Desktop/Jobs/Resume}/<Company>_<Position>_GG.pdf",
  "processed_at": "<ISO timestamp>",
  "notes": "ATS swaps: <comma-separated list of injected keywords>"
}
```

Log: `[<page_title>] → blueprint_<name> → Ready`

#### 2.7 — On QA FAIL

POST `/row/<id>/update` with:
```json
{
  "status": "Failed",
  "blueprint": "blueprint_<name>.md",
  "processed_at": "<ISO timestamp>",
  "notes": "QA failed: <specific failure (e.g., '2 pages', 'Skills row Product wrapped')>"
}
```

Log: `[<page_title>] FAILED QA — <reason>`

Do NOT retry automatically. The user reviews failures and decides whether to (a) add a per-JD ATS swap to fit one page, (b) refine the blueprint out-of-band, or (c) drop the row.

#### 2.8 — Self-delete the manifest

After QA (pass or fail), the manifest self-deletes per resume-builder SKILL.md PHASE 4.

---

### Step 3 — Final summary

After all rows processed, print a tally:
```
Processed: N | Ready: M | Skipped: K | Failed: L
```

Then list each result with its emoji prefix for quick scanning:
- ✅ Ready → company + filename
- ⏭️ Skipped → company + reason
- ❌ Failed → company + reason

---

## What NOT to do

- ❌ Never modify a blueprint `.md` file during a queue run. Blueprint refinement is out-of-band.
- ❌ Never prompt the user for blueprint picks or ATS choices per JD. This skill is autonomous.
- ❌ Never re-render a row that's already `Ready` / `Submitted` / `Skipped` / `Failed`. Only `Queued` rows.
- ❌ Never invent JD content. If `jd_text` is too short (<500 chars) to make a real fit call, mark as `Failed` with reason `"JD too short to evaluate"`.
- ❌ Never skip the QA gate. PHASE 4.5 is mandatory — every output must pass before status flips to `Ready`.
- ❌ Never write to `queue.csv` directly. Always go through `POST /row/<id>/update` so the server holds the lock.
- ❌ Never commit a `Don't Apply` call without a concrete reason logged in `notes`.

---

## Server health check (run first)

Before fetching the queue, verify the server is up:
```bash
curl -sS http://localhost:3737/health
```

Expected: `{"ok":true}`. If the server is down, print:
> "Capture server is not running. Start with: launchctl load ~/Library/LaunchAgents/com.jobflow.server.plist"
and stop. Do NOT attempt to process from a stale CSV directly.
