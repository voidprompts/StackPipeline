# Review production workflow

This document explains the full path from "we want a review of Tool X" to a merged,
evidence-backed review on StackPipeline. It is the entry point for the rest of
`docs/review-production/` — read this first, then follow the links for each step's detail.

## Principles this system enforces

- **No invented hands-on experience.** Every hands-on claim traces to a contractor's dated,
  logged testing session. Documentation-based assessments (like the existing `n8n-review.mdx`,
  written from vendor docs with no hands-on testing) are allowed, but they never claim testing
  they didn't do, and the page mechanically cannot emit a Review/AggregateRating schema node, an
  "Editor's Choice" badge, or a "How we tested" section unless a `testing` block exists.
- **No mass-published AI summaries.** This pipeline generates exactly one draft per intake file,
  always `draft: true`, and requires a human editorial pass (see the
  [approval checklist](./editor-approval-checklist.md)) before publication. There is no batch
  mode, no scheduled job, and no code path that flips `draft: false` automatically.
- **Ratings require evidence.** `scripts/lib/testing-protocol.mjs`'s `computeWeightedScore`
  refuses to compute a number unless every canonical criterion has a numeric score AND a
  substantive evidence note. There is no fallback that silently produces a score from partial
  data.
- **Nothing merges without a human.** The intake CLI writes a file to disk; it does not commit,
  push, or open a PR. The optional GitHub Actions workflow (see below) can open a PR for you, but
  it never sets it to auto-merge.

## The five stages

### 1. Scope the engagement

Copy `docs/review-production/contractor-testing-brief-template.md`, fill it in with the
contractor (tool, plan, dates, workflows, methodology, disclosures), and confirm the tool already
exists in `src/content/tools/tools.json` — if not, see
[`adding-a-new-tool.md`](./adding-a-new-tool.md) first.

### 2. Contractor tests and submits an intake file

The contractor tests hands-on, logs everything as they go (not from memory afterward), captures
raw evidence into a local `private-evidence/<tool-id>/<date>/` folder, and fills out an intake
JSON matching `scripts/lib/intake-schema.mjs`. Use
`docs/review-production/example-intake.sample.json` as the field-by-field template — every value
in that file is fictional and must be replaced with real data.

Before evidence can be referenced, it goes through
[sanitization](./evidence-sanitization.md): private raw assets are cropped/redacted and the
sanitized output is saved to `public-evidence/<tool-id>/<date>/`.

### 3. Generate the draft

```bash
npm run review:intake -- --file path/to/intake.json
```

This:

- Validates the intake file against the schema (rejects incomplete/contradictory submissions
  with a specific list of problems, writing nothing on failure).
- Verifies the referenced tool exists.
- Verifies every referenced evidence file actually exists under `public-evidence/`.
- Computes the weighted rating from the scorecard — or refuses, with a specific list of missing
  criteria/evidence, if the scorecard is incomplete.
- Writes `src/content/reviews/<tool-slug>-review.mdx` with `draft: true` and
  `provenance.editorialApprovalStatus: pending`.
- Refuses to overwrite an existing review file unless `--force` is passed.

Nothing produced here is fabricated prose: the generated body is built by directly listing the
intake's own findings, methodology and sources, not by inventing connective language to fill
gaps.

### 4. Validate

```bash
npm run review:validate
```

Re-checks every file actually committed under `src/content/reviews/` — including this one — for
internal consistency, evidence completeness, disclosure and (for published files) editorial
approval. This is intentionally decoupled from step 3: a hand-edited MDX file gets re-checked
just as strictly as a freshly generated one.

### 5. Editorial approval and PR

A human editor works through the [approval checklist](./editor-approval-checklist.md) against
the generated file, the original intake JSON, and the sanitized evidence. Only after every item
is checked does the editor:

1. Set `provenance.editorialApprovalStatus: approved`.
2. Remove `draft: true`.
3. Re-run `npm run review:validate` and `npm run build`.
4. Open a pull request to `main` (or push to one already open by the optional GitHub Actions
   workflow — see below) for a second person to merge.

No step in this pipeline merges a PR automatically.

## Optional: GitHub Actions integration

`.github/workflows/review-intake.yml` is a **manual** (`workflow_dispatch`) workflow that:

- Accepts a path to an intake JSON already committed to the branch (or provided as a workflow
  input pointing at a file to check out).
- Runs `npm run review:intake` and `npm run review:validate`.
- Uploads the generated draft as a workflow artifact and, when run on a branch, opens a **draft**
  pull request containing the generated file.
- Never sets the PR to auto-merge and never requires a secret to run the validation half — the
  PR-creation step only needs the default `GITHUB_TOKEN`, which every Actions run already has.

See the workflow file for exact inputs; it exists to make the "generate + validate" half of this
process CI-visible for teams that want a reviewable diff before anyone touches their local
checkout, not to replace the human approval step.

## Future: automated product discovery (proposed, not built)

See [`future-product-discovery.md`](./future-product-discovery.md) for a documented proposal
covering how StackPipeline could later discover *candidate* tools to review — through approved
APIs, RSS feeds and official vendor pages, with domain-based deduplication and mandatory human
approval before any tool or review is added. That proposal is explicitly **not implemented** in
this phase; nothing in this repository scrapes the web or bulk-publishes anything.
