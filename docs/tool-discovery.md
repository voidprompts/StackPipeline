# Tool discovery automation

StackPipeline now has a safe discovery job for finding additions to the directory. It is deliberately
an **editorial queue**, not an auto-publisher.

## Run it locally

```bash
npm run tools:fetch
```

The command reads the explicit URL allowlist in `data/tool-sources.json`, fetches each vendor
homepage, extracts basic public metadata, and writes `data/tool-candidates.json`. The generated
file is kept in a draft PR as an editorial inbox, not as published content.

A candidate can be added to `src/content/tools/tools.json` only after an editor verifies its
pricing, product claims, ratings, integration count, affiliate relationship and category. The
homepage metadata is a discovery hint and is never treated as sufficient evidence for a review.

## Scheduled automation

`.github/workflows/tool-discovery.yml` runs every Monday and can also be started manually from
GitHub Actions. It uploads the candidate queue as a 30-day artifact. It does not commit files,
open a publication PR, or change the live directory. This keeps human review and the existing
build/review gates in the loop.

## Adding a source

Add one object to `data/tool-sources.json`:

```json
{
  "id": "vendor-slug",
  "name": "Vendor Name",
  "url": "https://vendor.example",
  "category": "Category"
}
```

Only add URLs that have been individually approved for this purpose. The fetcher follows no links,
does not crawl directories, does not bypass access controls, and has a 15-second request timeout.
Candidates matching an existing tool's website domain are marked `duplicate` in the queue.
