#!/usr/bin/env node
/**
 * Daily content pipeline — publishes up to `dailyLimit` posts per run from the
 * human-curated queue in data/content-queue.json.
 *
 * Division of responsibility:
 *   - HUMANS curate the queue. Adding a row is the editorial approval for that
 *     topic; the queue is ordered by priority and automation never invents topics.
 *   - THIS SCRIPT takes the top pending items (default 3/day), generates the posts
 *     with scripts/generate-integrations.mjs --publish, and marks the items done.
 *   - THE WORKFLOW (.github/workflows/daily-content.yml) validates the result with
 *     the full build + audit before opening a PR, and the auto-merge gate
 *     re-validates at the PR head before anything reaches main.
 *
 * Targeting: the site is single-locale English with vendor USD pricing, aimed at
 * tier-1 English-speaking markets (queue metadata: targetGeo US/GB/CA/AU/NZ).
 * Geo targeting here means topic selection, language and currency — not hreflang
 * tricks or country-doorway pages.
 *
 * Outputs (for the workflow): writes GitHub Actions outputs `generated`,
 * `remaining` and `summary_file` when GITHUB_OUTPUT is set.
 *
 * Usage:
 *   node scripts/daily-content.mjs            # publish up to dailyLimit items
 *   node scripts/daily-content.mjs --dry-run  # show what would be published
 */

import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUEUE_PATH = path.join(ROOT, 'data/content-queue.json');
const OUT_DIR = path.join(ROOT, 'src/content/integrations');
/** Warn (and let the workflow open a refill issue) when runway drops below a week. */
const LOW_WATERMARK = 7;

const dryRun = process.argv.includes('--dry-run');

const queueDoc = JSON.parse(await readFile(QUEUE_PATH, 'utf8'));
const limit = Number(queueDoc.dailyLimit ?? 3);
const today = new Date().toISOString().slice(0, 10);

const pending = queueDoc.queue.filter((item) => item.status === 'pending');
const batch = pending.slice(0, limit);

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

if (batch.length === 0) {
  console.log('Queue is empty — nothing to publish. Refill data/content-queue.json.');
  setOutput('generated', '0');
  setOutput('remaining', '0');
  process.exit(0);
}

const published = [];
for (const item of batch) {
  if (item.type !== 'integration') {
    console.warn(`Skipping unsupported queue item type "${item.type}"`);
    item.status = 'skipped';
    item.note = `Unsupported type on ${today}`;
    continue;
  }
  const slug = `${item.source}-to-${item.target}`;
  const file = path.join(OUT_DIR, `${slug}.mdx`);
  if (existsSync(file)) {
    console.log(`• ${slug} already exists — marking done without overwriting.`);
    item.status = 'already-existed';
    item.publishedOn = today;
    continue;
  }
  if (dryRun) {
    console.log(`[dry-run] would publish ${slug}`);
    continue;
  }
  execFileSync(
    'node',
    ['scripts/generate-integrations.mjs', '--pairs', `${item.source}:${item.target}`, '--publish'],
    { cwd: ROOT, stdio: 'inherit' },
  );
  item.status = 'published';
  item.publishedOn = today;
  item.slug = slug;
  published.push(item);
}

const remaining = queueDoc.queue.filter((item) => item.status === 'pending').length;

if (!dryRun) {
  await writeFile(QUEUE_PATH, `${JSON.stringify(queueDoc, null, 2)}\n`, 'utf8');
}

const geo = (queueDoc.targetGeo ?? []).join(', ');
const summaryLines = [
  `Published ${published.length} integration guide(s) on ${today} (tier-1 targeting: ${geo}; ${queueDoc.language ?? 'en'}/${queueDoc.currency ?? 'USD'}):`,
  '',
  ...published.map((item) => `- \`/integrations/${item.slug}/\` — ${item.source} → ${item.target}`),
  '',
  `Queue runway: ${remaining} pending topic(s) (${Math.floor(remaining / limit)} day(s) at ${limit}/day).`,
];
if (remaining < LOW_WATERMARK) {
  summaryLines.push('', `⚠️ Queue is below the ${LOW_WATERMARK}-topic low watermark — refill data/content-queue.json.`);
}
const summary = summaryLines.join('\n');
console.log(`\n${summary}`);

if (!dryRun) {
  const summaryFile = path.join(ROOT, 'daily-content-summary.md');
  await writeFile(summaryFile, `${summary}\n`, 'utf8');
  setOutput('summary_file', 'daily-content-summary.md');
}
setOutput('generated', String(published.length));
setOutput('remaining', String(remaining));
