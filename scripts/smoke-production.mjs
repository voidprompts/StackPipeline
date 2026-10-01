#!/usr/bin/env node
/**
 * Post-deploy production smoke test.
 *
 * The build audit (scripts/audit-build.mjs) proves dist/ is internally consistent, but
 * says nothing about what the CDN is actually serving. During the 2026-10-01 deploy
 * cutover, production briefly served a stale /tools/ directory alongside a fresh
 * sitemap — the sitemap advertised /tools/systeme-io/ while the route returned 404.
 * This script detects exactly that class of skew by checking the LIVE site against the
 * repository's source of truth (src/content/tools/tools.json):
 *
 *   1. every URL in the live sitemap returns HTTP 200
 *   2. no live sitemap URL serves a noindex page
 *   3. the live sitemap contains exactly the indexable tool slugs — no thin profiles
 *   4. every tool in tools.json is linked from /tools/ and its route returns 200
 *   5. live robots meta matches each tool's `indexable` flag
 *
 * Deploys propagate asynchronously, so when run right after a push the whole suite
 * retries for up to ~10 minutes before failing (SMOKE_ATTEMPTS × SMOKE_DELAY_SECONDS).
 *
 * Usage:
 *   node scripts/smoke-production.mjs
 *   BASE_URL=https://preview.example.pages.dev node scripts/smoke-production.mjs
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = (process.env.BASE_URL ?? 'https://stack-pipeline.pages.dev').replace(/\/$/, '');
const ATTEMPTS = Number(process.env.SMOKE_ATTEMPTS ?? 10);
const DELAY_SECONDS = Number(process.env.SMOKE_DELAY_SECONDS ?? 60);

/** Fetch with cache-busting headers so we test origin content, not a stale edge copy. */
async function get(url) {
  const response = await fetch(url, {
    redirect: 'manual',
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
      'user-agent': 'StackPipeline-smoke/1.0 (+https://github.com/voidprompts/StackPipeline)',
    },
  });
  return { status: response.status, body: response.ok ? await response.text() : '' };
}

const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

const robotsMeta = (html) => {
  const match = /<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i.exec(html);
  return match ? match[1] : null;
};

async function runChecks() {
  const failures = [];
  const fail = (message) => failures.push(message);

  const tools = JSON.parse(
    await readFile(path.join(ROOT, 'src/content/tools/tools.json'), 'utf8'),
  );

  // ---- collect the live sitemap ----
  const index = await get(`${BASE_URL}/sitemap-index.xml`);
  if (index.status !== 200) {
    fail(`GET /sitemap-index.xml -> ${index.status}`);
    return failures; // nothing else is meaningful without the sitemap
  }

  const urls = [];
  for (const sitemapUrl of locs(index.body)) {
    const pathname = new URL(sitemapUrl).pathname;
    const sitemap = await get(`${BASE_URL}${pathname}`);
    if (sitemap.status !== 200) {
      fail(`GET ${pathname} -> ${sitemap.status}`);
      continue;
    }
    urls.push(...locs(sitemap.body));
  }
  if (urls.length === 0) fail('Live sitemap contains no URLs');

  // ---- 1 + 2: every sitemap URL is live and indexable ----
  for (const url of urls) {
    const pathname = new URL(url).pathname;
    const page = await get(`${BASE_URL}${pathname}`);
    if (page.status !== 200) {
      fail(`Sitemap lists ${pathname} but it returned ${page.status}`);
      continue;
    }
    const robots = robotsMeta(page.body);
    if (robots && /noindex/i.test(robots)) {
      fail(`Sitemap lists ${pathname} but the live page is noindex`);
    }
  }

  // ---- 3: sitemap tool set === indexable tool set ----
  const sitemapToolSlugs = new Set(
    urls
      .map((url) => /^\/tools\/([^/]+)\/$/.exec(new URL(url).pathname)?.[1])
      .filter(Boolean),
  );
  for (const tool of tools) {
    if (tool.indexable === true && !sitemapToolSlugs.has(tool.slug)) {
      fail(`Indexable tool "${tool.slug}" is missing from the live sitemap`);
    }
    if (tool.indexable !== true && sitemapToolSlugs.has(tool.slug)) {
      fail(`Non-indexable tool "${tool.slug}" appears in the live sitemap`);
    }
  }

  // ---- 4 + 5: the directory and every tool route match the repository ----
  const directory = await get(`${BASE_URL}/tools/`);
  if (directory.status !== 200) {
    fail(`GET /tools/ -> ${directory.status}`);
  }
  for (const tool of tools) {
    if (directory.status === 200 && !directory.body.includes(`/tools/${tool.slug}/`)) {
      fail(`/tools/ does not link to "${tool.slug}" — directory is stale`);
    }
    const page = await get(`${BASE_URL}/tools/${tool.slug}/`);
    if (page.status !== 200) {
      fail(`GET /tools/${tool.slug}/ -> ${page.status} (linked routes must never 404)`);
      continue;
    }
    const robots = robotsMeta(page.body) ?? '';
    const isNoindex = /noindex/i.test(robots);
    if (tool.indexable === true && isNoindex) {
      fail(`/tools/${tool.slug}/ is indexable in tools.json but serves "${robots}"`);
    }
    if (tool.indexable !== true && !isNoindex) {
      fail(`/tools/${tool.slug}/ is a thin profile but serves "${robots}" (expected noindex)`);
    }
  }

  return failures;
}

for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
  console.log(`\nSmoke test against ${BASE_URL} — attempt ${attempt}/${ATTEMPTS}`);
  let failures;
  try {
    failures = await runChecks();
  } catch (error) {
    failures = [`Unexpected error: ${error.message}`];
  }

  if (failures.length === 0) {
    console.log('✓ Production matches the repository — sitemap, routes and robots meta all consistent.');
    process.exit(0);
  }

  console.log(`✗ ${failures.length} failure(s):`);
  for (const failure of failures) console.log(`  - ${failure}`);

  if (attempt < ATTEMPTS) {
    console.log(`Deploy may still be propagating; retrying in ${DELAY_SECONDS}s…`);
    await sleep(DELAY_SECONDS * 1000);
  }
}

console.error(`\nProduction is still inconsistent after ${ATTEMPTS} attempt(s).`);
process.exit(1);
