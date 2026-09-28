# Adding a new tool before reviewing it

`scripts/review-intake.mjs` and `scripts/review-validate.mjs` both refuse to work with a
`toolId` that is not already present in `src/content/tools/tools.json` — a review can never
reference a product that doesn't exist in the directory. Add the tool first.

## Steps

1. **Open `src/content/tools/tools.json`.** It is a flat JSON array; add a new object following
   the shape validated by the `tools` collection schema in `src/content.config.ts`:

   ```json
   {
     "id": "example-tool",
     "name": "Example Tool",
     "slug": "example-tool",
     "category": "Workflow automation",
     "tagline": "One-line positioning statement, verified against the vendor's own copy.",
     "description": "A few sentences describing what the product actually does — no invented superlatives.",
     "website": "https://example-tool.example.com",
     "affiliateUrl": "https://example-tool.example.com/?via=stackpipeline",
     "brandColor": "#123456",
     "startingPrice": "$X/mo",
     "freeTier": false,
     "apiAvailable": true,
     "nativeIntegrations": 0,
     "bestFor": "A short, specific description of the ideal customer."
   }
   ```

   Only `affiliateUrl`, `logo`, `rating`, `bestFor` and `g2Rating` are optional — see the `tools`
   schema for the authoritative field list. Every factual field (`startingPrice`, `freeTier`,
   `nativeIntegrations`, etc.) must be sourced from the vendor's own current pages, the same
   standard the rest of this pipeline holds reviews to. Do not copy a competitor's marketing
   number without checking it.

2. **Do not set `rating` or `g2Rating` yet** unless you have a verified, dated source for them —
   these feed sorting order on `/tools/` and the tool's own aggregate rating schema. Leave them
   unset until a review or a verified third-party citation justifies a number.

3. **Run `npm run check` and `npm run build`.** Adding a tool entry alone should build cleanly;
   if it does not, the new object does not match the schema — check the error against
   `src/content.config.ts`.

4. **Only then** run `npm run review:intake -- --file path/to/intake.json` with `toolId` set to
   the new tool's `id`. The intake CLI checks the tool exists via the same
   `src/content/tools/tools.json` file, so this step must come first.

## Why tool records and reviews are separate

Keeping the tool directory and the review content collections separate means:

- A tool can be listed (with directory/comparison-table presence) before any review exists.
- A review always resolves a real `tool` reference (`reference('tools')` in
  `src/content.config.ts`), so Astro's content layer itself fails the build if a review ever
  points at a tool that was renamed or removed.
- The intake/validate pipeline's "unknown tool ID" check (a required failure mode — see
  `tests/review-validate.test.mjs`) has exactly one source of truth to check against.
