#!/usr/bin/env node
/**
 * Review-production validation gate.
 *
 * Scans every file in src/content/reviews/ and fails (non-zero exit) when a review makes
 * claims it cannot back up. This is deliberately independent of `scripts/review-intake.mjs`:
 * an editor can hand-edit a generated MDX file, and this command re-checks the *published
 * artifact* rather than trusting that the generator's guarantees still hold.
 *
 * USAGE
 *   npm run review:validate                 # human-readable report; exits 1 on any failure
 *   npm run review:validate -- --json       # machine-readable report
 *
 * BACKWARD COMPATIBILITY
 * Two tiers of "hands-on" review coexist in this codebase:
 *   - Legacy reviews (e.g. clay-review.mdx) carry only a `testing` block. They predate the
 *     outsourced-review intake pipeline and never had fields like `workflowsTested` or
 *     `provenance`. These get the checks that already applied to them (valid dates, hours,
 *     methodology) plus soft warnings for new-but-optional fields — never hard failures for
 *     information the original schema never asked them to record.
 *   - Pipeline reviews carry a `provenance` block, written by `scripts/review-intake.mjs`.
 *     These get the full strict rule set from the task spec: workflows required, pricing
 *     sources with a checked date, evidence files that actually exist, affiliate
 *     disclosure, and an editorial-approval gate before publication.
 *
 * FAILS WHEN:
 *   - a hands-on (provenance-bearing) review has no test dates, hours, workflows, or
 *     methodology
 *   - a rating has criterion-level evidence missing (a breakdown entry with no note)
 *   - weighted criteria do not total 1.0
 *   - a pricing claim has no official source and checked date
 *   - public tester attribution lacks authorization
 *   - a review claims screenshots/evidence that do not exist
 *   - a published (non-draft) provenance-bearing review has not received editorial approval
 *   - affiliate relationships are not disclosed
 *   - a product/tool reference does not exist
 */
import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readMdx } from './lib/mdx-frontmatter.mjs';
import { weightsSumToOne } from './lib/testing-protocol.mjs';
import { loadTools, REVIEWS_DIR, PUBLIC_EVIDENCE_DIR, ROOT } from './lib/tools.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--json') args.json = true;
  }
  return args;
}

async function fileExists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

export async function collectReviewFiles(dir = REVIEWS_DIR) {
  try {
    const names = await readdir(dir);
    return names
      .filter((name) => name.endsWith('.md') || name.endsWith('.mdx'))
      .map((name) => path.join(dir, name));
  } catch {
    return [];
  }
}

/**
 * Validate a single review file's frontmatter against the rule set documented at the top of
 * this module. Exported (with an injectable `evidenceDir`) so the test suite can exercise
 * every failure mode against throwaway fixtures instead of real committed content.
 */
export async function validateFile(filepath, tools, seenToolIds, evidenceDir = PUBLIC_EVIDENCE_DIR) {
  const errors = [];
  const warnings = [];
  const relPath = path.relative(ROOT, filepath);

  const source = await readFile(filepath, 'utf8');
  const parsed = readMdx(source);
  if (!parsed) {
    errors.push('File has no parseable YAML frontmatter block.');
    return { file: relPath, errors, warnings };
  }
  const fm = parsed.frontmatter;

  // ---- tool reference exists ----
  const toolId = typeof fm.tool === 'string' ? fm.tool : fm.tool?.id;
  if (!toolId) {
    errors.push('Missing `tool` reference.');
  } else if (!tools.has(toolId)) {
    errors.push(`\`tool: ${toolId}\` does not exist in src/content/tools/tools.json.`);
  }

  // ---- duplicate review detection (one review per tool) ----
  if (toolId) {
    if (seenToolIds.has(toolId)) {
      errors.push(
        `Duplicate review: another review file already targets tool "${toolId}" (${seenToolIds.get(toolId)}). Only one review per tool is supported.`,
      );
    } else {
      seenToolIds.set(toolId, relPath);
    }
  }

  const hasTesting = Boolean(fm.testing);
  const hasProvenance = Boolean(fm.provenance);

  // ---- rating breakdown weight + evidence checks (applies to ANY review with a breakdown,
  //      legacy or new — every published breakdown entry must already carry a `note`) ----
  if (fm.rating?.breakdown) {
    const weightCheck = weightsSumToOne(fm.rating.breakdown);
    if (!weightCheck.ok) {
      errors.push(`rating.breakdown weights are invalid: ${weightCheck.reason}`);
    }
    for (const item of fm.rating.breakdown) {
      if (!item.note || String(item.note).trim().length === 0) {
        errors.push(`rating.breakdown criterion "${item.criterion}" has no evidence note.`);
      }
    }
  }

  // ---- testing metadata: checks that applied even to legacy reviews ----
  if (hasTesting) {
    const testing = fm.testing;
    if (!testing.periodStart || !testing.periodEnd) {
      errors.push('Hands-on review is missing testing.periodStart/periodEnd.');
    } else if (new Date(testing.periodEnd) < new Date(testing.periodStart)) {
      errors.push('testing.periodEnd is before testing.periodStart.');
    }
    if (typeof testing.hoursTested !== 'number' || testing.hoursTested <= 0) {
      errors.push('Hands-on review is missing a positive testing.hoursTested.');
    }
    if (!testing.methodology || testing.methodology.trim().length < 20) {
      errors.push('Hands-on review is missing a substantive testing.methodology.');
    }
    if (!testing.planTested) {
      errors.push('Hands-on review is missing testing.planTested.');
    }

    const hasWorkflows = Array.isArray(testing.workflowsTested) && testing.workflowsTested.length > 0;
    if (!hasWorkflows) {
      if (hasProvenance) {
        // Went through the intake pipeline, which requires this field upstream — a
        // provenance-bearing review missing it means the file was hand-edited afterward.
        errors.push('Hands-on review is missing testing.workflowsTested (at least one entry).');
      } else {
        // Legacy review written before this field existed. Soft nudge, not a build break.
        warnings.push(
          'testing.workflowsTested is not set. Consider adding the named workflows that were tested (new optional field; not required for legacy reviews).',
        );
      }
    }
  }

  // ---- attribution authorization (applies whenever `attribution` is present) ----
  const attribution = fm.attribution;
  if (attribution) {
    if (attribution.mode === 'named') {
      if (!attribution.authorized) {
        errors.push(
          'attribution.mode is "named" but attribution.authorized is not true — public attribution requires explicit authorization.',
        );
      }
      if (!attribution.displayName) {
        errors.push('attribution.mode is "named" but attribution.displayName is missing.');
      }
      if (
        attribution.displayName &&
        attribution.displayName.trim().toLowerCase() === 'independent contractor'
      ) {
        errors.push(
          'attribution.mode is "named" but displayName is the anonymous placeholder "Independent contractor" — use mode: "anonymous" instead.',
        );
      }
    } else if (attribution.mode === 'anonymous' && attribution.displayName) {
      warnings.push(
        'attribution.mode is "anonymous" but a displayName is set; it will not be rendered, but remove it to avoid confusion.',
      );
    }
  }

  // ---- the following checks apply only to reviews that went through the intake pipeline
  //      (i.e. carry a `provenance` block). Legacy content was never asked for this data
  //      and must not be broken by requiring it retroactively. ----
  if (hasProvenance) {
    const provenance = fm.provenance;

    // pricing claims need an official source + checked date
    const hasPricingTable = Array.isArray(fm.pricing) && fm.pricing.length > 0;
    const pricingSources = provenance.pricingSources ?? [];
    if (hasPricingTable && pricingSources.length === 0) {
      errors.push(
        'Review publishes a `pricing` table but provenance.pricingSources has no entries with a source URL and checked date.',
      );
    }
    for (const [index, source] of pricingSources.entries()) {
      if (!source.sourceUrl) errors.push(`provenance.pricingSources[${index}] is missing sourceUrl.`);
      if (!source.checkedDate) errors.push(`provenance.pricingSources[${index}] is missing checkedDate.`);
    }

    // evidence refs must exist on disk and be public/sanitized paths
    const evidenceRefs = provenance.evidenceRefs ?? [];
    for (const ref of evidenceRefs) {
      if (!ref.publicPath || ref.publicPath.startsWith('/') || ref.publicPath.includes('..')) {
        errors.push(
          `Evidence reference "${ref.description}" has an invalid publicPath "${ref.publicPath}" (must be a relative, non-traversing path).`,
        );
        continue;
      }
      const full = path.join(evidenceDir, ref.publicPath);
      // eslint-disable-next-line no-await-in-loop
      if (!(await fileExists(full))) {
        errors.push(
          `Review claims evidence "${ref.description}" at public-evidence/${ref.publicPath}, but that file does not exist.`,
        );
      }
    }

    // affiliate relationship disclosure
    const tool = tools.get(toolId);
    const toolHasAffiliate = Boolean(tool?.affiliateUrl);
    const affiliateRel = provenance.affiliateRelationship;
    if (toolHasAffiliate && !affiliateRel?.disclosed) {
      errors.push(
        `Tool "${toolId}" has an affiliate relationship (affiliateUrl in tools.json) but provenance.affiliateRelationship.disclosed is not true.`,
      );
    }

    // editorial approval gate for published (non-draft) reviews
    if (fm.draft !== true) {
      if (provenance.editorialApprovalStatus !== 'approved') {
        errors.push(
          `Review is published (draft is not true) but provenance.editorialApprovalStatus is "${provenance.editorialApprovalStatus ?? 'missing'}", not "approved".`,
        );
      }
      if (provenance.certifiedAccurate !== true) {
        errors.push(
          'Review is published but provenance.certifiedAccurate is not true — the tester certification is required before publication.',
        );
      }
    }
  }

  return { file: relPath, errors, warnings };
}

async function main() {
  const args = parseArgs(process.argv);
  const toolList = await loadTools();
  const tools = new Map(toolList.map((tool) => [tool.id, tool]));

  const files = await collectReviewFiles();
  const seenToolIds = new Map();

  const results = [];
  for (const filepath of files) {
    // eslint-disable-next-line no-await-in-loop
    const result = await validateFile(filepath, tools, seenToolIds);
    results.push(result);
  }

  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

  if (args.json) {
    console.log(JSON.stringify({ files: results, totalErrors, totalWarnings }, null, 2));
  } else {
    console.log(`\nReview validation — ${files.length} file(s) inspected\n`);
    for (const result of results) {
      if (result.errors.length === 0 && result.warnings.length === 0) {
        console.log(`  ✓ ${result.file}`);
        continue;
      }
      console.log(`  ${result.errors.length > 0 ? '✗' : '!'} ${result.file}`);
      for (const error of result.errors) console.log(`      ERROR: ${error}`);
      for (const warning of result.warnings) console.log(`      WARN:  ${warning}`);
    }
    console.log('');
    if (totalErrors > 0) {
      console.error(`Validation failed: ${totalErrors} error(s), ${totalWarnings} warning(s).\n`);
    } else {
      console.log(`✓ All reviews passed validation (${totalWarnings} warning(s)).\n`);
    }
  }

  if (totalErrors > 0) process.exit(1);
}

// Only run the CLI when this file is executed directly (`node scripts/review-validate.mjs`),
// not when its functions are imported by the test suite — importing must never have the
// side effect of scanning real content or calling process.exit.
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
