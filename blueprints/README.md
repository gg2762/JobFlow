# blueprints/

The blueprint system is JOBFLOW's central idea. Read [`_schema.md`](_schema.md) first.

## What's in this directory

| File | Purpose |
|---|---|
| `_schema.md` | The canonical blueprint structure. Every blueprint follows this contract. |
| `_archetype_adtech.md` | Scaffold for AdTech / programmatic / CTV / measurement roles. |
| `_archetype_data_infra.md` | Scaffold for technical PM / data infra / MLOps / platform roles. |
| `_archetype_strategy_growth.md` | Scaffold for strategy / corp dev / growth / consulting / chief-of-staff roles. |
| `_archetype_regulated_saas.md` | Scaffold for compliance / IAM / healthcare / fintech / governance roles. |
| `_archetype_ai_founder.md` | Scaffold for AI PM / GenAI PM / EIR / founding-PM roles. |
| `sample/blueprint_strategy_growth_sample.md` | A worked example using a fake consultant-to-strategy-manager career, so you can see what a filled-in blueprint actually looks like. |

## Workflow

1. Pick the 2–4 archetypes that fit roles you'd apply to. (Most candidates won't need all 5.)
2. Copy each scaffold into `user_data/blueprints/`:
   ```bash
   cp blueprints/_archetype_strategy_growth.md user_data/blueprints/blueprint_strategy_growth.md
   ```
3. Fill in your real career data in the user_data/ copy. **Never edit the archetype scaffolds directly** — those are the template ship.
4. Run a sanity render (manually with `node scripts/render_sample.js`, *coming soon*, or generate a real resume with `/process-queue`) to confirm the structure renders cleanly to one page.

## Sealed-blueprint rule

The execution skills (`/process-queue`, `/answer-questions`) **never rewrite blueprint bullets at run time**. The only per-JD customization allowed is surgical ATS keyword swaps in the Skills row.

This is the central architectural choice. It exists because LLM-generated bullets are unreliable, while curated bullets stay sharp. Each blueprint represents one polished version of you for one archetype of role; the skills just pick the right one and tune ATS keywords.

When you discover a recurring gap — e.g., "this blueprint should mention X across the last three roles I applied to" — refine it out-of-band (in a Claude Code session dedicated to blueprint editing, not during a `/process-queue` run).
