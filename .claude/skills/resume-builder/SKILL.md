---
name: resume-builder
description: >
  Tailors Gregorio Galletti's resume to a specific job posting and outputs a formatted .docx file.
  Trigger this skill whenever the user pastes a job description or job posting — even with no
  additional instructions. Also triggers on phrases like "tailor my resume", "apply to this job",
  "create a resume for", or any job posting text. Routes the JD into one of 5 sealed Blueprints at
  ./user_data/blueprints/ (adtech, data_infra, strategy_growth,
  regulated_saas, ai_founder), performs surgical ATS keyword injection at .js manifest build time,
  and saves the final .docx to ${JOBFLOW_OUTPUT_DIR:-$HOME/Desktop/Jobs/Resume}/. Never invents facts.
  Never rewrites bullet bodies. Blueprints are sealed and only refined in explicit out-of-band sessions.
---

Base directory for this skill: ./.claude/skills/resume-builder
Blueprint + pipeline source: ./user_data/blueprints/

# Resume Builder Skill (v2)

Autonomous resume triage and programmatic optimization agent. Routes a job description into one of 5 sealed Blueprints, performs surgical ATS keyword injection during `.js` build, renders a one-page tailored `.docx`. Never invents facts. Never rewrites bullet bodies. Never modifies blueprints outside an explicit refinement session.

**Core inversion vs v1:** there is no longer a verbose `canon_job_history.md`. The chosen blueprint IS the canon. If a fact or metric is not in the blueprint, it does not go on the resume. The 3-version system, title-tier calibration, role-archetype lens, and 3-core-skills exercise are all collapsed into a single decisioning node: blueprint selection.

---

## Invocation

The user pastes a job description with no additional instructions. That is the full trigger. Parse the JD and run the pipeline.

If a LinkedIn URL is provided and returns a login wall, ask:
> "LinkedIn blocked the fetch — please paste the job description text."

---

## Pipeline

### PHASE 1 — Triage, Apply/Don't Apply, Blueprint Selection

#### 1.1 Apply / Don't Apply (mandatory call)

Before any other work, make a structural fit call. If gaps are too deep, say so and stop:

> "Don't apply. [2–3 sentence explanation of structural gaps.]"

**Don't apply when:**
- Core domain is completely absent from the blueprint library (e.g., satellite broadband, pure hardware engineering, consumer travel)
- JD demands a strict factual prerequisite Gregorio lacks (e.g., hardware degree, deep backend Java/C++ systems engineering)
- Years gap is severe AND domain is also a mismatch (blueprints cover ~6 years PM experience; roles requiring 10+ may still apply if domain is strong)
- 3+ blocking gaps with no workaround

**Do apply and proceed when:**
- Years are within reasonable range
- At least 60% of key responsibilities map to something in one of the blueprints
- Gaps are addressable through honest framing within an existing blueprint

#### 1.2 Parse the JD

Extract:
- **Company name** + **job title** → needed for filename
- **Seniority level** (entry / mid / senior / lead / director / VP)
- **Key responsibilities** (top 5–7)
- **Required and preferred skills**
- **Domain** (adtech, data infra, strategy, regulated SaaS, AI-founder, or unmapped)
- **ATS keywords** to inject naturally
- **Language requirement** → English (fluent), Italian (native), Spanish (professional), French (conversational)
- **Explicit user overrides** in the message:
  - "use [blueprint name]" → user-named blueprint (overrides auto-pick)
  - (Vibe is always included until the user issues a new standing rule)

#### 1.3 Blueprint Selection (the single calibration decision)

There are 5 sealed blueprints. Pick exactly one.

| Blueprint file | Target roles |
|---|---|
| `blueprint_adtech.md` | Ad-Tech Product Leader, CTV/Programmatic PM, Measurement & Identity PM |
| `blueprint_data_infra.md` | Deep-Tech Technical PM, MLOps, Data Infrastructure, High-Throughput / Streaming Data Platform PM |
| `blueprint_strategy_growth.md` | Strategy, Corporate Development, Growth PM, PLG, BizOps, P&L roles, Consulting, Chief of Staff |
| `blueprint_regulated_saas.md` | Healthcare PM, Fintech PM, Data Governance / Compliance PM, Enterprise B2B SaaS Workflow PM |
| `blueprint_ai_founder.md` | AI PM, Generative AI PM, Founder-associate, EIR, Early-Stage AI Startups (0-to-1) |

**Routing rules:**
1. If the user named a blueprint, use it.
2. Otherwise, pick the closest match by Target Roles.
3. **If no blueprint cleanly maps** (e.g., a niche role like Solutions Engineer at a specific vertical), pick the closest fallback AND ask the user before drafting:
   > "This JD doesn't map cleanly onto any of the 5 blueprints. Closest match: [blueprint name]. Do you want me to (a) proceed with that blueprint, or (b) recommend a new blueprint we'd build in a future session?"

**Announce the choice in the terminal — before any drafting:**

> **Blueprint:** [filename] — [archetype]
> **Why:** [one sentence connecting JD signal to blueprint choice]
> **Vibe.co:** included (standing rule)
>
> Reply with another blueprint name (e.g., "use blueprint_ai_founder") to override.

#### 1.4 Standing inclusion/exclusion rules

- **Vibe.co** — included in every resume until further notice from Gregorio. Do not drop it on a JD-by-JD basis.
- **AWorld** — fully retired. Never include.
- **Search Fund Accelerator** — only appears in `blueprint_strategy_growth.md` and is rendered exactly as that blueprint specifies.
- **LegendCraft.io** — rendered as the dedicated **Featured Project** section in every blueprint, after Work Experience and before Skills.
- **Pelico-to-Vibe / Vibe-to-LegendCraft date gap** — never explain on the resume. Gregorio handles verbally.

---

### PHASE 2 — Manifest Generation

1. Load the chosen blueprint's text content (summary, bullets, skills, education) verbatim into memory.
2. Initialize a transient `resume_manifest.js` file with the formatting rules from PHASE 4 baked in and the blueprint content as the payload data.
3. **Pre-flight word count (informational, not blocking):** count total body words (Summary + section labels + role headers + job titles + bullets + skills rows + education + Featured Project block). If the count exceeds 500, log a warning to the terminal but continue:
   > "⚠️ Blueprint body = [N] words (over 500-word soft target). Rendering anyway. We'll calibrate after reviewing the Word doc."
4. **Per-bullet length check:** if any bullet exceeds 30 words, log it as informational. Do not auto-trim — blueprints are sealed.

---

### PHASE 3 — Surgical ATS Tweaking

1. Extract ALL critical ATS-screening terms from the JD: technical tooling, frameworks, domain verbs, compliance regimes, methodology nouns. No numeric cap — capture every high-signal alignment phrase.
2. Cross-reference against the text strings staged in `resume_manifest.js` (from the chosen blueprint).
3. Identify missing terms that are factually supported by the chosen blueprint's underlying signals (i.e., the term is consistent with the bullets already present — it's not a fabrication).
4. Inject these keywords inline using surgical 1-to-1 swaps or comma-separated additions inside the text arrays.

**Hard constraints during ATS injection:**
- ❌ Do NOT rewrite entire sentences.
- ❌ Do NOT alter, dilute, round, or invent numerical metrics.
- ❌ Do NOT change the professional human voice of any bullet.
- ❌ Do NOT inject a fact that is not factually supported by the chosen blueprint's existing signals.
- ❌ Do NOT modify the underlying `.md` blueprint file. Blueprints are sealed and only change in explicit collaborative refinement sessions.
- ✅ Lowest-risk injection site: the **Skills row** (Product / Technical). Use it first.
- ✅ Bullet-body injections allowed only when (a) the term replaces or augments a closely-adjacent existing term, and (b) the bullet still reads naturally and within ≤30 words.

After injection, print a one-line summary of injected keywords to the terminal.

---

### PHASE 4 — Programmatic Render + Cleanup

Execute the transient manifest with:
```
NODE_PATH=${JOBFLOW_NODE_PATH:-$HOME/.npm-global/lib/node_modules} node resume_manifest.js
```

The manifest writes a `.docx` to:
```
${JOBFLOW_OUTPUT_DIR:-$HOME/Desktop/Jobs/Resume}/{Company}_{Position}_GG.docx
```

Filename rules:
- `{Company}`: company name, underscores for spaces (e.g., `Madison_Logic`)
- `{Position}`: shortened title, no spaces (e.g., `Sr_PM`, `Director_Product`, `Principal_PM`)
- Always append `_GG`

After PHASE 4.5 passes, the manifest self-deletes via the captured `__filename`.

---

### PHASE 4.5 — Mandatory QA Gate (REQUIRED — every resume must pass before ship)

After rendering the `.docx`, the manifest MUST call the QA utility before reporting success:

```javascript
const { qaResume, printReport } = require('./qa_resume.js');
const report = qaResume(OUTPUT);
printReport(report, OUTPUT);
if (!report.pass) process.exit(1);  // do NOT report 'Saved' on failure
```

The QA utility (`qa_resume.js`):
1. Converts `.docx` → `.pdf` via LibreOffice headless (`/Applications/LibreOffice.app/Contents/MacOS/soffice`)
2. Verifies **page count = 1** (via `pdfinfo`)
3. Verifies **each Skills row (Product / Technical / Languages) renders on exactly 1 visual line** (via `pdftotext -layout` — detects continuation-line indentation)
4. Spot-checks `.docx` XML for canon formatting (Times New Roman everywhere, margins 720/900/720/900, right-tab stops at position 10440)

**On PASS:**
- Keep both the `.docx` and the auto-generated `.pdf` side by side at `${JOBFLOW_OUTPUT_DIR:-$HOME/Desktop/Jobs/Resume}/`
- Print `✅ QA PASS: {filename}` + PDF path
- Self-delete the manifest

**On FAIL:**
- Do NOT report success
- Print `❌ QA FAIL: {filename}` with the specific failing check(s)
- Keep the `.docx` for manual inspection
- Keep the `.pdf` (so user can inspect what spilled) but mark it as not-ready
- Surface failures to the user; either auto-fix (e.g., drop the last Skills item, trim a low-priority bullet) and re-render OR ask which fix to apply
- DO NOT self-delete the manifest until the next attempt succeeds

After successful QA, confirm in the terminal:
> "Saved: ${JOBFLOW_OUTPUT_DIR:-$HOME/Desktop/Jobs/Resume}/{filename}.docx"
> "Saved: ${JOBFLOW_OUTPUT_DIR:-$HOME/Desktop/Jobs/Resume}/{filename}.pdf"
> "Blueprint: [filename]"
> "ATS keywords injected: [comma-separated list]"
> "QA: PASS (page count, Skills line-wrap, formatting)"
> "Manifest deleted."

**Hard rule:** the `.pdf` is the deliverable. Both files ship together. If QA fails, neither is treated as ready — Gregorio sees the failure and decides the fix.

---

## Canonical Formatting Rules (preserved verbatim from v1 — DO NOT DEVIATE)

These rules were curated across dozens of iterations. Last calibration: 2026-06-10 against `PandaDoc_Principal_PM_GG.docx`. Never substitute values.

### Page setup
```javascript
size: { width: 12240, height: 15840 },  // US Letter
margin: { top: 720, right: 900, bottom: 720, left: 900 }
// Content width = 10440 DXA
```

### Typography

**Font face: Times New Roman for ALL text.** Set as the document default AND on every TextRun. Never use Calibri, Arial, or any other font.

```javascript
const FONT = 'Times New Roman';
// Apply on every TextRun: { text: '...', font: FONT, ... }
// Also set as document default:
// styles: { default: { document: { run: { font: FONT, size: 20 } } } }
```

**IMPORTANT:** the docx `size` field is in HALF-POINTS. The table shows the half-point values to use in code (visual point size in parentheses).

| Element | size (half-points) | Visual | Style |
|---|---|---|---|
| Name | 44 | 22pt | bold |
| Section labels | 22 | 11pt | bold + bottom border (BorderStyle.SINGLE, size 4) |
| Company name | 20 | 10pt | bold |
| Job title | 20 | 10pt | italic |
| Featured Project intro line | 20 | 10pt | italic |
| Body / bullets | 20 | 10pt | regular |
| Contact info | 18 | 9pt | regular, right-aligned |

These sizes are canonical — using larger values (e.g., 56/26/21) inflates page count and is a recurring failure mode.

### Tab stop rule — universal
Every right-aligned element uses position **10440** — contact info lines AND company/date lines:
```javascript
tabStops: [{ type: TabStopType.RIGHT, position: 10440 }]
```

### Header block
```
Line 1: "Gregorio Galletti" [bold, size 44 = 22pt]  →tab→  gregoriogalletti1995@gmail.com [size 18 = 9pt]
Line 2: "" →tab→  linkedin.com/in/gregoriogalletti [size 18 = 9pt]
Line 3: "" →tab→  Paris, France [size 18 = 9pt]  + bottom border
```
Add "open to relocation" on line 3 only if the role is outside France.

### Summary section (REQUIRED — placed immediately below the header block, above Work Experience)
- Section label: **"Summary"** styled like every other section label (size 22 bold + bottom border)
- Body: a single paragraph, rendered verbatim from the chosen blueprint's `## SUMMARY` block, body size 20, no bullets, no first-person pronouns
- Do NOT rewrite the summary. ATS keyword swaps are allowed under PHASE 3 constraints.

### Work Experience section header
- Section label: **"Relevant Work Experience"** (default per all blueprints) or whatever the blueprint specifies
- Same bottom-border styling as other section labels
- Roles in chronological order (latest first), exactly as the chosen blueprint lists them
- Vibe.co is always the first role

### Inter-role spacing
Between each job role block, use a spacer paragraph. TextRun `size` is in half-points (`size: 10` = 5pt). Always include `lineRule: 'exact'` to prevent Word from stretching:
```javascript
new Paragraph({
  spacing: { before: 0, after: 0, line: 100, lineRule: 'exact' },
  children: [new TextRun({ text: '', size: 10 })]
})
```

### Bullets
```javascript
LevelFormat.BULLET, text: '•'
indent: { left: 540, hanging: 260 }
size: 20  // half-points = 10pt
spacing: { before: 0, after: 40 }
```
Bullet bodies come verbatim from the blueprint, with PHASE 3 keyword injections only.
Em dashes (—) inside bullets count as a word; prefer semicolons or commas. Blueprints already follow this — don't introduce em dashes during ATS injection.

### Featured Project section (LegendCraft.io)
- Section label: **"Featured Project"** styled like every other section label
- Placed AFTER Work Experience, BEFORE Skills
- Format: bold "LegendCraft.io" + right-aligned date range (`2026 - Present`), followed by an italic product-description line, followed by 2 bullets from the chosen blueprint
- Italic intro line is canonical per blueprint — render exactly as written

### Skills section
- Section label: **"Skills"** styled like every other section label
- Three rows: **Product**, **Technical**, **Languages**, rendered verbatim from the chosen blueprint
- ATS injections allowed here under PHASE 3 (lowest-risk injection site)
- **Languages line is locked across all blueprints:** English (Fluent), Italian (Native), Spanish (Professional), French (Conversational). Never change.

### Education section
- Section label: **"Education"** styled like every other section label
- Render the blueprint's Education block verbatim (includes Columbia thesis line only where the blueprint includes it)

### Self-deleting build script
Always capture `__filename` at the top of the manifest so the script can self-delete after writing the `.docx`:
```javascript
const SCRIPT_PATH = __filename;
// ...
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(OUTPUT_PATH, buffer);
  console.log(`Saved: ${path.basename(OUTPUT_PATH)}`);
  fs.unlinkSync(SCRIPT_PATH);
  console.log('Manifest deleted.');
});
```

---

## Banned phrases (still in force)

Never use: spearheaded, leveraged synergies, thought leader, passionate about, results-driven, dynamic, guru, ninja, rockstar. Vague quantifiers (significantly, dramatically, substantially, markedly, considerably) are not substitutes for real metrics.

Blueprints already avoid these. If a JD's vocabulary uses them, do NOT propagate them into the resume during ATS injection.

---

## What NOT to do

- ❌ Never rewrite bullet bodies. Only inline keyword injection or 1-to-1 swaps.
- ❌ Never invent or alter metrics. Numbers are verbatim from the chosen blueprint.
- ❌ Never modify a blueprint `.md` file outside an explicit collaborative session with Gregorio.
- ❌ Never inject a fact, tool, or framework that isn't already factually supported by the chosen blueprint's signals.
- ❌ Never drop Vibe.co (standing rule — included on every resume).
- ❌ Never add AWorld (retired).
- ❌ Never add Search Fund Accelerator to any blueprint other than `blueprint_strategy_growth.md`.
- ❌ Never omit the Summary section.
- ❌ Never reorder roles. Chronological, latest first, exactly as the blueprint lists.
- ❌ Never list French as "professional" or "fluent." Canonical level is "Conversational."
- ❌ Never use different tab stops for dates vs. contact info — both must be 10440.
- ❌ Never omit `lineRule: 'exact'` from the spacer paragraph — without it Word stretches the line.
- ❌ Never explain the Pelico-to-Vibe / Vibe-to-LegendCraft date gap on the resume.
- ❌ Never proceed past PHASE 1.1 without making an explicit apply / don't-apply call.
- ❌ Never proceed past PHASE 1.3 without announcing the chosen blueprint in the terminal.
- ❌ Never substitute typography sizes. The half-point values in the table are canonical.
- ❌ Never use Calibri or any non-Times-New-Roman font.

---

## Refinement loop (out-of-band)

Blueprints evolve only in dedicated refinement sessions with Gregorio. In a normal resume-generation invocation, the blueprint is read-only. If during PHASE 3 you notice a recurring ATS gap that would benefit from a permanent blueprint edit, flag it in the terminal at the end of the run as:

> "Suggested blueprint edit (not applied): [one-line description]. Confirm in a future refinement session to update [blueprint_name].md."

This keeps the standing rule clean: blueprints are sealed during execution, refined out-of-band.
