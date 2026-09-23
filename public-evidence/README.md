# Public evidence

This directory holds **sanitized** evidence assets (screenshots, exported chart images, short
clips) that a published review references via `provenance.evidenceRefs[].publicPath`. Everything
here is safe to commit and safe to publish.

## What belongs here

- Screenshots with any account identifiers, emails, customer data, API keys, tokens or billing
  details cropped, blurred or replaced with placeholder values.
- Charts/exports rebuilt from raw data with no real customer records visible.
- Anything the contractor and the editor have both confirmed contains no private information.

## What must never be committed here

- Raw, unedited screenshots straight from a testing session.
- Anything containing a real customer name, email, phone number, or account ID.
- Credentials, API keys, session tokens, or billing/invoice details.
- Full CRM/database exports, even sanitized ones with more than a handful of illustrative rows.

Raw evidence lives in `private-evidence/` (git-ignored, local only — see `.gitignore`) until it
has been through the sanitization process documented in
[`docs/review-production/evidence-sanitization.md`](../docs/review-production/evidence-sanitization.md).

## Layout convention

```
public-evidence/
  <tool-id>/
    <YYYY-MM-DD>/
      <descriptive-name>.png
```

Example: `public-evidence/n8n/2026-09-23/workflow-editor-branching.png`

`scripts/review-intake.mjs` and `scripts/review-validate.mjs` both check that every
`publicPath` referenced by a review's frontmatter actually exists under this directory before
they will generate or pass a review — a review can never claim evidence that isn't here.
