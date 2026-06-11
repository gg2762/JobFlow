---
name: answer-questions
description: >
  Tailors answers to application questions captured in the JobFlow-OS dashboard. Reads pending
  questions from queue.csv (via the local server), pulls the relevant template from
  ./user_data/answer_bank.md, tailors with the row's JD + chosen
  blueprint context, and writes answers back to the row so the dashboard shows them next refresh.
  Triggers on: "answer my questions", "answer pending questions", "/answer-questions",
  "process questions", "tailor application answers". Operates autonomously — does not prompt
  the user for guidance per question. Skips questions that are already answered (a non-empty)
  unless explicitly told to re-answer.
---

# Answer-Questions Skill

Batch-answers application questions the user has typed into the JobFlow-OS dashboard. Each pending question is classified, mapped to the right `answer_bank.md` section, and tailored using the JD + blueprint archetype of the row it belongs to.

**Hard rule:** never invent facts. Personal facts (notice period, comp anchors, references) come from `answer_bank.md` verbatim. If `answer_bank.md` has a `[TBD]` marker for a fact the question asks about, write the answer as `"[need to know: <what's missing>]"` and let the user fill it in by editing `answer_bank.md` — do NOT guess.

---

## Invocation

User says any of: "answer my questions", "answer pending questions", "process questions", "/answer-questions", "tailor application answers".

---

## Pipeline

### Step 1 — Server health + fetch queue

```bash
curl -sS http://localhost:3737/health
curl -sS 'http://localhost:3737/queue?full=1'
```

If server is down, print:
> "Capture server is not running. Start with: launchctl load ~/Library/LaunchAgents/com.jobflow.server.plist"
and stop.

### Step 2 — Find rows with pending questions

For each row, parse `application_questions` (a JSON-encoded array). Skip rows where every item has a non-empty `a` field. For the remaining rows, collect items where `a === ''`.

If no pending questions across all rows, print:
> "No pending questions. Nothing to answer."
and stop.

### Step 3 — Read the answer bank

```bash
cat ./user_data/answer_bank.md
```

Hold this in context. It's the canonical source for all personal facts + reusable answer templates.

### Step 4 — For each row with pending questions

For each row, for each pending question:

#### 4.1 — Classify the question

Pick the most-specific class:
- **Salary / compensation** — keywords: salary, compensation, base, OTE, expected, range, package, equity, bonus
- **Notice period / availability / start date** — keywords: notice, start, available, join, begin
- **Visa / location / relocation / work permit** — keywords: visa, sponsor, located, relocation, remote, hybrid, citizenship
- **Years of experience (specific area)** — pattern: "How many years of X" / "How long have you worked with Y"
- **Why this company / role** — keywords: attract, interested, why, excited, motivation, draws you
- **Behavioral / STAR** — keywords: "tell us about a time when", "describe a situation", "example of"
- **Failure / mistake / weakness** — keywords: failure, mistake, weakness, learn, regret
- **Management style** — keywords: manage, leadership, team, coach, direct reports
- **References** — keywords: references, contact, vouch
- **Career goals / next role / 5-year plan** — keywords: goals, ambition, looking for, next chapter
- **Open-ended / other** — anything that doesn't match above

#### 4.2 — Pull the relevant section from `answer_bank.md`

- Salary → "Compensation" section (salary expectations by tier + negotiation script)
- Notice / start / availability → "Personal facts" section
- Visa / location → "Personal facts" section
- Years (specific area) → "Years of experience (per area)" section
- Why this company / role → "Why this company / role" templates, **picked by the row's blueprint archetype** (e.g., if `blueprint === 'blueprint_regulated_saas.md'` use the Regulated SaaS template)
- Behavioral / STAR → "Behavioral STAR stories (reusable kernels)" — pick the kernel best matching the question's topic
- Failure / mistake → "Open-ended common questions" / "Tell me about a failure / mistake"
- Management style → "Open-ended common questions" / "What's your management style?"
- References → "References" section (NEVER share full contact details in the resume/application unless explicitly asked AND the section is populated)
- Career goals → "Career goals (universal template)" tailored to tier
- Open-ended → "Open-ended common questions"

#### 4.3 — Tailor with row context

Read from the row: `page_title`, `jd_text`, `blueprint`. Tailor the template using:

- **Company + role name** extracted from `page_title` or `jd_text` first lines
- **Blueprint archetype** for voice + which proof points to lead with (see "Trajectory framing" in answer_bank)
- **JD vocabulary mirroring** — if the JD says "data models, schemas, API design", echo those exact terms
- **Tier calibration** — match the voice to the role's seniority. If the user's `skill_overrides.md` defines tier-specific voice rules (e.g., "Sr PM tier is safety-net; don't lean Director-tier framing"), honor them.

#### 4.4 — Length calibration

- 1-2 sentence answers for: salary range, notice period, visa status, years of experience (numeric), location
- Single short paragraph (3-5 sentences) for: why this role, career goals, management style
- 1-2 short paragraphs for: behavioral STAR (situation/task/action/result), failure/mistake, open-ended motivation

**Default to shorter.** If the question allows brevity, take it. Application forms usually have character limits.

#### 4.5 — Banned moves

- ❌ Never quote previous comp from the "Recent comp anchors" subsection — it's internal reference only.
- ❌ Never invent a notice period, availability date, or relocation preference. If `answer_bank.md` has `[TBD]`, return `"[need to know: notice period — please update answer_bank.md]"` so the user fills it in.
- ❌ Never bad-mouth previous employers or current role.
- ❌ Never violate the formatting rules in `./user_data/skill_overrides.md` (e.g., the user may have a canonical location format like "City, Country" with no "Remote (...)" prefix).
- ❌ Never use vague filler ("passionate about", "results-driven", "dynamic", etc.) — same banned phrases as resume-builder.
- ❌ Never quote traction metrics for a project or role that don't exist in the user's `answer_bank.md` or in any blueprint in `./user_data/blueprints/`.
- ❌ Never push a title-tier voice that mismatches the role being applied to. If the JD is a Sr PM role and the user's overrides specify "Sr PM is safety-net tier — stay in lane, don't lean Director", honor that.

### Step 5 — Write answers back

For each row, build the updated `application_questions` JSON:

```javascript
[
  { q: "What is your expected salary range?", a: "I'm targeting €80K–€90K base...", answered_at: "<ISO timestamp>" },
  { q: "...", a: "...", answered_at: "..." }
]
```

POST to `/row/<id>/update`:

```bash
curl -sS -X POST "http://localhost:3737/row/<id>/update" \
  -H 'content-type: application/json' \
  -d '{"application_questions": "<JSON-encoded array>"}'
```

### Step 6 — Final summary

After all rows processed, print:

```
Answered: N questions across M rows
```

Then list each row's update with brief detail:
- ✅ <Company> <Role> — N answered
- ⏭️ <Company> <Role> — N skipped (need answer_bank update)
- ❌ <Company> <Role> — N failed (error: ...)

---

## What NOT to do

- ❌ Never modify the `answer_bank.md` file as part of a normal `/answer-questions` run. Bank refinement is an explicit, separate user request.
- ❌ Never re-answer questions whose `a` is already non-empty. The dashboard has a "clear answer" button that the user uses to mark a question for re-answer.
- ❌ Never write to `queue.csv` directly. Always go through `POST /row/<id>/update` so the server holds the lock.
- ❌ Never prompt the user mid-run for guidance. The skill is autonomous. If a fact is missing, return the `[need to know: ...]` marker in the answer and let the user fix it out-of-band.
- ❌ Never substitute the row's chosen blueprint with a different archetype. If `blueprint === 'blueprint_regulated_saas.md'`, the "why this role" template comes from the Regulated SaaS section, not from Strategy/Growth, even if you personally think a different framing would land better.
- ❌ Never include the negotiation script verbatim in a written application answer. The script is a recruiter-call talking point, not a written application answer.

---

## Edge cases

- **Question text matches multiple classes:** pick the most-specific one. Salary + career goals = treat as the combined question (use the Scaleway-style combined template from the answer_bank → adapt).
- **Question is in a different language (French / Italian / Spanish):** answer in the question's language. Don't auto-translate to English unless the application form is otherwise English-only.
- **Question is empty:** skip silently; do not error.
- **Row's `blueprint` field is empty (row hasn't been processed by `/process-queue` yet):** use the "Universal template" + "Personal facts" sections; don't tailor to a blueprint archetype.
- **Multiple sequential runs on the same row:** idempotent. Already-answered questions stay untouched.
