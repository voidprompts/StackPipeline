# Daily content pipeline

`.github/workflows/daily-content.yml` publishes up to **3 posts per day**, targeted
at tier-1 English-speaking markets, from a human-curated queue.

## How a post reaches production

```
data/content-queue.json          (HUMAN: approves topics by adding rows, sets priority)
        │
        ▼  02:41 UTC daily
scripts/daily-content.mjs        (takes top 3 pending items)
        │
        ▼
scripts/generate-integrations.mjs --publish
        │                        (tool-data-driven MDX: pricing, free tiers,
        │                         connector counts, APIs — all from tools.json)
        ▼
full validation (tests + review:validate + build/audit)  → PR opened, born green
        │
        ▼  next auto-merge sweep (every 6 h)
auto-merge gate re-validates at the PR head → squash-merge → Cloudflare deploys
        │
        ▼
production smoke test (sitemap, routes, robots meta)
```

## Tier-1 targeting — what it means here

The queue metadata pins the strategy: `targetGeo: US, GB, CA, AU, NZ`,
`language: en`, `currency: USD`.

- **Topic selection**: queue priority ordering favours tools and pairings with
  tier-1 search demand and affiliate programs (CRM and marketing automation first).
- **Content**: English, vendors' published USD pricing, tier-1 business context.
- **What it does NOT mean**: no hreflang tricks, no country-doorway pages, no
  auto-translated variants. A single-locale site targets geography through
  language, currency and topics. (Optional manual step: set the target country
  in Google Search Console if/when a custom domain is added.)

## Guardrails

- **Humans own the queue.** Automation never invents topics; an empty queue means
  an idle pipeline, and a refill issue is opened when fewer than 7 topics remain.
- **3/day cap** (`dailyLimit` in the queue file) — change it there, not in code.
- **Every post is data-grounded**: pricing, free tiers, integration counts and API
  availability come from `tools.json`; the generator makes no claims beyond them.
- **Three independent validations** before production: the pipeline's own build,
  the auto-merge gate + audit at the PR head, and the post-merge smoke test.
- **Kill switches**: disable the workflow in the Actions tab; label a specific PR
  `no-automerge` to hold it for manual review; set a queue item's status to
  anything other than `pending` to skip it.

## Scaled-content risk — read this before raising the cap

Google's scaled-content-abuse policy targets mass-produced pages that add no
value. This pipeline mitigates but does not eliminate that risk: posts share a
structural template, differentiated by real per-pair data. Keep the volume
modest, watch Search Console for impressions/indexing anomalies, and prefer
enriching existing posts (real screenshots, tested numbers) over raising
`dailyLimit`. If coverage stalls or pages get classified "Crawled — currently
not indexed" at scale, pause the pipeline and add differentiation before
resuming.
