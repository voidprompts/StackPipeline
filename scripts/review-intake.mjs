#!/usr/bin/env node
/**
 * Outsourced-review intake CLI.
 *
 * Reads a contractor's completed intake JSON (see the intake schema in
 * scripts/lib/intake-schema.mjs and the example at
 * docs/review-production/example-intake.sample.json), validates it, computes the weighted
 * rating from the scorecard, and writes a `draft: true` review MDX file for human editorial
 * review. It never publishes anything itself — see docs/review-production/WORKFLOW.md for
 * the human approval step that must follow.
 *
 * USAGE
 *   npm run review:intake -- --file path/to/intake.json
 *   npm run review:intake -- --file path/to/intake.json --out my-custom-slug.mdx
 *   npm run review:intake -- --file path/to/intake.json --force   # overwrite existing review
 *
 * GUARANTEES
 *   - Rejects the run entirely (non-zero exit, no file written) on any schema violation,
 *     missing evidence, contradictory dates, unauthorized attribution, or undisclosed
 *     affiliate relationship.
 *   - Never fabricates prose: every paragraph in the generated MDX is built by directly
 *     quoting/listing intake fields, not by inventing language to fill gaps.
 *   - Always writes `draft: true` — nothing this script produces is ever build-eligible as
 *     a published page without a human removing that flag.
 *   - Refuses to overwrite an existing review file unless `--force` is passed explicitly.
 */
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseIntake } from './lib/intake-schema.mjs';
import { computeWeightedScore, SCORECARD_CRITERIA } from './lib/testing-protocol.mjs';
import { writeMdx } from './lib/mdx-frontmatter.mjs';
import { findTool, REVIEWS_DIR, PUBLIC_EVIDENCE_DIR, ROOT } from './lib/tools.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--force') args.force = true;
    else if (arg === '--file') args.file = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
  }
  return args;
}

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

/** 10-44 chars, matches src/content.config.ts editorialBase.title. */
function buildTitle(toolName) {
  const candidate = `${toolName} Review: Hands-On Testing`;
  if (candidate.length <= 44) return candidate;
  const fallback = `${toolName} Review (Hands-On)`;
  return fallback.length <= 44 ? fallback : `${toolName} Review`.slice(0, 44);
}

/** 50-155 chars, matches src/content.config.ts editorialBase.description. */
function buildDescription(toolName, testing) {
  const hours = testing.hoursTested;
  const workflowCount = testing.workflowsTested.length;
  const candidates = [
    `${toolName} tested hands-on for ${hours} hours across ${workflowCount} real workflows on the ${testing.planTested} plan. Findings, not marketing copy.`,
    `Hands-on ${toolName} testing notes: ${hours} hours, ${workflowCount} workflows, tested on the ${testing.planTested} plan.`,
    `We spent ${hours} hours testing ${toolName} on the ${testing.planTested} plan. Here is what we actually found.`,
  ];
  const fit = candidates.find((text) => text.length >= 50 && text.length <= 155);
  if (fit) return fit;
  // Every candidate was rejected on length (very long tool/plan names) — fall back to a
  // fixed-shape sentence that stays within bounds regardless of interpolated length.
  return `We tested ${toolName} hands-on for ${hours} hours. Full findings, methodology and evidence below.`.slice(
    0,
    155,
  );
}

/** 40-400 chars. Built only from intake fields — no invented language. */
function buildVerdict({ toolName, advantages, limitations }) {
  const pro = advantages[0];
  const con = limitations[0];
  const candidate = `Hands-on testing found: ${pro}. Set against that: ${con}. See the full scorecard and evidence below before deciding whether ${toolName} fits your workflow.`;
  if (candidate.length <= 400) return candidate;
  return candidate.slice(0, 397) + '...';
}

function formatEvidenceLine(item) {
  return item.trim();
}

async function fileExists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function verifyEvidenceRefs(intake) {
  const problems = [];
  for (const ref of intake.evidenceRefs) {
    const full = path.join(PUBLIC_EVIDENCE_DIR, ref.publicPath);
    // eslint-disable-next-line no-await-in-loop
    if (!(await fileExists(full))) {
      problems.push(
        `evidenceRefs entry "${ref.description}" points to public-evidence/${ref.publicPath}, which does not exist. Sanitize and place the asset there first — see docs/review-production/evidence-sanitization.md.`,
      );
    }
  }
  return problems;
}

function renderBody({ intake, tool, attributionLine }) {
  const lines = [];
  lines.push(attributionLine);
  lines.push('');
  lines.push(
    `<Callout variant="note" title="What this review is">`,
  );
  lines.push(
    `Hands-on testing ran from ${intake.testing.periodStart} to ${intake.testing.periodEnd} (${intake.testing.hoursTested} hours) on the ${intake.testing.planTested} plan. This draft has not yet received editorial approval — see the frontmatter \`provenance.editorialApprovalStatus\` field.`,
  );
  lines.push('</Callout>');
  lines.push('');
  lines.push('## Methodology');
  lines.push('');
  lines.push(intake.testing.methodology);
  lines.push('');
  lines.push('## Workflows tested');
  lines.push('');
  for (const workflow of intake.testing.workflowsTested) {
    lines.push(`- ${formatEvidenceLine(workflow)}`);
  }
  lines.push('');
  if (intake.quantitativeFindings.length > 0) {
    lines.push('## Quantitative findings');
    lines.push('');
    for (const finding of intake.quantitativeFindings) {
      lines.push(`- ${formatEvidenceLine(finding)}`);
    }
    lines.push('');
  }
  lines.push('## What worked');
  lines.push('');
  for (const item of intake.advantages) {
    lines.push(`- ${formatEvidenceLine(item)}`);
  }
  lines.push('');
  lines.push('## What did not work');
  lines.push('');
  for (const item of intake.limitations) {
    lines.push(`- ${formatEvidenceLine(item)}`);
  }
  lines.push('');
  if (intake.reliabilityIssues.length > 0) {
    lines.push('## Errors and reliability issues observed');
    lines.push('');
    for (const item of intake.reliabilityIssues) {
      lines.push(`- ${formatEvidenceLine(item)}`);
    }
    lines.push('');
  }
  if (intake.supportInteractions.length > 0) {
    lines.push('## Support interactions');
    lines.push('');
    for (const item of intake.supportInteractions) {
      lines.push(`- ${formatEvidenceLine(item)}`);
    }
    lines.push('');
  }
  if (intake.comparisonProducts.length > 0) {
    lines.push('## Compared against');
    lines.push('');
    lines.push(
      `During testing, ${tool.name} was evaluated alongside: ${intake.comparisonProducts.join(', ')}.`,
    );
    lines.push('');
  }
  lines.push('## Pricing sources');
  lines.push('');
  for (const source of intake.pricingSources) {
    lines.push(`- ${source.claim} — [source](${source.sourceUrl}), checked ${source.checkedDate}`);
  }
  lines.push('');
  lines.push('## Official sources');
  lines.push('');
  for (const url of intake.officialSourceUrls) {
    lines.push(`- ${url}`);
  }
  lines.push('');
  if (intake.evidenceRefs.length > 0) {
    lines.push('## Evidence');
    lines.push('');
    lines.push(
      '_Screenshots and other evidence referenced below are sanitized public assets — see the sanitization process in `docs/review-production/evidence-sanitization.md`._',
    );
    lines.push('');
    for (const ref of intake.evidenceRefs) {
      lines.push(`- ${ref.description} (\`public-evidence/${ref.publicPath}\`)`);
    }
    lines.push('');
  }
  lines.push(
    `_Conflicts of interest: ${intake.conflictsOfInterest}_`,
  );
  lines.push('');
  lines.push(
    `_This draft awaits editorial approval before publication. An editor must verify every claim above against the cited sources and evidence, then set \`provenance.editorialApprovalStatus: approved\` and remove \`draft: true\` — see \`docs/review-production/editor-approval-checklist.md\`._`,
  );
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.file) {
    fail('Usage: npm run review:intake -- --file path/to/intake.json [--out slug.mdx] [--force]');
  }

  let raw;
  try {
    raw = await readFile(path.resolve(process.cwd(), args.file), 'utf8');
  } catch (error) {
    fail(`Could not read intake file "${args.file}": ${error.message}`);
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    fail(`Intake file is not valid JSON: ${error.message}`);
  }

  const result = parseIntake(json);
  if (!result.ok) {
    console.error(`\n✗ Intake file failed validation (${result.issues.length} issue(s)):\n`);
    for (const issue of result.issues) {
      console.error(`  - [${issue.path || '(root)'}] ${issue.message}`);
    }
    console.error('\nNo review draft was generated. Fix the intake file and re-run.\n');
    process.exit(1);
  }

  const intake = result.data;

  const tool = await findTool(intake.toolId);
  if (!tool) {
    fail(
      `toolId "${intake.toolId}" does not exist in src/content/tools/tools.json. Add the tool there first — see docs/review-production/adding-a-new-tool.md.`,
    );
  }

  const evidenceProblems = await verifyEvidenceRefs(intake);
  if (evidenceProblems.length > 0) {
    console.error(`\n✗ Evidence verification failed:\n`);
    for (const problem of evidenceProblems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  const scored = intake.scorecard.map((entry) => ({
    criterionId: entry.criterionId,
    score: entry.score,
    evidenceNote: entry.evidenceNote,
  }));
  const scoreResult = computeWeightedScore(scored);
  if (!scoreResult.ok) {
    console.error('\n✗ Could not compute a weighted rating from the scorecard:\n');
    if (scoreResult.missing.length) {
      console.error(`  Missing criteria: ${scoreResult.missing.join(', ')}`);
    }
    for (const reason of scoreResult.reasons) console.error(`  - ${reason}`);
    console.error('\nNo score will be fabricated. Complete the scorecard and re-run.\n');
    process.exit(1);
  }

  const slug = args.out ?? `${tool.slug}-review.mdx`;
  const named = slug.endsWith('.mdx') ? slug : `${slug}.mdx`;
  // An absolute --out path is used as-is (handy for previewing a draft outside
  // src/content/reviews/ without touching real content). A bare filename resolves inside
  // the reviews collection, same as the default behaviour.
  const outPath = path.isAbsolute(named) ? named : path.join(REVIEWS_DIR, named);

  if (!args.force && (await fileExists(outPath))) {
    fail(
      `${path.relative(ROOT, outPath)} already exists. Pass --force to overwrite, or --out to write a different filename.`,
    );
  }

  const attributionMode = intake.tester.publicAttributionAuthorized ? 'named' : 'anonymous';
  const attributionLine =
    attributionMode === 'named'
      ? `Tested by ${intake.tester.name}, edited by StackPipeline Editorial Team.`
      : 'Hands-on testing was conducted by an independent contractor following the StackPipeline testing protocol.';

  const today = new Date().toISOString().slice(0, 10);

  const frontmatter = {
    title: buildTitle(tool.name),
    description: buildDescription(tool.name, intake.testing),
    heading: `${tool.name} Review: ${intake.testing.hoursTested} Hours of Hands-On Testing`,
    schemaType: 'Review',
    tool: tool.id,
    publishDate: today,
    updatedDate: today,
    // Draft by design — see the module doc comment. A human must flip this after review.
    draft: true,
    featured: false,
    tags: [tool.name, tool.category, 'Hands-on review'],
    rating: {
      value: scoreResult.value,
      best: 5,
      count: 1,
      breakdown: scoreResult.breakdown,
    },
    verdict: buildVerdict({
      toolName: tool.name,
      advantages: intake.advantages,
      limitations: intake.limitations,
    }),
    prosCons: {
      pros: intake.advantages.slice(0, 12),
      cons: intake.limitations.slice(0, 12),
    },
    bestFor: [],
    notFor: [],
    pricing: [],
    testing: {
      hoursTested: intake.testing.hoursTested,
      planTested: intake.testing.planTested,
      periodStart: intake.testing.periodStart,
      periodEnd: intake.testing.periodEnd,
      methodology: intake.testing.methodology,
      workflowsTested: intake.testing.workflowsTested,
    },
    attribution: {
      mode: attributionMode,
      authorized: intake.tester.publicAttributionAuthorized,
      ...(attributionMode === 'named' ? { displayName: intake.tester.name } : {}),
      role: intake.tester.role,
      relevantExperience: intake.tester.relevantExperience,
    },
    provenance: {
      schemaVersion: 1,
      officialSourceUrls: intake.officialSourceUrls,
      pricingSources: intake.pricingSources,
      comparisonProducts: intake.comparisonProducts,
      evidenceRefs: intake.evidenceRefs,
      conflictsOfInterest: intake.conflictsOfInterest,
      affiliateRelationship: {
        disclosed: intake.affiliateRelationship.disclosed,
        detail: intake.affiliateRelationship.detail,
      },
      editorialApprovalStatus: 'pending',
      certifiedAccurate: intake.tester.certifiesAccurate,
    },
  };

  const body = `\nimport Callout from '@components/ui/Callout.astro';\n\n${renderBody({ intake, tool, attributionLine })}\n`;

  const mdx = writeMdx({ frontmatter, body });

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, mdx, 'utf8');

  console.log(`\n✓ Draft review written to ${path.relative(ROOT, outPath)}`);
  console.log(`  Weighted rating: ${scoreResult.value} / 5 (from ${scoreResult.breakdown.length} evidenced criteria)`);
  console.log(`  draft: true — this file will NOT build as a published page until an editor:`);
  console.log(`    1. Reviews every claim against the cited sources and evidence`);
  console.log(`    2. Sets provenance.editorialApprovalStatus: approved`);
  console.log(`    3. Removes draft: true`);
  console.log(`  Run \`npm run review:validate\` before opening a PR.\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
