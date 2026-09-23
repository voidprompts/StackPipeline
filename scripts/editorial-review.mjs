#!/usr/bin/env node
/**
 * Editorial review loop — the operational half of E-E-A-T.
 *
 * Claiming a review cycle in your editorial policy is worthless unless something
 * enforces it. This script scans published content, compares each page's review date
 * against the cadence for its type, and reports what is overdue.
 *
 * USAGE
 *   node scripts/editorial-review.mjs                 # report overdue content
 *   node scripts/editorial-review.mjs --json          # machine-readable output
 *   node scripts/editorial-review.mjs --stamp <file>  # mark a file reviewed today
 *   node scripts/editorial-review.mjs --ci            # exit 1 if anything is overdue
 *
 * Wire --ci into a scheduled GitHub Action to get an automatic nudge when pricing data
 * goes stale.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = path.join(ROOT, 'src/content');

/** Review cadence in days, per collection. Mirrors the published editorial policy. */
const CADENCE = {
  reviews: 90,
  alternatives: 90,
  integrations: 180,
  guides: 365,
};

const COLLECTIONS = Object.keys(CADENCE);

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') args.json = true;
    else if (arg === '--ci') args.ci = true;
    else if (arg === '--stamp') {
      args.stamp = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

/** Minimal frontmatter reader — we only need a handful of scalar fields. */
function readFrontmatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  if (!match) return {};
  const block = match[1];
  const fields = {};

  for (const line of block.split(/\r?\n/)) {
    // Only top-level scalars (no leading whitespace).
    const fieldMatch = /^([a-zA-Z][a-zA-Z0-9_]*):\s*(.*)$/.exec(line);
    if (!fieldMatch) continue;
    const [, key, rawValue] = fieldMatch;
    const value = rawValue.trim().replace(/^["']|["']$/g, '');
    if (value) fields[key] = value;
  }

  return fields;
}

function daysBetween(a, b) {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

async function collectFiles(collection) {
  const dir = path.join(CONTENT_DIR, collection);
  try {
    const names = await readdir(dir);
    return names
      .filter((name) => name.endsWith('.md') || name.endsWith('.mdx'))
      .map((name) => path.join(dir, name));
  } catch {
    return [];
  }
}

/** Stamp a file as reviewed today by rewriting lastReviewedDate + updatedDate. */
async function stampFile(target) {
  const filepath = path.isAbsolute(target) ? target : path.join(ROOT, target);
  const source = await readFile(filepath, 'utf8');
  const today = new Date().toISOString().slice(0, 10);

  let updated = source;

  if (/^lastReviewedDate:.*$/m.test(source)) {
    updated = updated.replace(/^lastReviewedDate:.*$/m, `lastReviewedDate: ${today}`);
  } else {
    // Insert after publishDate so frontmatter ordering stays predictable.
    updated = updated.replace(
      /^(publishDate:.*)$/m,
      `$1\nlastReviewedDate: ${today}`,
    );
  }

  if (/^updatedDate:.*$/m.test(updated)) {
    updated = updated.replace(/^updatedDate:.*$/m, `updatedDate: ${today}`);
  } else {
    updated = updated.replace(/^(publishDate:.*)$/m, `$1\nupdatedDate: ${today}`);
  }

  await writeFile(filepath, updated, 'utf8');
  console.log(`✓ Stamped ${path.relative(ROOT, filepath)} as reviewed ${today}`);
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.stamp) {
    await stampFile(args.stamp);
    return;
  }

  const now = new Date();
  const report = { generated: now.toISOString(), overdue: [], dueSoon: [], current: [] };

  for (const collection of COLLECTIONS) {
    const files = await collectFiles(collection);
    const cadence = CADENCE[collection];

    for (const filepath of files) {
      const source = await readFile(filepath, 'utf8');
      const fields = readFrontmatter(source);

      if (fields.draft === 'true') continue;

      const anchorRaw = fields.lastReviewedDate ?? fields.updatedDate ?? fields.publishDate;
      if (!anchorRaw) continue;

      const anchor = new Date(anchorRaw);
      if (Number.isNaN(anchor.getTime())) continue;

      const age = daysBetween(now, anchor);
      const entry = {
        file: path.relative(ROOT, filepath),
        collection,
        title: fields.title ?? path.basename(filepath),
        lastReviewed: anchorRaw,
        ageDays: age,
        cadenceDays: cadence,
        overdueBy: age - cadence,
      };

      if (age > cadence) report.overdue.push(entry);
      else if (age > cadence * 0.8) report.dueSoon.push(entry);
      else report.current.push(entry);
    }
  }

  report.overdue.sort((a, b) => b.overdueBy - a.overdueBy);
  report.dueSoon.sort((a, b) => b.ageDays - a.ageDays);

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const total = report.overdue.length + report.dueSoon.length + report.current.length;
    console.log(`\nEditorial review status — ${total} published page(s)\n`);

    if (report.overdue.length) {
      console.log(`OVERDUE (${report.overdue.length}):`);
      for (const item of report.overdue) {
        console.log(
          `  ✗ ${item.title}\n      ${item.file}\n      last reviewed ${item.lastReviewed} · ${item.ageDays}d old · ${item.overdueBy}d past its ${item.cadenceDays}d cadence`,
        );
      }
      console.log('');
    }

    if (report.dueSoon.length) {
      console.log(`DUE SOON (${report.dueSoon.length}):`);
      for (const item of report.dueSoon) {
        console.log(`  • ${item.title} — ${item.ageDays}d old (cadence ${item.cadenceDays}d)`);
      }
      console.log('');
    }

    console.log(`CURRENT: ${report.current.length} page(s) within cadence.`);

    if (report.overdue.length) {
      console.log(
        `\nTo re-verify a page: check live vendor pricing, then run\n  node scripts/editorial-review.mjs --stamp <file>`,
      );
    }
  }

  if (args.ci && report.overdue.length > 0) {
    console.error(`\n${report.overdue.length} page(s) past their review cadence.`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
