/**
 * Invariants for the tool directory data (src/content/tools/tools.json).
 *
 * The `indexable` flag drives both the robots meta on /tools/[slug]/ and the sitemap
 * filter in astro.config.mjs. The built output is cross-checked by
 * scripts/audit-build.mjs; these tests guard the data layer itself so a malformed
 * entry fails `npm test` before anyone waits on a build:
 *   - slugs are unique, URL-safe and match their route
 *   - every entry has the fields the directory and detail pages render
 *   - `indexable` is an explicit boolean (the content schema defaults to false,
 *     so a missing flag silently de-indexes — require it to be deliberate)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tools = JSON.parse(
  await readFile(path.join(ROOT, 'src/content/tools/tools.json'), 'utf8'),
);

test('tools.json is a non-empty array', () => {
  assert.ok(Array.isArray(tools) && tools.length > 0);
});

test('slugs are unique', () => {
  const slugs = tools.map((tool) => tool.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'duplicate slug in tools.json');
});

test('slugs are URL-safe and ids match slugs', () => {
  for (const tool of tools) {
    assert.match(tool.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, `unsafe slug: ${tool.slug}`);
    assert.equal(tool.id, tool.slug, `id "${tool.id}" does not match slug "${tool.slug}"`);
  }
});

test('every tool has the fields the directory renders', () => {
  for (const tool of tools) {
    for (const field of ['name', 'category', 'tagline', 'description']) {
      assert.ok(
        typeof tool[field] === 'string' && tool[field].trim().length > 0,
        `${tool.slug}: missing or empty "${field}"`,
      );
    }
  }
});

test('indexable is an explicit boolean on every entry', () => {
  for (const tool of tools) {
    assert.equal(
      typeof tool.indexable,
      'boolean',
      `${tool.slug}: "indexable" must be explicitly true or false — the schema default ` +
        '(false) silently de-indexes an entry that merely forgot the field',
    );
  }
});
