#!/usr/bin/env node
/**
 * Post-build SEO, accessibility and AdSense-compliance audit.
 *
 * Runs automatically after `npm run build` and inspects the real emitted HTML rather than
 * the source, so it catches regressions that only appear after rendering. It is the
 * safety net that keeps a programmatic content run from shipping 400 pages with a
 * duplicated title or a missing canonical.
 *
 * Checks performed per page:
 *   - exactly one <h1>
 *   - no skipped heading levels (h2 -> h4 is an error)
 *   - <title> present and <= 60 characters
 *   - meta description present and <= 155 characters
 *   - canonical link present and absolute
 *   - og:image / twitter:card present
 *   - every <img> has width, height and alt
 *   - non-LCP images are lazy-loaded
 *   - JSON-LD parses as valid JSON
 *   - affiliate links carry rel="sponsored"
 *   - <html lang> present
 *
 * Site-wide checks:
 *   - duplicate titles / descriptions / canonicals
 *   - required compliance routes exist (privacy, terms, disclosure, ads.txt, robots, sitemap)
 *
 * Exits non-zero on ERROR-level findings so CI fails before a bad deploy.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 155;

/** Routes that must exist for AdSense review + technical SEO. */
const REQUIRED_FILES = [
  'index.html',
  '404.html',
  'ads.txt',
  'robots.txt',
  'sitemap-index.xml',
  'privacy-policy/index.html',
  'terms-of-service/index.html',
  'affiliate-disclosure/index.html',
  'cookie-policy/index.html',
  'about/index.html',
  'contact/index.html',
  'editorial-policy/index.html',
  'how-we-test/index.html',
];

const errors = [];
const warnings = [];

function error(page, message) {
  errors.push({ page, message });
}
function warn(page, message) {
  warnings.push({ page, message });
}

/** Recursively collect every .html file under dist/. */
async function collectHtml(dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await collectHtml(full, acc);
    else if (entry.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

function attr(tag, name) {
  const match = new RegExp(`${name}=["']([^"']*)["']`, 'i').exec(tag);
  return match ? match[1] : null;
}

/**
 * Decode the HTML entities Astro escapes on output.
 * Length limits apply to the *rendered* string, so "&amp;" must count as one character,
 * not five — otherwise the audit reports false positives on any title containing "&".
 */
function decodeEntities(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&');
}

function auditPage(route, html) {
  // ---- <html lang> ----
  if (!/<html[^>]+lang=["'][a-z-]+["']/i.test(html)) {
    error(route, 'Missing lang attribute on <html>');
  }

  // ---- title ----
  const titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleMatch ? decodeEntities(titleMatch[1].trim()) : null;
  if (!title) error(route, 'Missing <title>');
  else if (title.length > TITLE_MAX) {
    error(route, `Title is ${title.length} chars (max ${TITLE_MAX}): "${title}"`);
  }

  // ---- meta description ----
  const descMatch = /<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i.exec(html);
  const description = descMatch ? decodeEntities(descMatch[1].trim()) : null;
  if (!description) error(route, 'Missing meta description');
  else if (description.length > DESCRIPTION_MAX) {
    error(route, `Meta description is ${description.length} chars (max ${DESCRIPTION_MAX})`);
  }

  // ---- canonical ----
  const canonicalMatch = /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i.exec(html);
  const canonical = canonicalMatch ? canonicalMatch[1] : null;
  if (!canonical) error(route, 'Missing canonical link');
  else if (!/^https:\/\//.test(canonical)) {
    error(route, `Canonical is not absolute: ${canonical}`);
  }

  // ---- social cards ----
  if (!/property=["']og:image["']/i.test(html)) warn(route, 'Missing og:image');
  if (!/name=["']twitter:card["']/i.test(html)) warn(route, 'Missing twitter:card');
  if (!/property=["']og:title["']/i.test(html)) warn(route, 'Missing og:title');

  // ---- headings ----
  const headings = [...html.matchAll(/<h([1-6])[^>]*>/gi)].map((match) => Number(match[1]));
  const h1Count = headings.filter((level) => level === 1).length;

  if (h1Count === 0) error(route, 'No <h1> found');
  else if (h1Count > 1) error(route, `${h1Count} <h1> elements found (expected exactly 1)`);

  // The <h1> must be the first heading in DOM order. A sub-heading appearing above it
  // (e.g. a sidebar or TOC label marked up as <h2>) corrupts the document outline even
  // though no level is technically "skipped".
  const firstHeading = headings[0];
  if (firstHeading !== undefined && firstHeading !== 1) {
    error(route, `First heading in DOM order is h${firstHeading}, expected h1`);
  }

  let previous = 0;
  for (const level of headings) {
    if (previous && level > previous + 1) {
      error(route, `Heading level skipped: h${previous} followed by h${level}`);
      break;
    }
    previous = level;
  }

  // ---- images ----
  const imgTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
  imgTags.forEach((tag, index) => {
    if (attr(tag, 'alt') === null) error(route, `<img> #${index + 1} missing alt attribute`);
    if (!attr(tag, 'width') || !attr(tag, 'height')) {
      error(route, `<img> #${index + 1} missing explicit width/height (CLS risk)`);
    }
    const loading = attr(tag, 'loading');
    const priority = attr(tag, 'fetchpriority');
    if (loading !== 'lazy' && priority !== 'high') {
      warn(route, `<img> #${index + 1} is neither lazy-loaded nor marked as the LCP element`);
    }
  });

  // ---- JSON-LD ----
  const ldBlocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  if (ldBlocks.length === 0) warn(route, 'No JSON-LD structured data');
  ldBlocks.forEach((block, index) => {
    try {
      const parsed = JSON.parse(block[1]);
      const graph = parsed['@graph'];
      if (graph && !Array.isArray(graph)) {
        error(route, `JSON-LD block #${index + 1} has a non-array @graph`);
      }
      // StackPipeline currently uses organization-level attribution. A Person node would
      // reintroduce an individual author claim that has not been verified for publication.
      if (Array.isArray(graph) && graph.some((node) => node?.['@type'] === 'Person')) {
        error(route, `JSON-LD block #${index + 1} contains a Person node; organization attribution is required`);
      }
    } catch (parseError) {
      error(route, `JSON-LD block #${index + 1} is invalid JSON: ${parseError.message}`);
    }
  });

  // ---- affiliate link compliance ----
  const anchors = [...html.matchAll(/<a\b[^>]*>/gi)].map((match) => match[0]);
  for (const anchor of anchors) {
    if (!/data-affiliate=["']true["']/i.test(anchor)) continue;
    const rel = attr(anchor, 'rel') ?? '';
    if (!/sponsored/i.test(rel)) {
      error(route, 'Affiliate link missing rel="sponsored"');
      break;
    }
  }

  // ---- ad slot sanity ----
  const insTags = [...html.matchAll(/<ins\b[^>]*class=["'][^"']*adsbygoogle[^"']*["'][^>]*>/gi)].map(
    (match) => match[0],
  );
  for (const tag of insTags) {
    if (!attr(tag, 'data-ad-client') || !attr(tag, 'data-ad-slot')) {
      error(route, '<ins class="adsbygoogle"> is missing data-ad-client or data-ad-slot');
      break;
    }
  }

  return { title, description, canonical };
}

async function main() {
  try {
    await stat(DIST);
  } catch {
    console.error('dist/ not found — run `npm run build` first.');
    process.exit(1);
  }

  // ---- required files ----
  for (const relative of REQUIRED_FILES) {
    try {
      await stat(path.join(DIST, relative));
    } catch {
      errors.push({ page: '(site)', message: `Required file missing: ${relative}` });
    }
  }

  // ---- ads.txt seller integrity ----
  const adsText = await readFile(path.join(DIST, 'ads.txt'), 'utf8');
  if (/pub-0{16}/.test(adsText)) {
    error('(site)', 'ads.txt contains the prohibited placeholder publisher ID');
  }

  // ---- per-page audit ----
  const files = await collectHtml(DIST);
  const titles = new Map();
  const descriptions = new Map();
  const canonicals = new Map();

  for (const file of files) {
    const route = `/${path.relative(DIST, file).replace(/index\.html$/, '').replace(/\\/g, '/')}`;
    const html = await readFile(file, 'utf8');
    if (/\/authors\//.test(html)) {
      error(route, 'Rendered output links to the removed author-profile route');
    }

    // 404 is intentionally noindex; skip duplicate-metadata bookkeeping for it.
    const isUtility = route.startsWith('/404');
    const { title, description, canonical } = auditPage(route, html);

    if (isUtility) continue;
    if (title) titles.set(title, [...(titles.get(title) ?? []), route]);
    if (description) descriptions.set(description, [...(descriptions.get(description) ?? []), route]);
    if (canonical) canonicals.set(canonical, [...(canonicals.get(canonical) ?? []), route]);
  }

  // ---- duplicates ----
  for (const [value, routes] of titles) {
    if (routes.length > 1) {
      errors.push({
        page: '(site)',
        message: `Duplicate <title> "${value}" on ${routes.length} pages: ${routes.join(', ')}`,
      });
    }
  }
  for (const [, routes] of descriptions) {
    if (routes.length > 1) {
      warnings.push({
        page: '(site)',
        message: `Duplicate meta description on ${routes.length} pages: ${routes.join(', ')}`,
      });
    }
  }
  for (const [value, routes] of canonicals) {
    if (routes.length > 1) {
      errors.push({
        page: '(site)',
        message: `Duplicate canonical ${value} on: ${routes.join(', ')}`,
      });
    }
  }

  // ---- report ----
  console.log(`\nBuild audit — ${files.length} page(s) inspected\n`);

  if (errors.length) {
    console.log(`ERRORS (${errors.length}):`);
    for (const item of errors) console.log(`  ✗ [${item.page}] ${item.message}`);
    console.log('');
  }

  if (warnings.length) {
    console.log(`WARNINGS (${warnings.length}):`);
    for (const item of warnings) console.log(`  ! [${item.page}] ${item.message}`);
    console.log('');
  }

  if (!errors.length && !warnings.length) {
    console.log('✓ All checks passed — SEO, accessibility and ad-compliance clean.\n');
  } else if (!errors.length) {
    console.log(`✓ No errors. ${warnings.length} warning(s) to review.\n`);
  }

  if (errors.length) {
    console.error(`Audit failed with ${errors.length} error(s).`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
