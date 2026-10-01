# Auto-merge policy

`.github/workflows/auto-merge.yml` merges content PRs without a human **only when
every mechanical gate passes**. This document is the policy of record for what
automation may and may not publish.

## The principle

Automation merges what machines can verify. Humans approve what requires judgment.

A PR is auto-merged only if **both** layers pass:

1. **Eligibility** (`scripts/automerge-gate.mjs`) — the diff is confined to:
   - `src/content/tools/tools.json` (with the restrictions below)
   - `src/content/guides/**`, `src/content/integrations/**`, `src/content/alternatives/**`
   - `data/tool-candidates.json`, `data/tool-sources.json`
   - `data/content-queue.json` (the daily pipeline's publication queue — adding a
     topic to the queue is itself the human editorial approval for that topic)
2. **Audit** — at the exact head commit: `npm test`, `npm run review:validate`, and
   `npm run build` with its post-build audit (SEO, accessibility, ad-compliance,
   sitemap/indexability integrity).

After a merge, the workflow runs `scripts/smoke-production.mjs` against the live
site, because a `GITHUB_TOKEN` merge does not trigger the push-event workflows.

## Never auto-merged

| Change | Why a human must approve it |
| --- | --- |
| `src/content/reviews/**` | E-E-A-T sign-off is an editorial act. The build audit is mechanical; it cannot certify experience, expertise or accuracy of claims. |
| Any change to a tool's `indexable` flag | SEO-consequential: it adds/removes sitemap URLs and flips robots meta. Promotion requires a sourced review in the same PR. |
| Deleting or renaming a tool or post | Removes live URLs; needs redirect and sitemap consideration. |
| Code, config, workflows, scripts, layouts, pages, dependencies | Engineering review. This includes the gate itself — automation must not be able to widen its own permissions. |
| Draft PRs | The tool-discovery workflow's draft PRs are an editorial inbox by design. Marking one ready-for-review is the human approval step. |
| PRs labeled `no-automerge` | Explicit opt-out. |
| Fork PRs | Untrusted head. |

## Content thresholds

Eligible blog posts must additionally clear, at gate time:

- no placeholder markers (`TODO`, `FIXME`, `TKTK`, `XXX`, `lorem ipsum`)
- a raw-MDX body of at least 200 words — a truncation guard, not a quality bar

## Changing this policy

Edits to `scripts/automerge-gate.mjs`, its tests, or the workflow are themselves
outside the allowlist, so every change to the policy requires a human-approved PR.
