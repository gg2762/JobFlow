# Contributing to JOBFLOW

Thanks for the interest. JOBFLOW is small enough that issues, PRs, and discussions all matter.

## What's in scope

JOBFLOW's MVP is opinionated and tight. Contributions that align with the architecture are easy yes-es:

- Bug fixes in `server.js`, `qa_resume.js`, or the Chrome extension
- New blueprint archetypes (see `blueprints/_schema.md` — open a discussion first if it doesn't fit cleanly)
- Site-specific JD parsers for the Chrome extension (LinkedIn, Greenhouse, Lever, Ashby, Workday)
- Improvements to the dashboard UX (the design language is documented in [README.md](README.md))
- Skill improvements that don't break the seal-on-blueprints rule
- Tests, especially around `qa_resume.js`

What's out of scope for now:

- Replacing the local-first, CSV-backed storage with a hosted DB. That's Phase 2 of the roadmap.
- LLM provider switches (e.g., OpenAI/Gemini variants of the skills). The skills target Claude Code.
- Cosmetic re-skins of the dashboard. The design language is intentional.

## Branch + PR flow

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/short-name`
3. Make focused changes (one concern per PR)
4. Test locally:
   - `curl http://localhost:3737/health` returns `{"ok":true}`
   - Click the Chrome extension on a real JD → row appears in queue.csv
   - `/process-queue` runs through one row end-to-end with a clean QA pass
5. Open a PR with a short description and a one-line "test plan" section

## Code style

- Two-space indentation in JS
- No external dependencies in `server.js` (native Node only)
- `qa_resume.js` can depend on poppler + LibreOffice as shell-outs; no Node libs for PDF parsing
- Keep the dashboard CSS in `server.js` (single-file by design — no build step)
- Keep skills' SKILL.md files small. If a skill's prompt grows past ~300 lines, that's a sign to split it.

## Bug reports

When opening an issue, include:

- macOS version and Node version (`node --version`)
- LibreOffice version (`/Applications/LibreOffice.app/Contents/MacOS/soffice --version`)
- Steps to reproduce
- Relevant lines from `server.log` and `server.err.log`

## Security disclosures

If you find a security issue, please email the maintainer directly rather than opening a public issue. The server binds to `127.0.0.1` only by design — if you find a way to make captured data leak across that boundary, that's a security issue.

## License

By contributing, you agree your contributions are released under [AGPL-3.0](LICENSE).
