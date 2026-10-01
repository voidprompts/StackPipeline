/**
 * Tests for the auto-merge eligibility gate (scripts/automerge-gate.mjs).
 *
 * The gate is the safety boundary between "automation may publish this" and
 * "a human must look" — these tests pin that boundary:
 *   - content/data diffs are eligible; code, reviews and workflows never are
 *   - deletions and renames are never eligible (they remove live URLs)
 *   - tools.json: new entries must be indexable: false; indexable may never
 *     change in an auto-merged PR; entries may not be removed
 *   - posts with placeholder markers or truncated bodies are rejected
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyDiff, diffTools, checkPost } from '../scripts/automerge-gate.mjs';

const tool = (slug, indexable, extra = {}) => ({ id: slug, slug, indexable, ...extra });

test('content and data changes are eligible', () => {
  const { eligible } = classifyDiff([
    { status: 'M', file: 'src/content/tools/tools.json' },
    { status: 'A', file: 'src/content/guides/new-guide.mdx' },
    { status: 'M', file: 'data/tool-candidates.json' },
  ]);
  assert.equal(eligible, true);
});

test('code, workflow and review changes are never eligible', () => {
  for (const file of [
    'src/pages/tools/[slug].astro',
    'astro.config.mjs',
    '.github/workflows/ci.yml',
    'scripts/automerge-gate.mjs',
    'package.json',
    'src/content/reviews/clay-review.mdx',
    'public/_headers',
  ]) {
    const { eligible, reasons } = classifyDiff([{ status: 'M', file }]);
    assert.equal(eligible, false, `${file} must not be auto-mergeable`);
    assert.ok(reasons.length > 0);
  }
});

test('deletions and renames of content are never eligible', () => {
  assert.equal(
    classifyDiff([{ status: 'D', file: 'src/content/guides/old.mdx' }]).eligible,
    false,
  );
  assert.equal(
    classifyDiff([{ status: 'R100', file: 'src/content/guides/renamed.mdx' }]).eligible,
    false,
  );
});

test('empty diffs are not eligible', () => {
  assert.equal(classifyDiff([]).eligible, false);
});

test('new tool entries must ship indexable: false', () => {
  const base = [tool('zapier', true)];
  assert.deepEqual(diffTools(base, [...base, tool('newtool', false)]), []);
  assert.ok(diffTools(base, [...base, tool('newtool', true)]).length > 0);
  assert.ok(diffTools(base, [...base, tool('newtool', undefined)]).length > 0);
});

test('indexable may never change in an auto-merged PR, in either direction', () => {
  assert.ok(diffTools([tool('a', false)], [tool('a', true)]).length > 0, 'promotion blocked');
  assert.ok(diffTools([tool('a', true)], [tool('a', false)]).length > 0, 'demotion blocked');
  assert.deepEqual(
    diffTools([tool('a', true, { tagline: 'old' })], [tool('a', true, { tagline: 'new' })]),
    [],
    'data edits that leave indexable alone are fine',
  );
});

test('removing a tool is never eligible', () => {
  assert.ok(diffTools([tool('a', false), tool('b', false)], [tool('a', false)]).length > 0);
});

test('posts with placeholder markers are rejected', () => {
  const body = `---\ntitle: "x"\n---\n${'word '.repeat(300)}\n\nTODO: finish this section`;
  assert.ok(checkPost('src/content/guides/x.mdx', body).length > 0);
});

test('truncated posts are rejected, substantive ones pass', () => {
  const frontmatter = '---\ntitle: "x"\n---\n';
  assert.ok(checkPost('g.mdx', `${frontmatter}too short`).length > 0);
  assert.deepEqual(checkPost('g.mdx', `${frontmatter}${'substantive word '.repeat(150)}`), []);
});
