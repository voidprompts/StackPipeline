/**
 * Tests for the outsourced-review intake schema (scripts/lib/intake-schema.mjs).
 *
 * Covers the required scenarios from the task spec:
 *   - valid hands-on review
 *   - missing evidence
 *   - invalid score weights (covered in testing-protocol.test.mjs, since weights live
 *     structurally in the scorecard table, not the intake schema)
 *   - unsupported pricing claim (no source / no checked date)
 *   - unauthorized public attribution
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIntake } from '../scripts/lib/intake-schema.mjs';

function baseIntake(overrides = {}) {
  return {
    schemaVersion: 1,
    toolId: 'n8n',
    tester: {
      name: 'Independent contractor',
      publicAttributionAuthorized: false,
      role: 'Freelance automation consultant',
      relevantExperience: 'Five years building n8n and Zapier workflows for agency clients.',
      certifiesAccurate: true,
    },
    testing: {
      planTested: 'Starter ($20/mo)',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-20',
      hoursTested: 22,
      workflowsTested: ['Lead routing from webhook to CRM', 'Scheduled CSV sync'],
      methodology:
        'Built and ran three workflows daily for three weeks, logging failures and response times.',
    },
    quantitativeFindings: ['Webhook workflow completed in avg 1.2s over 200 runs'],
    advantages: ['Self-hosting removed per-task billing entirely'],
    limitations: ['Learning curve steeper than Zapier for non-technical users'],
    reliabilityIssues: ['Two workflow executions failed silently after a Docker restart'],
    supportInteractions: ['Forum reply took 18 hours for a webhook signature question'],
    comparisonProducts: ['zapier', 'make'],
    pricingSources: [
      {
        claim: 'Starter plan is $20/mo billed annually',
        sourceUrl: 'https://n8n.io/pricing/',
        checkedDate: '2026-09-23',
      },
    ],
    officialSourceUrls: ['https://n8n.io/pricing/'],
    evidenceRefs: [],
    conflictsOfInterest: 'None disclosed.',
    affiliateRelationship: { exists: true, disclosed: true },
    scorecard: [
      { criterionId: 'easeOfSetup', score: 4, evidenceNote: 'First workflow live within 40 minutes of signup' },
      { criterionId: 'workflowCapabilities', score: 4.5, evidenceNote: 'Code node handled a transform no UI step could' },
      { criterionId: 'integrationsApi', score: 4, evidenceNote: 'HTTP node covered every gap in native connectors' },
      { criterionId: 'reliability', score: 3.5, evidenceNote: 'Two silent failures after container restart during test period' },
      { criterionId: 'valueForMoney', score: 4.5, evidenceNote: 'Self-hosted cost was under $10/mo in server bills' },
      { criterionId: 'supportDocumentation', score: 3.5, evidenceNote: 'Forum response took 18 hours; docs were accurate' },
    ],
    editorialApprovalStatus: 'pending',
    ...overrides,
  };
}

test('valid hands-on review intake parses successfully', () => {
  const result = parseIntake(baseIntake());
  assert.equal(result.ok, true);
  assert.equal(result.data.toolId, 'n8n');
});

test('rejects intake with missing evidence (no advantages/limitations)', () => {
  const intake = baseIntake({ advantages: [], limitations: [] });
  const result = parseIntake(intake);
  assert.equal(result.ok, false);
  const paths = result.issues.map((i) => i.path);
  assert.ok(paths.includes('advantages'));
  assert.ok(paths.includes('limitations'));
});

test('rejects intake with an incomplete scorecard (missing criteria)', () => {
  const intake = baseIntake({
    scorecard: [
      { criterionId: 'easeOfSetup', score: 4, evidenceNote: 'First workflow live within 40 minutes of signup' },
    ],
  });
  const result = parseIntake(intake);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.message.includes('must include an evidenced entry for every criterion')));
});

test('rejects intake with a generic/too-short evidence note', () => {
  const intake = baseIntake({
    scorecard: baseIntake().scorecard.map((entry, i) =>
      i === 0 ? { ...entry, evidenceNote: 'ok' } : entry,
    ),
  });
  const result = parseIntake(intake);
  assert.equal(result.ok, false);
});

test('rejects unsupported pricing claim (missing source URL)', () => {
  const intake = baseIntake();
  delete intake.pricingSources[0].sourceUrl;
  const result = parseIntake(intake);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.path.includes('pricingSources')));
});

test('rejects unsupported pricing claim (empty pricingSources array)', () => {
  const intake = baseIntake({ pricingSources: [] });
  const result = parseIntake(intake);
  assert.equal(result.ok, false);
});

test('rejects unauthorized public attribution (real name without authorization flag would still pass schema, but placeholder name with authorization=true is rejected)', () => {
  const intake = baseIntake({
    tester: {
      ...baseIntake().tester,
      name: 'Independent contractor',
      publicAttributionAuthorized: true, // contradiction: authorized but no real name given
    },
  });
  const result = parseIntake(intake);
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some((i) => i.path.includes('publicAttributionAuthorized')),
  );
});

test('accepts named, authorized attribution with a real name', () => {
  const intake = baseIntake({
    tester: {
      ...baseIntake().tester,
      name: 'Jordan Rivera',
      publicAttributionAuthorized: true,
    },
  });
  const result = parseIntake(intake);
  assert.equal(result.ok, true);
});

test('rejects when tester does not certify accuracy', () => {
  const intake = baseIntake({
    tester: { ...baseIntake().tester, certifiesAccurate: false },
  });
  const result = parseIntake(intake);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.path.includes('certifiesAccurate')));
});

test('rejects when an affiliate relationship exists but is not disclosed', () => {
  const intake = baseIntake({ affiliateRelationship: { exists: true, disclosed: false } });
  const result = parseIntake(intake);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.path.includes('affiliateRelationship')));
});

test('accepts when no affiliate relationship exists and disclosed is false', () => {
  const intake = baseIntake({ affiliateRelationship: { exists: false, disclosed: false } });
  const result = parseIntake(intake);
  assert.equal(result.ok, true);
});

test('rejects contradictory testing dates (end before start)', () => {
  const intake = baseIntake({
    testing: { ...baseIntake().testing, periodStart: '2026-08-20', periodEnd: '2026-08-01' },
  });
  const result = parseIntake(intake);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.path.includes('periodEnd')));
});

test('rejects implausible hours tested for the stated period', () => {
  const intake = baseIntake({
    testing: {
      ...baseIntake().testing,
      periodStart: '2026-08-01',
      periodEnd: '2026-08-02', // 1 day = max 24h
      hoursTested: 500,
    },
  });
  const result = parseIntake(intake);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.path.includes('hoursTested')));
});

test('rejects missing official source URLs', () => {
  const intake = baseIntake({ officialSourceUrls: [] });
  const result = parseIntake(intake);
  assert.equal(result.ok, false);
});

test('rejects an invalid evidenceRefs publicPath with traversal', () => {
  const intake = baseIntake({
    evidenceRefs: [{ description: 'A screenshot', publicPath: '../../etc/passwd' }],
  });
  const result = parseIntake(intake);
  assert.equal(result.ok, false);
});
