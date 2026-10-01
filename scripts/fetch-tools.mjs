#!/usr/bin/env node
/**
 * Fetch a curated list of vendor homepages and produce a review queue.
 *
 * This is discovery, not publication: by default it writes data/tool-candidates.json and
 * never mutates tools.json. A human must verify pricing, integrations and ratings before
 * adding a candidate to the directory. Sources are explicit and version-controlled so this
 * does not become an uncontrolled web crawler.
 *
 * Usage:
 *   npm run tools:fetch
 *   node scripts/fetch-tools.mjs --source data/tool-sources.json --out data/tool-candidates.json
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SOURCE = path.join(ROOT, 'data/tool-sources.json');
const DEFAULT_OUT = path.join(ROOT, 'data/tool-candidates.json');
const TOOLS = path.join(ROOT, 'src/content/tools/tools.json');

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1] ?? fallback;
}

function absolute(file) {
  return path.isAbsolute(file) ? file : path.join(ROOT, file);
}

function decode(value = '') {
  return value.replace(/&#39;|&#x27;/gi, "'").replace(/&quot;/gi, '"').replace(/&amp;/gi, '&').replace(/<[^>]+>/g, '').trim();
}

function meta(html, key) {
  const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']*)["']`, 'i');
  const reverse = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${key}["']`, 'i');
  return decode(html.match(pattern)?.[1] ?? html.match(reverse)?.[1] ?? '');
}

function title(html) {
  return decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
}

function cleanName(value, fallback) {
  return (value || fallback).replace(/\s*[|–—-]\s*(official website|home|homepage).*$/i, '').trim().slice(0, 100);
}

async function fetchCandidate(source) {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(source.url, {
      headers: { 'user-agent': 'StackPipeline-tool-discovery/1.0 (+https://stack-pipeline.pages.dev)' },
      signal: AbortSignal.timeout(15000),
    });
    const html = await response.text();
    const description = meta(html, 'description') || meta(html, 'og:description');
    return {
      id: source.id,
      name: cleanName(meta(html, 'og:site_name') || title(html), source.name),
      website: source.url,
      category: source.category,
      tagline: description.slice(0, 180) || `Candidate discovered from the ${source.name} website.`,
      description: description.slice(0, 500) || 'Verify this tool manually before adding it to the directory.',
      sourceUrl: source.url,
      checkedAt,
      status: response.ok ? 'needs-editorial-review' : 'fetch-failed',
      httpStatus: response.status,
    };
  } catch (error) {
    return {
      id: source.id, name: source.name, website: source.url, category: source.category,
      sourceUrl: source.url, checkedAt, status: 'fetch-failed', error: error.message,
    };
  }
}

const sourcePath = absolute(arg('source', DEFAULT_SOURCE));
const outPath = absolute(arg('out', DEFAULT_OUT));
const sources = JSON.parse(await readFile(sourcePath, 'utf8'));
const existing = JSON.parse(await readFile(TOOLS, 'utf8'));
const existingDomains = new Set(existing.map((tool) => new URL(tool.website).hostname.replace(/^www\./, '')));
const candidates = [];
for (const source of sources) {
  const candidate = await fetchCandidate(source);
  const domain = new URL(source.url).hostname.replace(/^www\./, '');
  candidate.duplicate = existingDomains.has(domain);
  candidates.push(candidate);
  console.log(`${candidate.status === 'needs-editorial-review' ? '✓' : '✗'} ${source.name} — ${candidate.status}`);
}
await writeFile(outPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), sourceFile: path.relative(ROOT, sourcePath), candidates }, null, 2)}\n`);
console.log(`\nWrote ${candidates.length} candidates to ${path.relative(ROOT, outPath)}.`);
console.log('No published content was changed; review candidates and make a normal PR.');
