# Proposal: automated product discovery (future phase, not implemented)

This document is a proposal only. Nothing described here is built in this phase, and this phase
deliberately does not implement uncontrolled web scraping or automatic bulk publication of any
kind. It exists so a future phase has a reviewed starting point rather than reinventing the
constraints from scratch.

## Problem

Right now, someone has to manually notice that a new B2B SaaS tool exists and decide it's worth
reviewing. At StackPipeline's current scale that's fine; it will not scale to hundreds of
candidate tools without some sourcing automation. The goal is to automate **discovery of
candidates**, never automate **publication**.

## Proposed sources (all first-party / consented, no scraping)

1. **Vendor-published RSS/Atom feeds** — many SaaS vendors publish a changelog or blog feed.
   Subscribing to a known, curated list of feeds (not crawling the open web) surfaces "this
   vendor launched a new tier / integration" signals without touching pages that don't want to
   be machine-read.
2. **Official/partner APIs** — where a category has a legitimate public API for its own listings
   (e.g. a package registry, marketplace API, or G2/Capterra partner API under their terms), use
   that instead of scraping their HTML. Each integration would need its own terms-of-service
   review before being added to this list — it is not a blanket allowance.
3. **Official vendor pricing/integration pages, fetched on demand** — the existing manual
   research workflow (as used for the n8n review in this repository) already does this: fetch a
   specific, named URL, read it, cite it with a checked date. This proposal is about scaling the
   *triage* of which vendor to look at next, not replacing the human fetch-and-read step for
   individual facts.
4. **Human submissions** — a simple internal form/issue template where a team member nominates a
   candidate tool with a reason. Cheapest to build, and keeps a person accountable for every
   suggestion from day one.

## Explicitly out of scope for any future phase without a separate design review

- Crawling arbitrary websites, following links, or scraping pages that have not been
  individually approved as a source.
- Circumventing `robots.txt`, paywalls, or rate limits.
- Any pipeline stage that writes directly to `src/content/tools/tools.json` or
  `src/content/reviews/` without a human merging a PR.
- Treating a discovered candidate's own marketing copy as a citable fact — discovery only
  produces "this exists, consider it," never any of the individual claims that would go into a
  tool record or review.

## Proposed dedup strategy

- **Canonical key: registrable domain**, extracted from `website` (e.g. `n8n.io`), not tool name
  — vendor names change, rebrand, or collide (there is more than one product called "Flow").
- Before a candidate is surfaced, check it against:
  - Existing `src/content/tools/tools.json` entries (`website` domain).
  - A rolling "already considered and rejected" list, so a rejected candidate doesn't resurface
    every cycle without a reason to revisit it.
- Any discovery job outputs a **report**, not a commit: a list of candidate domains with source,
  first-seen date, and a one-line reason. A human decides what happens next.

## Proposed approval gate

Every candidate would still go through, unmodified:

1. [`adding-a-new-tool.md`](./adding-a-new-tool.md) — a human adds the tool record with sourced
   facts, or doesn't.
2. The existing review-production pipeline in this document — nothing about discovery changes
   how a review itself gets produced, validated or approved.

## Why this is a proposal and not code

Web scraping and bulk publication are exactly the failure modes this task explicitly asked not
to build. A discovery mechanism is useful, but its main risk (accidentally becoming a scraper, or
accidentally lowering the bar for what counts as "considered") deserves its own design review with
real vendor ToS research per source, not a first draft bundled into the review-production system
itself.
