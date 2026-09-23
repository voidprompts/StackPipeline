# Editor approval checklist

A generated draft from `npm run review:intake` is **not publishable as-is**. It carries
`draft: true` and `provenance.editorialApprovalStatus: pending` for exactly this reason: a human
editor must verify it before it becomes a live page. `npm run review:validate` enforces the
mechanical half of this list; the rest requires judgment only a person can apply.

Work through this checklist against the generated MDX file and the contractor's original intake
JSON + evidence side by side.

## 1. Source verification

- [ ] Every URL in `provenance.officialSourceUrls` actually loads and supports the claims made
      about it.
- [ ] Every `provenance.pricingSources` entry's `sourceUrl` is the vendor's own pricing page (or
      another primary source) — not a third-party aggregator — and the `checkedDate` is
      plausible (not backdated, not in the future).
- [ ] Every pricing figure quoted in the rendered review body matches what the cited source
      actually says today. Vendor pricing changes; re-check, don't trust the intake file blindly.

## 2. Testing evidence

- [ ] `testing.periodStart`/`periodEnd`/`hoursTested` are internally consistent and plausible for
      the claimed workflows.
- [ ] `testing.workflowsTested` are specific enough that a reader could understand exactly what
      was built and run — reject anything generic ("used the product for a while").
- [ ] `testing.methodology` actually describes a method, not just a restatement of what was
      tested.
- [ ] Every item in "quantitative findings," "advantages," "limitations," "errors and reliability
      issues," and "support interactions" reads like an observation, not vendor marketing
      language or a generic statement that could apply to any competitor.

## 3. Evidence assets

- [ ] Every file referenced in `provenance.evidenceRefs` exists under `public-evidence/` (the
      validator checks this mechanically, but open each file and confirm it actually shows what
      its `description` claims).
- [ ] No asset under `public-evidence/` contains an unredacted account identifier, customer
      record, credential, or other private information. See
      `docs/review-production/evidence-sanitization.md`.
- [ ] Nothing under `private-evidence/` has been added to git (`git status` should show it is
      untracked/ignored, never staged).

## 4. Attribution

- [ ] If `attribution.mode` is `"named"`, confirm the tester's authorization was given in
      writing (email, signed brief, etc.) and is on file outside the repository — the repo
      itself should not store the authorization record, only the resulting boolean.
- [ ] If `attribution.mode` is `"anonymous"`, confirm `displayName` is absent from the
      frontmatter and the tester's real name does not appear anywhere in the rendered page body.
- [ ] The rendered attribution sentence on the page matches exactly one of the two approved
      forms (see `src/pages/reviews/[...slug].astro`) — never a fabricated Person schema, bio,
      or social profile.

## 5. Rating integrity

- [ ] `rating.breakdown` weights sum to 1.0 (validator enforces this).
- [ ] Every breakdown `note` is specific evidence, not a generic restatement of the criterion
      name.
- [ ] The `rating.value` matches what the weighted formula in
      `scripts/lib/testing-protocol.mjs` produces for the given breakdown — spot-check the
      arithmetic if the file was hand-edited after generation.

## 6. Disclosures

- [ ] `provenance.conflictsOfInterest` is populated and, if non-trivial, is reflected somewhere
      in the visible page copy, not just hidden in frontmatter.
- [ ] `provenance.affiliateRelationship.disclosed` is `true` whenever the reviewed tool has an
      `affiliateUrl` in `tools.json`, and the rendered page actually shows the disclosure
      (the site-wide `DISCLOSURE` banner in `ArticleLayout.astro` covers this automatically —
      confirm it renders on the built page).

## 7. Backward compatibility and schema

- [ ] `npm run check` passes.
- [ ] `npm run review:validate` passes with zero errors.
- [ ] `npm run build` passes, including the post-build audit.
- [ ] No existing review, tool, or page was modified except as required for this review.

## 8. Publish

Only after every item above is checked:

1. Set `provenance.editorialApprovalStatus: approved`.
2. Set `provenance.certifiedAccurate` to match the tester's certification (should already be
   `true` from intake; re-verify it wasn't silently flipped).
3. Remove `draft: true` (or set it to `false`).
4. Re-run `npm run review:validate` and `npm run build` one more time after these edits.
5. Open (or update) the pull request for a second human — the person approving should not be the
   only reviewer who ever looked at the file — to merge into `main`.

Nothing in this repository auto-merges a review. A human must complete this checklist and a human
must click merge.
