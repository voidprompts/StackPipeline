#!/usr/bin/env node
/**
 * Auto-merge eligibility gate.
 *
 * Decides whether a PR's diff is safe to merge without a human, for use by
 * .github/workflows/auto-merge.yml. The principle: automation may merge changes
 * whose correctness is MECHANICALLY verifiable (schema tests, build audit, sitemap
 * gates, smoke test). Anything that requires editorial or engineering judgment is
 * left for a human, specifically:
 *
 *   - code, config, workflows, layouts, pages, scripts  -> human (engineering review)
 *   - src/content/reviews/**                            -> human (E-E-A-T sign-off is
 *     an editorial act; the editor-approval checklist cannot be automated)
 *   - any change to a tool's `indexable` flag           -> human (SEO-consequential:
 *     it adds/removes sitemap URLs and flips robots meta)
 *   - deleting a tool or a published post               -> human (removes live URLs)
 *
 * What IS eligible:
 *   - adding/editing tool catalog entries that stay non-indexable, or data edits to
 *     existing entries that do not touch `indexable`
 *   - discovery data (data/tool-candidates.json, data/tool-sources.json)
 *   - adding/editing blog content (guides, integrations, alternatives) that clears
 *     the placeholder and minimum-length checks here, plus the full build audit in
 *     the workflow
 *
 * Usage: node scripts/automerge-gate.mjs [baseRef]   (default: origin/main)
 * Exit codes: 0 = eligible, 2 = ineligible (expected outcome, not an error), 1 = error.
 */

import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS_PATH = 'src/content/tools/tools.json';

/** Raw MDX word floor — a truncation/empty-shell guard, not a quality bar. The
 *  thinnest published post is ~240 raw words; real quality gates are the build
 *  audit and, for anything judgment-based, a human. */
const MIN_POST_WORDS = 200;

const CONTENT_POST = /^src\/content\/(guides|integrations|alternatives)\/[^/]+\.mdx$/;
const ALLOWED_PATHS = [
  /^src\/content\/tools\/tools\.json$/,
  CONTENT_POST,
  /^data\/tool-candidates\.json$/,
  /^data\/tool-sources\.json$/,
  /^data\/content-queue\.json$/,
];

/**
 * Classify a parsed name-status diff. Pure function for testability.
 * @param {Array<{status: string, file: string}>} changes
 * @returns {{eligible: boolean, reasons: string[]}}
 */
export function classifyDiff(changes) {
  const reasons = [];
  if (changes.length === 0) {
    return { eligible: false, reasons: ['Empty diff — nothing to merge.'] };
  }
  for (const { status, file } of changes) {
    if (!ALLOWED_PATHS.some((pattern) => pattern.test(file))) {
      reasons.push(`${file}: outside the auto-mergeable allowlist (needs human review)`);
      continue;
    }
    if (status.startsWith('D')) {
      reasons.push(`${file}: deletion removes a live URL (needs human review)`);
    }
    if (status.startsWith('R') || status.startsWith('C')) {
      reasons.push(`${file}: rename/copy changes URLs (needs human review)`);
    }
  }
  return { eligible: reasons.length === 0, reasons };
}

/**
 * Compare base and head tools.json. Pure function for testability.
 * @param {Array<object>} base
 * @param {Array<object>} head
 * @returns {string[]} reasons the change is ineligible (empty = fine)
 */
export function diffTools(base, head) {
  const reasons = [];
  const baseBySlug = new Map(base.map((tool) => [tool.slug, tool]));
  const headBySlug = new Map(head.map((tool) => [tool.slug, tool]));

  for (const slug of baseBySlug.keys()) {
    if (!headBySlug.has(slug)) {
      reasons.push(`tools.json: "${slug}" removed — deletes a live route (needs human review)`);
    }
  }
  for (const [slug, tool] of headBySlug) {
    const previous = baseBySlug.get(slug);
    if (!previous) {
      if (tool.indexable !== false) {
        reasons.push(
          `tools.json: new entry "${slug}" must ship with indexable: false — promotion to ` +
            'indexable requires a sourced review and human editorial approval in the same PR',
        );
      }
    } else if (previous.indexable !== tool.indexable) {
      reasons.push(
        `tools.json: "${slug}" indexable changed ${previous.indexable} -> ${tool.indexable} — ` +
          'sitemap/robots changes require human editorial approval',
      );
    }
  }
  return reasons;
}

/**
 * Validate a blog post body. Pure function for testability.
 * @param {string} file
 * @param {string} source raw MDX including frontmatter
 * @returns {string[]} reasons (empty = fine)
 */
export function checkPost(file, source) {
  const reasons = [];
  const placeholder = /\b(TODO|FIXME|TKTK|XXX|lorem ipsum|placeholder text)\b/i.exec(source);
  if (placeholder) {
    reasons.push(`${file}: contains placeholder marker "${placeholder[0]}" (unfinished draft)`);
  }
  const body = source.replace(/^---\n[\s\S]*?\n---\n?/, '');
  const words = body.split(/\s+/).filter(Boolean).length;
  if (words < MIN_POST_WORDS) {
    reasons.push(`${file}: body is ${words} words (< ${MIN_POST_WORDS}) — looks truncated or empty`);
  }
  return reasons;
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
}

async function main() {
  const baseRef = process.argv[2] ?? 'origin/main';
  const mergeBase = git('merge-base', baseRef, 'HEAD').trim();

  const changes = git('diff', '--name-status', '--no-renames', mergeBase, 'HEAD')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, ...rest] = line.split('\t');
      return { status, file: rest.join('\t') };
    });

  const { reasons } = classifyDiff(changes);

  const touched = (file) => changes.some((change) => change.file === file);

  if (touched(TOOLS_PATH) && !reasons.some((reason) => reason.startsWith(TOOLS_PATH))) {
    let baseTools = [];
    try {
      baseTools = JSON.parse(git('show', `${mergeBase}:${TOOLS_PATH}`));
    } catch {
      // No base version — treat every entry as new.
    }
    const headTools = JSON.parse(await readFile(path.join(ROOT, TOOLS_PATH), 'utf8'));
    reasons.push(...diffTools(baseTools, headTools));
  }

  for (const { status, file } of changes) {
    if (CONTENT_POST.test(file) && !status.startsWith('D')) {
      reasons.push(...checkPost(file, await readFile(path.join(ROOT, file), 'utf8')));
    }
  }

  console.log(`Auto-merge gate — ${changes.length} changed file(s) vs ${baseRef}`);
  for (const { status, file } of changes) console.log(`  ${status}\t${file}`);

  if (reasons.length > 0) {
    console.log('\nNOT eligible for auto-merge:');
    for (const reason of reasons) console.log(`  - ${reason}`);
    process.exit(2);
  }
  console.log('\n✓ Diff is confined to auto-mergeable content and passes all gate checks.');
}

// Only run the CLI when executed directly, so tests can import the pure functions.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
