---
name: resume-builder
description: >
  Tailors the user's resume to a specific job posting and outputs a formatted .docx + .pdf.
  Trigger whenever the user pastes a job description or job posting — even with no
  additional instructions. Also triggers on phrases like "tailor my resume", "apply to this job",
  "create a resume for", or any job posting text. Routes the JD into one of the user's sealed
  Blueprints at ./user_data/blueprints/, performs surgical ATS keyword injection at .js
  manifest build time, and saves the final .docx + .pdf to ${JOBFLOW_OUTPUT_DIR:-$HOME/Desktop/Jobs/Resume}/.
  Never invents facts. Never rewrites bullet bodies. Blueprints are sealed and only refined in
  explicit out-of-band sessions.
---

Base directory for this skill: ./.claude/skills/resume-builder
Blueprint + pipeline source: ./user_data/blueprints/
User overrides (optional): ./user_data/skill_overrides.md

# Resume Builder Skill (v2)

Autonomous resume triage and programmatic optimization agent. Routes a job description into one of the user's sealed Blueprints, performs surgical ATS keyword injection during `.js` build, renders a one-page tailored `.docx` + `.pdf`. Never invents facts. Never rewrites bullet bodies. Never modifies blueprints outside an explicit refinement session.

**Core principle:** the chosen blueprint IS the canon. If a fact or metric is not in the blueprint, it does not go on the resume. Blueprint selection is the only calibration decision the skill makes per JD.

---

## Step 0 — Load user overrides and ATS whitelist

Before running PHASE 1, read two files if they exist:

### 0.1 — `./user_data/skill_overrides.md`

User-specific rules the open-source skill cannot ship:

- Standing inclusion/exclusion rules (e.g., "always include role X", "never include role Y")
- Personal Apply / Don't-Apply prerequisites (e.g., specific degrees the user lacks)
- The user's canonical header block (name, email, LinkedIn handle, location)
- Personal language calibration (e.g., "French is Conversational, never Professional")
- Career-narrative rules (e.g., "never explain employment gap between X and Y on the resume")
- Featured Project content rules (e.g., "always render <project> as the Featured Project")

Apply these overrides on top of the universal rules below. When overrides and universal rules conflict, **overrides win** — they are the user's explicit instructions.

If the file is missing, proceed using only the universal rules. See `./blueprints/_skill_overrides_template.md` in the repo for a template.

### 0.2 — `./user_data/ats_whitelist.md` (PHASE 3 enforcement)

The bounded vocabulary of ATS terms allowed for injection. Sections:

- **Always defensible (any blueprint)** — terms backed by signals in every blueprint
- **Per-blueprint sections** — terms only injectable when that blueprint is the chosen one
- **NEVER inject** — factual gaps that look tempting but the user has no real experience in

**The whitelist is the contract for PHASE 3.** If a JD demands a term not in the whitelist (or in the NEVER list), it is logged as an unfulfilled gap — never silently injected. See PHASE 3 for the enforcement rule.

If `ats_whitelist.md` is missing, PHASE 3 falls back to the prior heuristic ("term must be supported by the chosen blueprint's existing signals") — but the user is strongly encouraged to maintain the whitelist; it eliminates fabrication risk at the source. See `./blueprints/_ats_whitelist_template.md` in the repo for a template.

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
- Core domain is completely absent from the blueprint library (e.g., satellite broadband, pure hardware engineering, consumer travel) — the user's blueprints don't cover it
- JD demands a strict factual prerequisite the user lacks (see `skill_overrides.md` for the user's prerequisite gaps; if no overrides file, default to obvious gaps like degree requirements the blueprints can't speak to)
- Experience-years gap is severe AND domain is also a mismatch
- 3+ blocking gaps with no workaround

**Do apply and proceed when:**
- Years are within reasonable range for the user's blueprints
- At least 60% of key responsibilities map to something in one of the blueprints
- Gaps are addressable through honest framing within an existing blueprint

#### 1.2 Parse the JD

Extract:
- **Company name** + **job title** → needed for filename
- **Seniority level** (entry / mid / senior / lead / director / VP)
- **Key responsibilities** (top 5–7)
- **Required and preferred skills**
- **Domain** (match to one of the user's blueprint archetypes, or flag as unmapped)
- **ATS keywords** to inject naturally
- **Language requirement** → check user's overrides for canonical language proficiency wording
- **Explicit user overrides** in the message — e.g., "use [blueprint name]" → user-named blueprint (overrides auto-pick)

#### 1.3 Blueprint Selection (the single calibration decision)

Pick exactly one blueprint from `./user_data/blueprints/`. The default set is:

| Blueprint file | Target roles |
|---|---|
| `blueprint_adtech.md` | Ad-Tech Product Leader, CTV/Programmatic PM, Measurement & Identity PM |
| `blueprint_data_infra.md` | Deep-Tech Technical PM, MLOps, Data Infrastructure, High-Throughput / Streaming Data Platform PM |
| `blueprint_strategy_growth.md` | Strategy, Corporate Development, Growth PM, PLG, BizOps, P&L roles, Consulting, Chief of Staff |
| `blueprint_regulated_saas.md` | Healthcare PM, Fintech PM, Data Governance / Compliance PM, Enterprise B2B SaaS Workflow PM |
| `blueprint_ai_founder.md` | AI PM, Generative AI PM, Founder-associate, EIR, Early-Stage AI Startups (0-to-1) |

The user may have added, removed, or renamed blueprints — discover what's actually in `./user_data/blueprints/` at runtime rather than assuming this list.

**Routing rules:**
1. If the user named a blueprint, use it.
2. Otherwise, pick the closest match by Target Roles (informed by the blueprint's own SUMMARY section).
3. **If no blueprint cleanly maps** (e.g., a niche role like Solutions Engineer at a specific vertical), pick the closest fallback AND ask the user before drafting:
   > "This JD doesn't map cleanly onto any of your blueprints. Closest match: [blueprint name]. Do you want me to (a) proceed with that blueprint, or (b) recommend a new blueprint we'd build in a future session?"

**Announce the choice in the terminal — before any drafting:**

> **Blueprint:** [filename] — [archetype]
> **Why:** [one sentence connecting JD signal to blueprint choice]
> **User overrides applied:** [comma-separated list of overrides that influenced this run, or "none"]
>
> Reply with another blueprint name (e.g., "use blueprint_ai_founder") to override.

#### 1.4 Standing inclusion/exclusion rules

If `./user_data/skill_overrides.md` defines standing inclusion/exclusion rules (e.g., "always include role X as the first Work Experience entry", "never include role Y", "rename role Z to W"), enforce them here in addition to the chosen blueprint's content.

Common override categories:
- **Always-include roles** — append regardless of blueprint
- **Always-exclude roles** — strip from blueprint output if present
- **Featured Project content** — which project (if any) renders in the Featured Project slot
- **Archetype routing exceptions** — "for archetype X, append role Y even though it's not in the blueprint"

---

### PHASE 2 — Manifest Generation

1. Load the chosen blueprint's text content (summary, bullets, skills, education) verbatim into memory.
2. Initialize a transient `./resume_manifest.js` with the formatting rules from PHASE 4 baked in and the blueprint content as the payload data.
3. **Pre-flight word count (informational, not blocking):** count total body words (Summary + section labels + role headers + job titles + bullets + skills rows + education + Featured Project block). If the count exceeds 500, log a warning to the terminal but continue:
   > "⚠️ Blueprint body = [N] words (over 500-word soft target). Rendering anyway. We'll calibrate after reviewing the Word doc."
4. **Per-bullet length check:** if any bullet exceeds 30 words, log it as informational. Do not auto-trim — blueprints are sealed.

---

### PHASE 3 — Surgical ATS Tweaking

1. Extract ALL critical ATS-screening terms from the JD: technical tooling, frameworks, domain verbs, compliance regimes, methodology nouns. No numeric cap — capture every high-signal alignment phrase.
2. Cross-reference against the text strings staged in `resume_manifest.js` (from the chosen blueprint).
3. **Whitelist check (mandatory when `ats_whitelist.md` is present):** for each candidate term, classify it against `./user_data/ats_whitelist.md`:
   - In **"Always defensible"** OR the section matching the chosen blueprint → **INJECT**
   - In **"NEVER inject"** → **DO NOT INJECT** — log as unfulfilled gap
   - Not in any section → **DO NOT INJECT** — log as unfulfilled gap
4. Inject whitelisted terms inline using surgical 1-to-1 swaps or comma-separated additions inside the text arrays.

**Hard constraints during ATS injection:**
- ❌ Do NOT rewrite entire sentences.
- ❌ Do NOT alter, dilute, round, or invent numerical metrics.
- ❌ Do NOT change the professional human voice of any bullet.
- ❌ Do NOT inject any term that is not present in `./user_data/ats_whitelist.md` (when the file exists). The whitelist is the contract — JD demand is not a license to fabricate.
- ❌ Do NOT inject a fact that is not factually supported by the chosen blueprint's existing signals (fallback rule when `ats_whitelist.md` is absent).
- ❌ Do NOT modify the underlying `.md` blueprint file. Blueprints are sealed and only change in explicit collaborative refinement sessions.
- ✅ Lowest-risk injection site: the **Skills row** (Product / Technical). Use it first.
- ✅ Bullet-body injections allowed only when (a) the term replaces or augments a closely-adjacent existing term, (b) the bullet still reads naturally and within ≤30 words, AND (c) the term is on the whitelist.

After injection, print **two** one-line summaries to the terminal:
1. `ATS injected: <comma-separated list>` — the terms that made it in
2. `ATS gaps (in JD, not in whitelist): <comma-separated list>` — terms the JD demanded that you refused to inject. This is signal for the user about JD fit, not a failure.

---

### PHASE 4 — Programmatic Render + Cleanup

Execute the transient manifest with:
```
NODE_PATH=${JOBFLOW_NODE_PATH:-$HOME/.npm-global/lib/node_modules} node resume_manifest.js
```

The manifest writes a `.docx` to:
```
${JOBFLOW_OUTPUT_DIR:-$HOME/Desktop/Jobs/Resume}/{Company}_{Position}_{Suffix}.docx
```

Filename rules:
- `{Company}`: company name, underscores for spaces (e.g., `Madison_Logic`)
- `{Position}`: shortened title, no spaces (e.g., `Sr_PM`, `Director_Product`, `Principal_PM`)
- `{Suffix}`: optional initials/version tag, configurable via `skill_overrides.md` (e.g., the user's initials). Default: none.

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

The QA utility (`./qa_resume.js`):
1. Converts `.docx` → `.pdf` via LibreOffice headless
2. Verifies **page count = 1** (via `pdfinfo`)
3. Verifies **each Skills row (Product / Technical / Languages) renders on exactly 1 visual line** (via `pdftotext -layout` — detects continuation-line indentation)
4. Spot-checks `.docx` XML for canonical formatting (Times New Roman everywhere, margins 720/900/720/900, right-tab stops at position 10440)

**On PASS:**
- Keep both the `.docx` and the auto-generated `.pdf` side by side
- Print `✅ QA PASS: {filename}` + PDF path
- Self-delete the manifest

**On FAIL:**
- Do NOT report success
- Print `❌ QA FAIL: {filename}` with the specific failing check(s)
- Keep the `.docx` for manual inspection
- Keep the `.pdf` so the user can inspect what spilled, but mark it as not-ready
- Surface failures to the user; either auto-fix (drop the last Skills item, trim a low-priority bullet) and re-render OR ask which fix to apply
- DO NOT self-delete the manifest until the next attempt succeeds

After successful QA, confirm in the terminal:
> "Saved: ${JOBFLOW_OUTPUT_DIR:-$HOME/Desktop/Jobs/Resume}/{filename}.docx"
> "Saved: ${JOBFLOW_OUTPUT_DIR:-$HOME/Desktop/Jobs/Resume}/{filename}.pdf"
> "Blueprint: [filename]"
> "ATS keywords injected: [comma-separated list]"
> "QA: PASS (page count, Skills line-wrap, formatting)"
> "Manifest deleted."

**Hard rule:** the `.pdf` is the deliverable. Both files ship together. If QA fails, neither is treated as ready — the user sees the failure and decides the fix.

---

## Canonical Formatting Rules (DO NOT DEVIATE)

These rules render to the page-fit budget that `qa_resume.js` enforces. Substitution causes overflow or rejected QA.

### Page setup
```javascript
size: { width: 12240, height: 15840 },  // US Letter
margin: { top: 720, right: 900, bottom: 720, left: 900 }
// Content width = 10440 DXA
```

### Typography

**Font face: Times New Roman for ALL text.** Set as document default AND on every TextRun. Never use Calibri, Arial, or any other font.

```javascript
const FONT = 'Times New Roman';
// Apply on every TextRun: { text: '...', font: FONT, ... }
// Also set as document default:
// styles: { default: { document: { run: { font: FONT, size: 20 } } } }
```

**IMPORTANT:** the docx `size` field is in HALF-POINTS. The table shows half-point values to use in code (visual point size in parentheses).

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

Read the user's actual name + contact line from the chosen blueprint's first two lines (the `# NAME` header and the `email | linkedin | github | location` line below it — `github` is optional, blueprints may have 3 or 4 pipe-separated segments). Render:

```
Line 1: [Name from blueprint] [bold, size 44 = 22pt]  →tab→  [email from blueprint] [size 18 = 9pt]
Line 2: "" →tab→  [linkedin handle from blueprint] [size 18 = 9pt]
Line 3 (if github present): "" →tab→  [github handle from blueprint] [size 18 = 9pt]
Line N (last): "" →tab→  [location from blueprint] [size 18 = 9pt]  + bottom border
```

Split the contact line on `|` and trim each segment. The location is always the **last** segment; everything between linkedin and location is rendered as its own right-aligned line in order. Apply the bottom border only to the final (location) line.

If `skill_overrides.md` specifies "Add 'open to relocation' on line 3 when the role is outside [home country]", honor that.

### Summary section (REQUIRED — placed immediately below the header block, above Work Experience)
- Section label: **"Summary"** styled like every other section label (size 22 bold + bottom border)
- Body: a single paragraph, rendered verbatim from the chosen blueprint's `## SUMMARY` block, body size 20, no bullets, no first-person pronouns
- Do NOT rewrite the summary. ATS keyword swaps are allowed under PHASE 3 constraints.

### Work Experience section header
- Section label: **"Relevant Work Experience"** (or whatever the blueprint specifies)
- Same bottom-border styling as other section labels
- Roles in chronological order (latest first), exactly as the chosen blueprint lists them
- Override-defined always-include roles append per `skill_overrides.md`

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

### Featured Project section
- Section label: **"Featured Project"** styled like every other section label
- Placed AFTER Work Experience, BEFORE Skills
- Content comes from the blueprint's `## FEATURED PROJECT` block (or from `skill_overrides.md` if the user has defined a global Featured Project)
- Format: bold project name + right-aligned date range, followed by an italic product-description line, followed by 2 bullets
- Italic intro line is canonical per blueprint — render exactly as written

### Skills section
- Section label: **"Skills"** styled like every other section label
- Three rows: **Product**, **Technical**, **Languages**, rendered verbatim from the chosen blueprint
- ATS injections allowed here under PHASE 3 (lowest-risk injection site)
- **Languages line:** rendered verbatim from the blueprint. Override-defined language calibration rules (e.g., "X language is always quoted as 'Conversational' even if the JD asks for 'Professional'") apply.

### Education section
- Section label: **"Education"** styled like every other section label
- Render the blueprint's Education block verbatim

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
- ❌ Never modify a blueprint `.md` file outside an explicit collaborative session with the user.
- ❌ Never inject a fact, tool, or framework that isn't already factually supported by the chosen blueprint's signals.
- ❌ Never omit the Summary section.
- ❌ Never reorder roles. Chronological, latest first, exactly as the blueprint lists.
- ❌ Never use different tab stops for dates vs. contact info — both must be 10440.
- ❌ Never omit `lineRule: 'exact'` from the spacer paragraph — without it Word stretches the line.
- ❌ Never violate a rule defined in `skill_overrides.md` — those are explicit user instructions.
- ❌ Never proceed past PHASE 1.1 without making an explicit apply / don't-apply call.
- ❌ Never proceed past PHASE 1.3 without announcing the chosen blueprint in the terminal.
- ❌ Never substitute typography sizes. The half-point values in the table are canonical.
- ❌ Never use Calibri or any non-Times-New-Roman font.

---

## Refinement loop (out-of-band)

Blueprints evolve only in dedicated refinement sessions with the user. In a normal resume-generation invocation, the blueprint is read-only. If during PHASE 3 you notice a recurring ATS gap that would benefit from a permanent blueprint edit, flag it in the terminal at the end of the run as:

> "Suggested blueprint edit (not applied): [one-line description]. Confirm in a future refinement session to update [blueprint_name].md."

This keeps the standing rule clean: blueprints are sealed during execution, refined out-of-band.
