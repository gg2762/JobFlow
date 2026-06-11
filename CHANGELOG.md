# Changelog

All notable changes to JOBFLOW are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial open-source release scaffolding.
- 5 archetype scaffolds in `blueprints/`.
- Sample filled-in blueprint (`blueprints/sample/blueprint_strategy_growth_sample.md`) showing a fake consultant-to-strategy-manager career as a worked example.
- `docs/server.md` server operations reference.
- AGPL-3.0 LICENSE.
- `.gitignore` separating committable code from gitignored `user_data/`.

### Changed
- Project renamed `application_wizard/` → `jobflow/`.
- Skills moved from `~/.claude/skills/` to project-scoped `jobflow/.claude/skills/`.
- Server made portable: `ROOT` derived from `__dirname` instead of hardcoded path.
- `queue.csv` and `answer_bank.md` moved to `user_data/` (gitignored).
- Blueprints moved to `user_data/blueprints/` (gitignored).

## [0.1.0] — 2026-06-11

### Added
- Chrome extension (MV3) with server-health check on popup.
- Local Node server on `localhost:3737` with capture, row-update, and `/assets` endpoints.
- Dark dashboard with three KPI cards (Control Tower + Pipeline Status donut + Outcomes donut), sortable/filterable table, expandable rows for application questions.
- 3 Claude Code skills: `resume-builder`, `process-queue`, `answer-questions`.
- `qa_resume.js` PDF QA gate (page count, Skills line-wrap, font, margins) via LibreOffice + poppler.
- LaunchAgent auto-start for the server.
- Outcome state machine: Ready → Submitted → (Pending | Interview | Rejected) with one-click outcome toggling from the dashboard.
- CSV schema migration on server start.
