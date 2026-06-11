# Blueprint schema

Every blueprint is a Markdown file with the structure below. The schema is parsed loosely (`server.js` and the manifest pattern are lenient about whitespace), but stick close to it — the `qa_resume.js` PDF gate depends on the rendered structure fitting one page.

## File structure (in order)

```markdown
# YOUR NAME
your_email@example.com | linkedin.com/in/your-handle | City, Country

## SUMMARY
One to two sentences. ~30–45 words. Names what kind of operator you are
and what you're currently doing. No first-person pronouns. Never lists past
employers by name (those appear in the role list below).

## RELEVANT WORK EXPERIENCE

### Most Recent Company — Location
**Title** | Month YYYY – Month YYYY
- Bullet 1 — verb + context + outcome. ≤30 words. Includes a real metric when one exists.
- Bullet 2
- Bullet 3 (optional, when the role warrants it)

### Second Most Recent Company — Location
**Title** | Month YYYY – Month YYYY
- Bullet
- Bullet

(...continue chronologically backward...)

## FEATURED PROJECT

**ProjectName.io** | YYYY – Present
*One-italic-line product description, ≤14 words.*
- Bullet that demonstrates a distinct angle (e.g., technical depth)
- Bullet that demonstrates a different angle (e.g., commercial outcome)

## SKILLS

- **Product:** Comma-separated, ≤7 items, ≤120 chars total — must stay on ONE visual line in the rendered PDF
- **Technical:** Same constraints
- **Languages:** English (Fluent), Italian (Native), ... — locked format

## EDUCATION

**University Name** — City, Country | Degree

**Second University** — City, Country | Degree
```

## Hard rules

- **Bullets ≤30 words.** Counted by the QA gate during render. Over-cap → page overflow risk.
- **Skills rows ≤120 characters each.** Counted by the QA gate. Over-cap → row wraps to two lines → ugly.
- **Total body ≤500 words** (soft target). Counted by the manifest. Warning if over; the page-count QA gate is the hard fail.
- **Always one page** in the rendered PDF. The QA gate enforces this; render failures are surfaced as `Failed` status, not silently shipped.
- **No invented facts.** Numbers, titles, dates, technologies all trace to verifiable career history.
- **Roles in reverse-chronological order.** Most recent role first.
- **Featured Project is at the end of Work Experience, before Skills.** It's where a personal project / side build goes that demonstrates a distinct angle from your day job.

## Soft conventions

- **Em dashes (—) count as a word.** Prefer semicolons or commas inside bullets to save the word budget.
- **Numbers as numerals.** `$3M`, `32%`, `50K QPS`, not "three million", "thirty-two percent".
- **No first-person pronouns** in bullets or summary. Implied subject is you.
- **No banned phrases.** `spearheaded`, `leveraged synergies`, `thought leader`, `passionate about`, `results-driven`, `dynamic`, `guru`, `ninja`, `rockstar`.
- **No vague quantifiers** as substitutes for metrics. `significantly`, `dramatically`, `substantially`, `markedly`, `considerably` are all signs of a missing number. A clean bullet with no metric is always better than a hedged bullet with a fake one.

## Rendering details (you don't need to know these, the renderer does)

For the curious: blueprints render to `.docx` with Times New Roman, half-point sizes 44/22/20/18 (name/section labels/body/contact), US Letter page size, margins 720/900/720/900 DXA, right-tab stops at position 10440, bottom borders on section labels. See `qa_resume.js` for the canonical formatting rules and `server.js` for how a manifest assembles the actual Word document.
