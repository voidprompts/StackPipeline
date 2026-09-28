/**
 * Reusable testing protocol for B2B SaaS products, tuned for automation / workflow tools.
 *
 * This is a superset of the public five-line rubric on `/how-we-test/` (Core capability,
 * Ease of use, Integrations, Value for money, Support) — automation-tool testing needs a
 * "Reliability" dimension (failure handling, retries, uptime under real load) that a
 * documentation-only assessment cannot responsibly claim, so it is split out here for
 * contractors who are actually running workflows against a live account.
 *
 * The weights are the canonical source of truth for `scripts/review-intake.mjs` (which
 * refuses to compute a rating unless every criterion in this list has an evidenced score)
 * and `scripts/review-validate.mjs` (which checks a published breakdown's weights sum to
 * 1.0). Do not change the ids without updating any already-published `rating.breakdown`
 * entries that reference them.
 */

/** @typedef {{ id: string, label: string, weight: number, prompt: string }} ScorecardCriterion */

/** @type {ScorecardCriterion[]} */
export const SCORECARD_CRITERIA = [
  {
    id: 'easeOfSetup',
    label: 'Ease of setup',
    weight: 0.15,
    prompt:
      'How long did it take a new account to reach a first working workflow? What tripped you up?',
  },
  {
    id: 'workflowCapabilities',
    label: 'Workflow capabilities',
    weight: 0.25,
    prompt:
      'Can the product express the branching, looping, error-handling and data-transform logic your test workflows required?',
  },
  {
    id: 'integrationsApi',
    label: 'Integrations / API',
    weight: 0.2,
    prompt:
      'Were the connectors you actually used complete and reliable? Did the public API/webhook support cover the gaps?',
  },
  {
    id: 'reliability',
    label: 'Reliability',
    weight: 0.15,
    prompt:
      'Across your test period, how often did runs fail, time out, or silently stop? How were retries and error states handled?',
  },
  {
    id: 'valueForMoney',
    label: 'Value for money',
    weight: 0.15,
    prompt:
      'At the volume you tested, what would this realistically cost per month including overages, and how does that compare with the plan you were on?',
  },
  {
    id: 'supportDocumentation',
    label: 'Support / documentation',
    weight: 0.1,
    prompt:
      'What happened when you actually opened a support ticket or relied on the docs? Response time, resolution quality, doc accuracy.',
  },
];

export const SCORECARD_CRITERION_IDS = SCORECARD_CRITERIA.map((c) => c.id);

const WEIGHT_EPSILON = 0.001;

/** Sum of the canonical weights — used to sanity-check the table itself never drifts. */
export function totalWeight(criteria = SCORECARD_CRITERIA) {
  return criteria.reduce((sum, c) => sum + c.weight, 0);
}

/**
 * Compute a weighted 0-5 rating from a set of scored, evidenced criteria.
 *
 * Refuses to compute anything unless every canonical criterion is present with a numeric
 * score AND a non-trivial evidence note — this is the code-level enforcement of "do not
 * calculate or publish a score unless the required evidence exists".
 *
 * @param {Array<{ criterionId: string, score: number, evidenceNote: string }>} scored
 * @returns {{ ok: true, value: number, breakdown: Array<{criterion:string, score:number, weight:number, note:string}> } | { ok: false, missing: string[], reasons: string[] }}
 */
export function computeWeightedScore(scored) {
  const byId = new Map(scored.map((s) => [s.criterionId, s]));
  const missing = [];
  const reasons = [];

  for (const criterion of SCORECARD_CRITERIA) {
    const entry = byId.get(criterion.id);
    if (!entry) {
      missing.push(criterion.id);
      continue;
    }
    if (typeof entry.score !== 'number' || Number.isNaN(entry.score)) {
      reasons.push(`${criterion.id}: score is missing or not a number`);
    } else if (entry.score < 0 || entry.score > 5) {
      reasons.push(`${criterion.id}: score ${entry.score} is outside the 0-5 range`);
    }
    if (!entry.evidenceNote || entry.evidenceNote.trim().length < 15) {
      reasons.push(
        `${criterion.id}: evidenceNote is missing or too short to count as evidence (need >= 15 chars)`,
      );
    }
  }

  if (missing.length > 0 || reasons.length > 0) {
    return { ok: false, missing, reasons };
  }

  const weightSum = totalWeight();
  if (Math.abs(weightSum - 1) > WEIGHT_EPSILON) {
    // Defensive: this should be impossible unless SCORECARD_CRITERIA itself was edited
    // incorrectly, but a silently wrong denominator would make every future score wrong.
    throw new Error(
      `Internal error: SCORECARD_CRITERIA weights sum to ${weightSum}, expected 1.0`,
    );
  }

  const breakdown = SCORECARD_CRITERIA.map((criterion) => {
    const entry = byId.get(criterion.id);
    return {
      criterion: criterion.label,
      score: entry.score,
      weight: criterion.weight,
      note: entry.evidenceNote.trim(),
    };
  });

  const value = breakdown.reduce((sum, item) => sum + item.score * item.weight, 0);

  return { ok: true, value: Math.round(value * 100) / 100, breakdown };
}

/**
 * Validate that an arbitrary (e.g. already-published) weighted breakdown sums to 1.0.
 * Used by `review:validate` against live MDX frontmatter, which may carry a different
 * criterion set than the canonical automation-tool protocol (e.g. Clay's data-enrichment
 * breakdown), so this checks the *shape* only, not specific ids.
 */
export function weightsSumToOne(breakdown) {
  if (!Array.isArray(breakdown) || breakdown.length === 0) return { ok: true };
  const weighted = breakdown.filter((item) => typeof item.weight === 'number');
  if (weighted.length === 0) return { ok: true }; // no weights declared, nothing to check
  if (weighted.length !== breakdown.length) {
    return {
      ok: false,
      reason: `${breakdown.length - weighted.length} of ${breakdown.length} breakdown entries are missing a weight`,
    };
  }
  const sum = weighted.reduce((total, item) => total + item.weight, 0);
  if (Math.abs(sum - 1) > WEIGHT_EPSILON) {
    return { ok: false, reason: `breakdown weights sum to ${sum}, expected 1.0` };
  }
  return { ok: true };
}
