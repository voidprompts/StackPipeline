import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readMdx, writeMdx } from '../scripts/lib/mdx-frontmatter.mjs';

test('readMdx parses a well-formed frontmatter block', () => {
  const src = '---\ntitle: "Hi"\nrating:\n  value: 4.5\n---\n\nBody text.\n';
  const parsed = readMdx(src);
  assert.equal(parsed.frontmatter.title, 'Hi');
  assert.equal(parsed.frontmatter.rating.value, 4.5);
  assert.match(parsed.body, /Body text\./);
});

test('readMdx returns null for a file with no frontmatter', () => {
  assert.equal(readMdx('Just a body, no frontmatter.'), null);
});

test('writeMdx . readMdx round-trips nested structures', () => {
  const frontmatter = {
    title: 'Test',
    rating: { value: 4, breakdown: [{ criterion: 'A', score: 4, weight: 0.5 }] },
    tags: ['a', 'b'],
  };
  const out = writeMdx({ frontmatter, body: '\nHello.\n' });
  const parsed = readMdx(out);
  assert.deepEqual(parsed.frontmatter, frontmatter);
});
