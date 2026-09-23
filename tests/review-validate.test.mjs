/**
 * Tests for scripts/review-validate.mjs against throwaway fixture files — never against real
 * committed content. Covers the remaining required scenarios from the task spec:
 *   - duplicate review
 *   - unknown tool ID
 *   - unauthorized public attribution (at the published-file level, not just intake-schema)
 *   - unsupported pricing claim (at the published-file level)
 *   - missing evidence (testing dates/hours/workflows/methodology, and evidence files that
 *     don't exist on disk)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateFile, collectReviewFiles } from '../scripts/review-validate.mjs';

const TOOLS = new Map([
  ['n8n', { id: 'n8n', slug: 'n8n', name: 'n8n', affiliateUrl: 'https://n8n.partnerlinks.io/stackpipeline' }],
  ['clay', { id: 'clay', slug: 'clay', name: 'Clay' }], // no affiliateUrl -> no disclosure required
]);

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'sp-review-validate-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function mdx(frontmatterYaml, body = '\nBody text.\n') {
  return `---\n${frontmatterYaml}\n---\n${body}`;
}

test('a fully valid provenance-bearing review passes with zero errors', async () => {
  await withTempDir(async (dir) => {
    const evidenceDir = path.join(dir, 'evidence');
    await mkdir(path.join(evidenceDir, 'n8n'), { recursive: true });
    await writeFile(path.join(evidenceDir, 'n8n', 'shot.png'), 'fake-png-bytes');

    const file = path.join(dir, 'n8n-review.mdx');
    await writeFile(
      file,
      mdx(`tool: n8n
draft: true
rating:
  value: 4
  breakdown:
    - criterion: Ease of setup
      score: 4
      weight: 0.15
      note: Observed directly during testing
    - criterion: Workflow capabilities
      score: 4
      weight: 0.85
      note: Observed directly during testing
testing:
  hoursTested: 20
  planTested: Starter
  periodStart: 2026-08-01
  periodEnd: 2026-08-20
  methodology: Ran three workflows daily for three weeks and logged every execution outcome.
  workflowsTested:
    - Webhook to CRM
attribution:
  mode: anonymous
  authorized: false
provenance:
  pricingSources:
    - sourceUrl: https://n8n.io/pricing/
      checkedDate: 2026-09-23
  evidenceRefs:
    - description: A screenshot
      publicPath: n8n/shot.png
  affiliateRelationship:
    disclosed: true
  editorialApprovalStatus: pending
  certifiedAccurate: true
pricing:
  - plan: Starter
    price: "$20/mo"
`),
    );

    const result = await validateFile(file, TOOLS, new Map(), evidenceDir);
    assert.deepEqual(result.errors, []);
  });
});

test('rejects unknown tool ID', async () => {
  await withTempDir(async (dir) => {
    const file = path.join(dir, 'unknown-review.mdx');
    await writeFile(file, mdx(`tool: totally-not-a-real-tool\ndraft: true\n`));
    const result = await validateFile(file, TOOLS, new Map());
    assert.ok(result.errors.some((e) => e.includes('does not exist in')));
  });
});

test('flags duplicate reviews targeting the same tool', async () => {
  await withTempDir(async (dir) => {
    const fileA = path.join(dir, 'n8n-review-a.mdx');
    const fileB = path.join(dir, 'n8n-review-b.mdx');
    await writeFile(fileA, mdx(`tool: n8n\ndraft: true\n`));
    await writeFile(fileB, mdx(`tool: n8n\ndraft: true\n`));

    const seen = new Map();
    const resultA = await validateFile(fileA, TOOLS, seen);
    const resultB = await validateFile(fileB, TOOLS, seen);

    assert.deepEqual(resultA.errors, []);
    assert.ok(resultB.errors.some((e) => e.includes('Duplicate review')));
  });
});

test('rejects a hands-on review missing testing dates/hours/workflows/methodology', async () => {
  await withTempDir(async (dir) => {
    const file = path.join(dir, 'incomplete-review.mdx');
    await writeFile(
      file,
      mdx(`tool: n8n
draft: true
testing:
  planTested: Starter
provenance:
  editorialApprovalStatus: pending
`),
    );
    const result = await validateFile(file, TOOLS, new Map());
    assert.ok(result.errors.some((e) => e.includes('periodStart/periodEnd')));
    assert.ok(result.errors.some((e) => e.includes('hoursTested')));
    assert.ok(result.errors.some((e) => e.includes('methodology')));
    assert.ok(result.errors.some((e) => e.includes('workflowsTested')));
  });
});

test('rejects unauthorized public attribution', async () => {
  await withTempDir(async (dir) => {
    const file = path.join(dir, 'bad-attribution.mdx');
    await writeFile(
      file,
      mdx(`tool: n8n
draft: true
attribution:
  mode: named
  authorized: false
  displayName: Jordan Rivera
`),
    );
    const result = await validateFile(file, TOOLS, new Map());
    assert.ok(result.errors.some((e) => e.includes('attribution.authorized is not true')));
  });
});

test('rejects a pricing claim with no official source / checked date', async () => {
  await withTempDir(async (dir) => {
    const file = path.join(dir, 'bad-pricing.mdx');
    await writeFile(
      file,
      mdx(`tool: n8n
draft: true
testing:
  hoursTested: 10
  planTested: Starter
  periodStart: 2026-08-01
  periodEnd: 2026-08-10
  methodology: A methodology description long enough to pass the length check.
  workflowsTested: [A workflow]
provenance:
  pricingSources: []
pricing:
  - plan: Starter
    price: "$20/mo"
`),
    );
    const result = await validateFile(file, TOOLS, new Map());
    assert.ok(result.errors.some((e) => e.includes('pricingSources has no entries')));
  });
});

test('rejects a review claiming evidence that does not exist on disk', async () => {
  await withTempDir(async (dir) => {
    const evidenceDir = path.join(dir, 'evidence');
    await mkdir(evidenceDir, { recursive: true });
    const file = path.join(dir, 'ghost-evidence.mdx');
    await writeFile(
      file,
      mdx(`tool: n8n
draft: true
provenance:
  evidenceRefs:
    - description: A screenshot that was never actually saved
      publicPath: n8n/does-not-exist.png
`),
    );
    const result = await validateFile(file, TOOLS, new Map(), evidenceDir);
    assert.ok(result.errors.some((e) => e.includes('does not exist')));
  });
});

test('rejects an undisclosed affiliate relationship when the tool has one', async () => {
  await withTempDir(async (dir) => {
    const file = path.join(dir, 'undisclosed.mdx');
    await writeFile(
      file,
      mdx(`tool: n8n
draft: true
provenance:
  affiliateRelationship:
    disclosed: false
`),
    );
    const result = await validateFile(file, TOOLS, new Map());
    assert.ok(result.errors.some((e) => e.includes('affiliate relationship')));
  });
});

test('rejects a published (non-draft) review without editorial approval', async () => {
  await withTempDir(async (dir) => {
    const file = path.join(dir, 'unapproved.mdx');
    await writeFile(
      file,
      mdx(`tool: clay
draft: false
provenance:
  editorialApprovalStatus: pending
  certifiedAccurate: true
`),
    );
    const result = await validateFile(file, TOOLS, new Map());
    assert.ok(result.errors.some((e) => e.includes('not "approved"')));
  });
});

test('rejects invalid score weights in a published rating breakdown', async () => {
  await withTempDir(async (dir) => {
    const file = path.join(dir, 'bad-weights.mdx');
    await writeFile(
      file,
      mdx(`tool: clay
draft: true
rating:
  value: 4
  breakdown:
    - criterion: A
      score: 4
      weight: 0.5
      note: Evidence here
    - criterion: B
      score: 4
      weight: 0.6
      note: Evidence here
`),
    );
    const result = await validateFile(file, TOOLS, new Map());
    assert.ok(result.errors.some((e) => e.includes('weights are invalid')));
  });
});

test('rejects a rating breakdown entry with no evidence note', async () => {
  await withTempDir(async (dir) => {
    const file = path.join(dir, 'no-evidence-note.mdx');
    await writeFile(
      file,
      mdx(`tool: clay
draft: true
rating:
  value: 4
  breakdown:
    - criterion: A
      score: 4
      weight: 1.0
`),
    );
    const result = await validateFile(file, TOOLS, new Map());
    assert.ok(result.errors.some((e) => e.includes('has no evidence note')));
  });
});

test('collectReviewFiles only picks up .md/.mdx files', async () => {
  await withTempDir(async (dir) => {
    await writeFile(path.join(dir, 'a.mdx'), mdx('tool: n8n\n'));
    await writeFile(path.join(dir, 'b.md'), mdx('tool: clay\n'));
    await writeFile(path.join(dir, 'notes.txt'), 'irrelevant');
    const files = await collectReviewFiles(dir);
    assert.equal(files.length, 2);
  });
});
