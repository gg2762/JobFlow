# ATS Whitelist — Template

> Copy this file to `./user_data/ats_whitelist.md` and fill it in.
> Loaded by `resume-builder` SKILL.md Step 0.2 alongside `skill_overrides.md`.

The bounded vocabulary of ATS terms the resume-builder may inject during
PHASE 3. **Only terms in this file are allowed.** A JD-demanded term not in
this file is logged as an unfulfilled gap and never silently injected.

Honesty wins over keyword density. The whitelist gates fabrication at the
source: if a JD demands "Mobile (iOS/Android)" and you have zero mobile-dev
experience, the skill refuses the swap rather than padding a Skills row with
something a recruiter or a future interview will instantly expose.

If this file is missing, PHASE 3 falls back to the legacy heuristic ("term
must be supported by the chosen blueprint's existing signals"). Maintaining
the whitelist is strongly recommended — it makes the boundary explicit and
removes interpretive room.

---

## Always defensible (any blueprint)

Terms backed by signals that appear in EVERY one of your blueprints. These
are safe to inject regardless of which blueprint the skill picks for a JD.

### Product
<!-- Examples — replace with your own:
- Product Strategy, Roadmap Ownership, Customer Discovery
- A/B Testing, Stakeholder Management, P&L Ownership
- 0-to-1 Platforms, GTM Strategy, Cross-functional Leadership
-->

### Technical
<!-- Examples — replace with your own:
- SQL, Python, Excel
- Your analytics stack (e.g., PostHog, Tableau, Amplitude — pick the ones
  YOU actually use; don't list both PostHog and Amplitude unless you use both)
- LLM APIs you actually call (Claude/OpenAI/Gemini), orchestration tools
  you actually run (n8n, LangChain, etc.)
- REST APIs, Webhooks, OpenAPI — only if you've shipped integrations
-->

### Methodology
<!-- Examples — replace with your own:
- Agile, Scrum, Sprint Planning
- OKRs, KPIs, North Star Metrics
- Continuous Discovery, Dual-Track Agile (only if you've actually practiced these)
-->

---

## Defensible only when `blueprint_<archetype>.md` is the chosen blueprint

One section per blueprint you maintain. Terms here map to specific bullets
in that blueprint and should NOT be injected when a different blueprint is
chosen (e.g., don't put "Kubernetes" in adtech's section if your data-infra
blueprint is the one with Kubernetes signal).

### Example: `blueprint_adtech.md`
<!-- Examples — replace with terms backed by YOUR adtech bullets:
- Identity Graph, UID2, Bridge ID, HEM
- OpenRTB, RTB, DSP, CTV, ACR
- Incrementality Measurement, Synthetic Control, Holdout Cells
- Athena, Kafka (if your stack)
-->

### Example: `blueprint_data_infra.md`
<!--
- ML Algorithm Design, Feature Engineering, ML Model Lifecycle
- Kafka, Streaming Data, Low-Latency Architecture
- Real-time Processing, QPS Scaling
-->

### Example: `blueprint_regulated_saas.md`
<!--
- GDPR, CCPA, COPPA, SOC 2, HIPAA (only if you've shipped under it)
- Workflow Automation, ERP Integration, API Integrations
- Enterprise B2B SaaS, Compliance Reporting
-->

### Example: `blueprint_strategy_growth.md`
<!--
- M&A Modeling, Business Unit Incubation, P&L Optimization
- Financial Modeling, ROI Modeling, Build-vs-Buy Analysis
- Wholesale Data Licensing, Partnership P&L
-->

### Example: `blueprint_ai_founder.md`
<!--
- Multi-Agent Orchestration, AI Evals & Guardrails, MCP, RAG
- LangChain, Vector DBs (Pinecone/Weaviate) — only if you've actually used them
- Agentic Pipelines, LLM Orchestration
- Specific stacks you ship on (Next.js, Supabase, Vercel, Fly.io)
-->

---

## NEVER inject (factual gaps)

The most important section. List every term that comes up in JDs you target
but represents a real factual gap in your background. The skill refuses to
inject these even when the JD demands them.

Patterns worth thinking through:

### Stacks you don't actually use
- Analytics: list the BI/analytics tools competitors to your stack
  (e.g., if you use PostHog, list Amplitude/Mixpanel/Segment here)
- Vector DBs / ML ops tools you've never touched (LangSmith, Weights & Biases,
  MLflow, Pinecone — list whatever's NOT in your stack)
- Cloud / infra you don't operate (e.g., Azure if you only know AWS;
  Kubernetes if you only use managed PaaS)

### Domains you don't work in
- Mobile native (iOS, Swift, Android, Kotlin, React Native) — list these
  unless you've actually shipped mobile
- Healthcare-specific (HIPAA, EHR, EMR, Clinical Workflows, Medical Coding)
- Banking-specific (Core Banking, ALM, Treasury, Deposit Products, Risk Modeling)
- Security / DevOps (DevSecOps, Penetration Testing, SIEM, SOC operations)
- Hardware engineering (FPGA, embedded systems)
- Deep backend systems engineering you don't have (Java/C++/Rust at depth)

### Methodologies you haven't practiced
- Shape Up, SAFe, LeSS — list any framework you'd be asked about in a JD
  but haven't actually used in production

### Languages you don't speak
- List every language a JD might require that you don't speak

---

## Edge cases / judgment calls

Some terms straddle defensible/fabrication. Default to **don't inject**
unless the JD explicitly demands AND a blueprint bullet directly maps.

Example pattern:

- **"Compliance"** (unqualified) — only inject when a specific regime
  (GDPR/SOC 2/etc.) is already in the blueprint Skills row
- **"Enterprise"** — defensible if you've shipped to enterprise customers;
  not defensible as "Fortune 500 enterprise sales motion" if your enterprise
  exposure was different
- **"Mobile"** — as a CONTEXT word ("Spotify's mobile surfaces") it's fine;
  as a personal skill ("Mobile-native development") it's a fabrication

---

## How PHASE 3 uses this file

1. Extract every critical ATS term from the JD
2. For each term, classify against this whitelist:
   - In **"Always defensible"** OR the section for the chosen blueprint → **INJECT**
   - In **"NEVER inject"** → **REFUSE**, log as unfulfilled gap
   - Not in any section → **REFUSE**, log as unfulfilled gap
3. After the run, the terminal prints:
   - `ATS injected: <list>` — terms that made it in
   - `ATS gaps (in JD, not in whitelist): <list>` — terms the JD demanded
     that the skill refused to inject
4. You review the gaps and decide:
   - (a) accept them as legitimate gaps and submit anyway
   - (b) the JD isn't a fit, skip it
   - (c) the gap was wrong — edit this whitelist out-of-band to add the term

---

## Maintaining this file

- Treat the whitelist as living: when you gain real experience in something
  (e.g., you ship a mobile project), move it from NEVER → Always defensible
  or the relevant blueprint section
- When you notice a recurring gap across many JDs, ask: is this a real gap
  in my background (leave on NEVER) or a wording mismatch (move it to a
  defensible section)
- Pair this file with your blueprints: every term in a per-blueprint section
  should map to a concrete bullet in that blueprint. If you can't find the
  bullet, the term shouldn't be in the whitelist.
