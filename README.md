# StackPipeline

StackPipeline is a static Astro site for workflow automation, data enrichment and B2B SaaS integration content. It is deployed through the Cloudflare Pages Git integration as project **`stack-pipeline`**.

**Current public origin:** `https://stack-pipeline.pages.dev`
**Production branch:** `main`
**Build command:** `npm run build`
**Output directory:** `dist`

## Commands

```bash
npm install
npm run dev       # local Astro server
npm run check     # Astro + TypeScript diagnostics
npm run build     # production build, then scripts/audit-build.mjs
npm run preview   # preview dist/
npm run audit     # rerun the post-build audit
```

```bash
# Scaffold integration pages as drafts only
npm run generate:integrations -- --pairs zapier:hubspot,make:salesforce
```

Generated integration pages deliberately use `draft: true`. Add real source material, hands-on detail, limitations and editorial review before publishing one. Do not bulk-publish generated scaffolds.

```bash
# Outsourced-review production pipeline (see docs/review-production/WORKFLOW.md)
npm run review:intake -- --file path/to/intake.json   # validate + generate a draft review
npm run review:validate                                 # validate every committed review
npm test                                                # unit tests for the pipeline itself
```

`review:intake` never publishes anything: it always writes `draft: true` and
`provenance.editorialApprovalStatus: pending`, and refuses to run at all when the intake file is
incomplete, contradictory, references an unknown tool, or claims evidence that does not exist on
disk. A human editor must complete `docs/review-production/editor-approval-checklist.md` before a
generated review is published. See `docs/review-production/WORKFLOW.md` for the full process.

## Architecture

- **Astro 7 SSG** with **Tailwind 4**
- `src/content/` — MDX/JSON content collections
- `src/config/site.ts` — verified site, navigation and optional monetization configuration
- `src/lib/schema.ts` — connected JSON-LD builders
- `src/layouts/ArticleLayout.astro` — responsive editorial layout with a desktop sticky TOC/rail
- `scripts/audit-build.mjs` — deployment gate for SEO, accessibility, schema and advertising markup
- `scripts/review-intake.mjs` / `scripts/review-validate.mjs` — outsourced hands-on-review intake and validation pipeline; see `docs/review-production/WORKFLOW.md`
- `docs/review-production/` — intake schema reference, testing brief template, evidence sanitization process, editor approval checklist, and a documented (not implemented) proposal for future automated product discovery

All editorial content currently uses the **StackPipeline Editorial Team** organization byline. No fictional people, credentials, `sameAs` profiles or Person JSON-LD are published. Individual contributors can be introduced later only with real, verifiable details they approve.

## Content model

The schemas in `src/content.config.ts` validate frontmatter at build time. Shared editorial fields include:

| Field | Notes |
| --- | --- |
| `title` | 10–44 chars, leaving room for the `| StackPipeline` title suffix. |
| `description` | 50–155 chars. |
| `heading` | Optional longer on-page `<h1>`. |
| `publishDate` / `updatedDate` / `lastReviewedDate` | Page freshness metadata. |
| `draft` | Draft entries are excluded from generated routes and indexes. |
| `tags` | Used for archive pages only after the thin-content threshold. |
| `affiliateLinkA` / `affiliateLinkB` | Optional tracked-link metadata. |

Collection-specific fields define tools, HowTo steps, review ratings, comparison contenders and pricing data.

### Reviews: evidence-gated structured data

A review only emits `Review`/`AggregateRating` JSON-LD, an "Editor's Choice" badge, or a "How we
tested" section when its frontmatter carries a `testing` block (dates, hours, plan, methodology).
Documentation-based assessments without hands-on testing (e.g. `n8n-review.mdx`) still publish as
ordinary articles with a verdict and pros/cons, but never claim structured-data review markup they
cannot back up — see `src/pages/reviews/[...slug].astro`.

Two additional, fully optional frontmatter fields support outsourced hands-on testing without
breaking any review written before they existed:

- **`attribution`** — `{ mode: 'named' | 'anonymous', authorized, displayName?, role?, relevantExperience? }`. Renders one of two sentences on the page: a named-and-authorized contributor credit, or a generic "independent contractor following the StackPipeline testing protocol" line. Never emits a fabricated `Person` schema node — organization attribution (`StackPipeline Editorial Team`) remains the publisher throughout.
- **`provenance`** — sourcing/compliance metadata written by `scripts/review-intake.mjs`: official source URLs, dated pricing sources, sanitized evidence references, conflicts of interest, affiliate-relationship disclosure, and the editorial approval gate (`editorialApprovalStatus`, `certifiedAccurate`).

See `docs/review-production/WORKFLOW.md` for how these fields get populated end to end.

## Advertising and publisher readiness

The public site currently has **no configured AdSense publisher ID**. `ads.txt` intentionally contains no seller record until a valid `PUBLIC_ADSENSE_CLIENT` value is supplied at build time. Ad markup is also suppressed when that value is absent.

Before applying to AdSense, establish and publish:

1. a real legal entity and responsible jurisdiction;
2. a verified mailing/contact channel and usable privacy-request process;
3. only real public social profiles, if any;
4. a genuine AdSense publisher ID and relevant ad-unit slot IDs;
5. substantially more genuinely useful, reviewed content.

When those details exist, update `src/config/site.ts`, the legal/contact pages, and the relevant Cloudflare Pages environment variables together. Do not use placeholders.

Optional environment variables:

| Variable | Purpose |
| --- | --- |
| `PUBLIC_ADSENSE_CLIENT` | Valid `ca-pub-…` publisher ID; only then does a Google seller line render in `ads.txt`. |
| `PUBLIC_ADSENSE_SLOT_*` | Manual AdSense slot IDs. |
| `PUBLIC_GA4_ID` | GA4 measurement ID. |
| `PUBLIC_PLAUSIBLE_DOMAIN` | Plausible domain. |

## Build gate

`npm run build` chains Astro's build to `scripts/audit-build.mjs`. It fails on errors including missing or oversized metadata, missing/relative canonical URLs, invalid heading structure, missing image dimensions/alt text, malformed JSON-LD, affiliate links without `rel="sponsored"`, malformed AdSense units, duplicate title/canonical values, and missing compliance routes.

Run both commands before merging:

```bash
npm run check
npm run build
```

## Cloudflare Pages

Cloudflare Pages deploys `main` through its Git integration. The production configuration is:

| Setting | Value |
| --- | --- |
| Project | `stack-pipeline` |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output | `dist` |

The repository's current canonical origin is the Pages URL. Update `SITE.url`, `SITE.domain`, `astro.config.mjs`, and redirects only after a custom domain is live and verified.
