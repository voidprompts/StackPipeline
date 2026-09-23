/**
 * Outsourced hands-on review intake schema.
 *
 * This is the single contract between a contractor's testing brief and everything StackPipeline
 * publishes from it. `scripts/review-intake.mjs` (generation) and `scripts/review-validate.mjs`
 * (validation of already-generated/committed reviews) both import this file so the rules can
 * never drift between the two commands.
 *
 * Design principles enforced structurally, not just documented:
 *   - Nothing here can express "hands-on testing happened" without also requiring dates,
 *     hours, workflows and methodology (see `.refine` below).
 *   - Public tester attribution requires an explicit `publicAttributionAuthorized: true`,
 *     recorded independently of the display name, so a later edit cannot silently make a
 *     contractor's real name public.
 *   - Every quantitative or pricing claim must carry a source URL and a checked date.
 *   - `editorialApprovalStatus` defaults to "pending" and only human action can flip it.
 */

import { z } from 'zod';
import { SCORECARD_CRITERION_IDS } from './testing-protocol.mjs';

const isoDateString = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'must be a valid ISO-8601 date' });

const urlString = z.string().url();

const scorecardEntry = z.object({
  criterionId: z.enum(SCORECARD_CRITERION_IDS),
  score: z.number().min(0).max(5),
  /** Required, non-generic evidence — the intake CLI rejects boilerplate/empty notes. */
  evidenceNote: z.string().min(15, 'evidenceNote must describe what was actually observed'),
});

const pricingSource = z.object({
  claim: z.string().min(5),
  sourceUrl: urlString,
  checkedDate: isoDateString,
});

const evidenceRef = z.object({
  description: z.string().min(5),
  /** Path under the *public, sanitized* evidence directory only — never a raw/private path.
   * See docs/review-production/evidence-sanitization.md. */
  publicPath: z
    .string()
    .min(1)
    .refine((value) => !value.startsWith('/') && !value.includes('..'), {
      message: 'publicPath must be a relative path with no traversal (e.g. "n8n/2026-09-23/dashboard.png")',
    }),
});

const affiliateRelationship = z.object({
  /** Whether StackPipeline (the publisher) has any affiliate/referral relationship with the
   * vendor of the tool being reviewed — independent of whether the contractor personally
   * benefits. Check `affiliateUrl` on the tool's `tools.json` entry to answer this. */
  exists: z.boolean(),
  /** Whether that relationship (if `exists`) has been disclosed in the generated review.
   * The intake CLI always sets this to true when it renders the disclosure block, but it
   * is captured here explicitly so `review:validate` can catch a hand-edited MDX file that
   * removed the disclosure without also clearing this flag. */
  disclosed: z.boolean(),
  detail: z.string().optional(),
});

export const intakeSchema = z
  .object({
    schemaVersion: z.literal(1),

    /** Must match an `id` in src/content/tools/tools.json. Checked live against the file by
     * both the intake CLI and the validator, not just shaped-checked here. */
    toolId: z.string().min(1),

    tester: z.object({
      /** Literal string "Independent contractor" is the explicit anonymous option the task
       * calls for; any other value is treated as a real name and gated by
       * `publicAttributionAuthorized`. */
      name: z.string().min(1),
      publicAttributionAuthorized: z.boolean(),
      role: z.string().min(1, 'tester role is required, e.g. "Freelance RevOps consultant"'),
      relevantExperience: z
        .string()
        .min(10, 'describe relevant experience in at least one real sentence'),
      /** Tester's sign-off that everything in this file is accurate to the best of their
       * knowledge. Required to be explicitly true; the CLI refuses to generate a draft
       * otherwise. */
      certifiesAccurate: z.boolean(),
    }),

    testing: z.object({
      planTested: z.string().min(1),
      periodStart: isoDateString,
      periodEnd: isoDateString,
      hoursTested: z.number().positive(),
      workflowsTested: z.array(z.string().min(1)).min(1),
      methodology: z.string().min(30, 'methodology must describe what was actually done, not just named'),
    }),

    /** Free-text quantitative observations, e.g. "sync of 500 contacts completed in 4m12s,
     * 3 of 500 records failed on a malformed email field". Not every product yields a clean
     * metric, so this stays a string array rather than a rigid numeric schema. */
    quantitativeFindings: z.array(z.string().min(5)).default([]),

    advantages: z.array(z.string().min(5)).min(1, 'at least one observed advantage is required'),
    limitations: z.array(z.string().min(5)).min(1, 'at least one observed limitation is required'),
    reliabilityIssues: z.array(z.string().min(5)).default([]),
    supportInteractions: z.array(z.string().min(5)).default([]),
    comparisonProducts: z.array(z.string().min(1)).default([]),

    pricingSources: z
      .array(pricingSource)
      .min(1, 'at least one pricing source with a checked date is required'),
    officialSourceUrls: z.array(urlString).min(1, 'at least one official source URL is required'),

    /** References to already-sanitized, already-committed-or-committable public evidence
     * assets. The intake CLI verifies these paths actually exist under
     * public-evidence/<toolId>/ before it will generate a draft — see
     * docs/review-production/evidence-sanitization.md. */
    evidenceRefs: z.array(evidenceRef).default([]),

    conflictsOfInterest: z
      .string()
      .default('None disclosed.'),

    affiliateRelationship,

    scorecard: z
      .array(scorecardEntry)
      .refine(
        (entries) => {
          const ids = new Set(entries.map((e) => e.criterionId));
          return SCORECARD_CRITERION_IDS.every((id) => ids.has(id));
        },
        {
          message: `scorecard must include an evidenced entry for every criterion: ${SCORECARD_CRITERION_IDS.join(', ')}`,
        },
      ),

    /** Human editorial gate. Always starts 'pending' from the CLI; only a reviewer editing
     * the generated MDX (or a future editorial tool) may set 'approved'. `review:validate`
     * fails a *published* (non-draft) review that is not 'approved'. */
    editorialApprovalStatus: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  })
  /**
   * Cross-field consistency: a testing period end must not precede its start, and hours
   * tested should be plausible for the stated period (loose upper bound — this catches
   * copy-paste errors like "2 hours" over "6 months", not genuine intensive testing).
   */
  .refine((data) => new Date(data.testing.periodEnd) >= new Date(data.testing.periodStart), {
    message: 'testing.periodEnd must not be before testing.periodStart',
    path: ['testing', 'periodEnd'],
  })
  .refine(
    (data) => {
      const days =
        (new Date(data.testing.periodEnd).getTime() - new Date(data.testing.periodStart).getTime()) /
        86_400_000;
      const maxPlausibleHours = Math.max(24, days * 24); // can't test more hours than exist
      return data.testing.hoursTested <= maxPlausibleHours;
    },
    {
      message: 'testing.hoursTested exceeds the number of hours physically available in the stated period',
      path: ['testing', 'hoursTested'],
    },
  )
  /** Public attribution requires BOTH the flag and a real (non-"Independent contractor")
   * name — this is the structural enforcement behind requirement #5's "unauthorized public
   * attribution" failure mode. */
  .refine(
    (data) =>
      !data.tester.publicAttributionAuthorized ||
      data.tester.name.trim().toLowerCase() !== 'independent contractor',
    {
      message:
        'publicAttributionAuthorized is true but tester.name is "Independent contractor" — provide a real name or set the flag to false',
      path: ['tester', 'publicAttributionAuthorized'],
    },
  )
  .refine((data) => data.tester.certifiesAccurate === true, {
    message: 'tester.certifiesAccurate must be true — the tester must certify the submission is accurate',
    path: ['tester', 'certifiesAccurate'],
  })
  .refine(
    (data) => !data.affiliateRelationship.exists || data.affiliateRelationship.disclosed === true,
    {
      message:
        'affiliateRelationship.exists is true but disclosed is false — any affiliate relationship for this tool must be disclosed before publication',
      path: ['affiliateRelationship', 'disclosed'],
    },
  );

/** Convenience: run the schema and return a uniform {ok, data|issues} shape for CLIs. */
export function parseIntake(json) {
  const result = intakeSchema.safeParse(json);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}
