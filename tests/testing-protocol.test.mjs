/**
 * Tests for scripts/lib/testing-protocol.mjs — the weighted scorecard.
 * Covers "invalid score weights" from the task's required test scenarios.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCORECARD_CRITERIA,
  totalWeight,
  computeWeightedScore,
  weightsSumToOne,
} from '../scripts/lib/testing-protocol.mjs';

test('canonical scorecard weights sum to 1.0', () => {
  assert.ok(Math.abs(totalWeight() - 1) < 0.001, `weights summed to ${totalWeight()}`);
});

test('computeWeightedScore succeeds with a fully evidenced scorecard', () => {
  const scored = SCORECARD_CRITERIA.map((c) => ({
    criterionId: c.id,
    score: 4,
    evidenceNote: 'A sufficiently detailed evidence note describing what was observed.',
  }));
  const result = computeWeightedScore(scored);
  assert.equal(result.ok, true);
  assert.equal(result.value, 4);
  assert.equal(result.breakdown.length, SCORECARD_CRITERIA.length);
});

test('computeWeightedScore refuses to compute a score with a missing criterion', () => {
  const scored = SCORECARD_CRITERIA.slice(1).map((c) => ({
    criterionId: c.id,
    score: 4,
    evidenceNote: 'A sufficiently detailed evidence note describing what was observed.',
  }));
  const result = computeWeightedScore(scored);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, [SCORECARD_CRITERIA[0].id]);
});

test('computeWeightedScore refuses to compute a score without an evidence note', () => {
  const scored = SCORECARD_CRITERIA.map((c) => ({
    criterionId: c.id,
    score: 4,
    evidenceNote: '',
  }));
  const result = computeWeightedScore(scored);
  assert.equal(result.ok, false);
  assert.ok(result.reasons.length === SCORECARD_CRITERIA.length);
});

test('computeWeightedScore refuses an out-of-range score', () => {
  const scored = SCORECARD_CRITERIA.map((c, i) => ({
    criterionId: c.id,
    score: i === 0 ? 7 : 4,
    evidenceNote: 'A sufficiently detailed evidence note describing what was observed.',
  }));
  const result = computeWeightedScore(scored);
  assert.equal(result.ok, false);
  assert.ok(result.reasons.some((r) => r.includes('outside the 0-5 range')));
});

test('weightsSumToOne accepts a valid published breakdown', () => {
  const breakdown = [
    { criterion: 'A', score: 4, weight: 0.5 },
    { criterion: 'B', score: 4, weight: 0.5 },
  ];
  assert.equal(weightsSumToOne(breakdown).ok, true);
});

test('weightsSumToOne rejects invalid score weights that do not total 1.0', () => {
  const breakdown = [
    { criterion: 'A', score: 4, weight: 0.5 },
    { criterion: 'B', score: 4, weight: 0.6 },
  ];
  const result = weightsSumToOne(breakdown);
  assert.equal(result.ok, false);
  assert.match(result.reason, /1\.0/);
});

test('weightsSumToOne rejects when some entries are missing a weight', () => {
  const breakdown = [
    { criterion: 'A', score: 4, weight: 0.5 },
    { criterion: 'B', score: 4 },
  ];
  const result = weightsSumToOne(breakdown);
  assert.equal(result.ok, false);
});

test('weightsSumToOne is a no-op for breakdowns without any weights declared', () => {
  const breakdown = [{ criterion: 'A', score: 4 }, { criterion: 'B', score: 4 }];
  assert.equal(weightsSumToOne(breakdown).ok, true);
});
