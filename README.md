# StackPipeline

Production-ready static site for **stackpipeline.com** — workflow automation, data
enrichment and B2B SaaS integration content, built for AdSense eligibility, Core Web
Vitals and programmatic SEO scale.

Built with **Astro 7** + **Tailwind CSS 4**, deployed to **Cloudflare Pages** via GitHub
Actions.

---

## Quick start

```bash
npm install
cp .env.example .env     # optional — everything works unset
npm run dev              # http://localhost:4321
```

```bash
npm run build            # builds to dist/ and runs the compliance audit
npm run preview          # serve the production build locally
```

---

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build + automatic post-build audit |
| `npm run preview` | Serve `dist/` locally |
| `npm run check` | Astro/TypeScript diagnostics |
| `npm run audit` | Re-run the SEO & compliance audit against `dist/` |
| `npm run generate:integrations` | Scaffold programmatic integration pages |
| `npm run editorial:review` | Report content past its review cadence |

---

## Architecture

```
src/
├── config/site.ts           Brand, legal, ad and nav constants — single source of truth
├── content.config.ts        Zod schemas for every collection (the automation data model)
├── content/
│   ├── integrations/        "How to connect A to B" — HowTo schema
│   ├── reviews/             Software reviews — Product + Review schema
│   ├── alternatives/        Ranked comparisons — ItemList schema
│   ├── guides/              Long-form explainers — Article schema
│   ├── tools/tools.json     Normalised vendor directory
│   └── authors/authors.json E-E-A-T author entities
├── layouts/
│   ├── BaseLayout.astro     HTML shell, global schema graph, ad loader
│   ├── ArticleLayout.astro  3-column editorial shell (TOC · article · affiliate rail)
│   ├── ListingLayout.astro  Hub/index pages
│   └── PageLayout.astro     Legal and static pages
├── components/
│   ├── seo/SEO.astro        Title/description/canonical/OG/Twitter/JSON-LD matrix
│   ├── ads/                 AdSenseHead + AdSlot (zero-CLS reserved space)
│   ├── eeat/                AuthorBio, ArticleMeta (byline, dates, fact-check badge)
│   └── ui/                  Callout, ComparisonTable, TOC, ProsCons, AffiliateButton …
├── lib/
│   ├── seo.ts               Title/description clamping, URLs, dates, breadcrumbs
│   ├── schema.ts            JSON-LD builders (single connected @graph)
│   └── taxonomy.ts          Tag index with a thin-content threshold
└── pages/                   File-based routes, incl. ads.txt / robots.txt / rss.xml
```

---

## The content model

Everything is typed in `src/content.config.ts`. Adding a page means adding an MDX file
whose frontmatter satisfies the schema — an invalid field fails the build rather than
shipping a broken page.

Core fields (shared by all editorial collections):

| Field | Notes |
| --- | --- |
| `title` | **Max 44 chars.** ` \| StackPipeline` (16) is appended → exactly 60. |
| `description` | 50–155 chars, enforced. |
| `heading` | Optional longer `<h1>` when the SEO title must stay short. |
| `softwareA` / `softwareB` | References into `tools.json`. |
| `affiliateLinkA` / `affiliateLinkB` | `{ url, label, campaign }`. |
| `author` / `reviewedBy` | References into `authors.json`. |
| `publishDate` / `updatedDate` / `lastReviewedDate` | Drive freshness signals and the review loop. |
| `schemaType` | `HowTo` \| `Review` \| `ItemList` \| `Article`. |

### Generating pages programmatically

```bash
# Specific pairs
npm run generate:integrations -- --pairs zapier:hubspot,make:salesforce

# Cross-join a matrix
npm run generate:integrations -- --matrix zapier,make,n8n --targets hubspot,salesforce,pipedrive

# Every automation platform × every tool, capped
npm run generate:integrations -- --all --limit 50 --dry-run
```

Generated files are written with **`draft: true`** and are excluded from the build until
an author reviews them. This is intentional: publishing hundreds of untouched template
pages is precisely what Google's scaled-content-abuse policy targets. Generate the
scaffold, add real testing detail, then flip the flag.

---

## AdSense compliance

| Requirement | Where it lives |
| --- | --- |
| Privacy Policy | `/privacy-policy/` — third-party vendors, DART cookie, opt-outs, GDPR/CCPA |
| Terms of Service | `/terms-of-service/` |
| Affiliate Disclosure | `/affiliate-disclosure/` — FTC 16 CFR Part 255 |
| Cookie Policy | `/cookie-policy/` — itemised cookie table |
| `ads.txt` | Generated at `/ads.txt` from `ADS.sellers` in site config |
| Auto Ads | `components/ads/AdSenseHead.astro` (head-injected, consent-aware) |
| Manual units | `components/ads/AdSlot.astro` — real `<ins class="adsbygoogle">` |
| Contact info | `/contact/` + footer postal address |
| E-E-A-T | Author bios, credentials, fact-check badges, `/how-we-test/`, `/editorial-policy/` |

**Ad slots reserve their height before the ad loads**, so inserting an ad never shifts
layout — CLS stays at 0 whether or not AdSense is configured. With
`PUBLIC_ADSENSE_CLIENT` unset, slots render as neutral placeholders of identical height
rather than empty `<ins>` tags (which would be a policy violation).

---

## SEO

- **Titles** mechanically clamped to 60 chars, **descriptions** to 155 — enforced by the
  content schema *and* re-checked in the post-build audit.
- **One connected JSON-LD `@graph`** per page using `@id` references
  (`Article → author → Organization → WebSite`) instead of disconnected blocks.
- **Schema coverage:** `WebSite`, `Organization`, `BreadcrumbList` globally; `HowTo` on
  integrations; `Product` + `Review` (with `positiveNotes`/`negativeNotes`) on reviews;
  `ItemList` on comparisons and hubs; `FAQPage` where FAQs exist; `Person` for authors.
- **Sitemap** with depth-aware priority and changefreq (`astro.config.mjs` → `grade()`):
  home `1.0`, section hubs `0.9`, leaf content `0.8`, taxonomy `0.5`, legal `0.3`.
- **Strict heading hierarchy** — exactly one `<h1>`, first in DOM order, no skipped levels.
- **Images** always carry explicit `width`/`height`, are lazy by default, and only the
  flagged LCP element gets `fetchpriority="high"`.

### The build audit

`npm run build` automatically runs `scripts/audit-build.mjs` against the emitted HTML and
**fails the build** on: missing/oversized titles or descriptions, missing or relative
canonicals, multiple or out-of-order `<h1>`s, skipped heading levels, images without
dimensions or `alt`, invalid JSON-LD, affiliate links missing `rel="sponsored"`,
`<ins>` blocks missing client/slot IDs, duplicate titles or canonicals, and any missing
compliance route.

This is what makes programmatic scale safe — a bad generation run is caught in CI rather
than in Search Console three weeks later.

---

## Editorial review loop

The published cadence (90d reviews · 180d integrations · 365d guides) is enforced in code:

```bash
npm run editorial:review                                   # what is overdue
node scripts/editorial-review.mjs --stamp <file>           # mark reviewed today
node scripts/editorial-review.mjs --ci                     # exit 1 if overdue
```

`.github/workflows/editorial-review.yml` runs this weekly and opens (or updates) a single
tracking issue listing stale content.

---

## Deployment

Deployment is handled by the **Cloudflare Pages Git integration** — no API tokens or
GitHub secrets required. Cloudflare watches the repository, builds on push, and
publishes.

### Project settings

| Setting | Value |
| --- | --- |
| Project name | `stack-pipeline` |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | from `.node-version` (22.12.0) |

The project name **must** match `name` in `wrangler.toml`, or Cloudflare rejects the
build.

### How the quality gate survives

`npm run build` chains `postbuild` → `scripts/audit-build.mjs`, so the compliance audit
runs as part of the build itself rather than as a separate CI step. When the audit finds
an error it exits non-zero, the build fails, and **Cloudflare refuses to publish** —
the previously deployed version stays live.

Verified by stripping `rel="sponsored"` from affiliate links: `npm run build` exited `1`
with 16 errors and produced no deployable output.

`.github/workflows/ci.yml` runs that same build on pull requests so regressions surface
as a failed check before merge, instead of as a failed production deploy after it.

### Environment variables

Set these in **Cloudflare → Workers & Pages → stack-pipeline → Settings → Environment
variables**, not as GitHub secrets. All are optional — the site builds and passes its
audit with every one unset.

| Variable | Purpose |
| --- | --- |
| `PUBLIC_ADSENSE_CLIENT` | `ca-pub-…` publisher ID |
| `PUBLIC_ADSENSE_SLOT_*` | Manual ad unit IDs (5 slots) |
| `PUBLIC_GA4_ID` | GA4 measurement ID |
| `PUBLIC_PLAUSIBLE_DOMAIN` | Plausible domain |
| `PUBLIC_CONTACT_ENDPOINT` | Contact form POST endpoint |

Edge caching, security headers and canonical-host redirects are configured in
`public/_headers` and `public/_redirects`.

---

## Going live checklist

1. Create the Cloudflare Pages project named **`stack-pipeline`** and add the two
   Cloudflare secrets.
2. Point `stackpipeline.com` at the Pages project (the `www` → apex 301 is preconfigured).
3. Publish 20–30 substantial pages **before** applying to AdSense — thin sites are the
   most common rejection reason.
4. Set `PUBLIC_ADSENSE_CLIENT`, then create the ad units and add their slot IDs.
5. Replace the placeholder publisher ID in `ADS.sellers` (`src/config/site.ts`) so
   `/ads.txt` is correct.
6. Verify the property in Search Console and submit `/sitemap-index.xml`.
7. Update the real legal entity name and postal address in `src/config/site.ts`.

---

## License

Proprietary. © StackPipeline Media.
