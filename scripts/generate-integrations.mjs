#!/usr/bin/env node
/**
 * Programmatic integration page generator.
 *
 * Reads the tool directory, produces "How to connect A to B" MDX files for the pairs you
 * request, and writes them into src/content/integrations/. Output conforms exactly to the
 * Zod schema in src/content.config.ts, so a bad run fails at build time rather than
 * shipping broken pages.
 *
 * USAGE
 *   node scripts/generate-integrations.mjs --pairs zapier:hubspot,make:salesforce
 *   node scripts/generate-integrations.mjs --matrix zapier,make,n8n --targets hubspot,salesforce
 *   node scripts/generate-integrations.mjs --all --limit 50
 *   node scripts/generate-integrations.mjs --all --dry-run
 *
 * FLAGS
 *   --pairs     Explicit sourceSlug:targetSlug list, comma separated
 *   --matrix    Source tool slugs (cross-joined with --targets)
 *   --targets   Target tool slugs for --matrix mode
 *   --all       Every automation-platform -> every other tool permutation
 *   --limit     Cap the number of files written (default 100)
 *   --author    Author slug for the byline (default: dana-whitfield)
 *   --reviewer  Author slug for the fact-check byline (default: priya-raghunathan)
 *   --force     Overwrite files that already exist (default: skip)
 *   --dry-run   Print what would be written without touching disk
 *
 * DESIGN NOTE
 * Generated pages are scaffolds with real structural value — method comparison, steps,
 * troubleshooting, FAQ — but they are deliberately marked `draft: true`. Publishing
 * hundreds of untouched template pages is exactly what Google's scaled-content-abuse
 * policy targets. The intended workflow is: generate, then have an author verify and
 * flip the draft flag per page.
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS_PATH = path.join(ROOT, 'src/content/tools/tools.json');
const OUT_DIR = path.join(ROOT, 'src/content/integrations');

/** Tool categories treated as automation platforms (valid "source" side of a pair). */
const AUTOMATION_CATEGORIES = new Set(['Workflow automation']);

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { limit: 100, author: 'dana-whitfield', reviewer: 'priya-raghunathan' };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    const takesValue = next && !next.startsWith('--');

    switch (key) {
      case 'all':
      case 'force':
      case 'dry-run':
        args[key === 'dry-run' ? 'dryRun' : key] = true;
        break;
      case 'limit':
        args.limit = Number(next);
        i += 1;
        break;
      default:
        if (takesValue) {
          args[key] = next;
          i += 1;
        }
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Content helpers
// ---------------------------------------------------------------------------

/** Escape a value for safe inclusion in double-quoted YAML. */
function yamlString(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Title must stay <= 44 chars so "<title> | StackPipeline" fits in 60. */
function buildTitle(a, b) {
  const full = `Connect ${a.name} to ${b.name}`;
  if (full.length <= 44) return full;
  const short = `${a.name} to ${b.name}`;
  return short.length <= 44 ? short : short.slice(0, 43).trimEnd();
}

/** Description must be 50-155 chars to satisfy the schema. */
function buildDescription(a, b) {
  const candidates = [
    `Step-by-step guide to connecting ${a.name} to ${b.name}: triggers, field mapping, deduplication and the errors that break most setups.`,
    `How to sync data between ${a.name} and ${b.name} without duplicates. Setup steps, field mapping and troubleshooting from hands-on testing.`,
    `Connect ${a.name} to ${b.name} in minutes. Trigger setup, field mapping, rate limits and fixes for the most common sync failures.`,
  ];
  const fit = candidates.find((text) => text.length >= 50 && text.length <= 155);
  return fit ?? candidates[2].slice(0, 155);
}

function buildSteps(a, b) {
  return [
    {
      name: `Connect your ${a.name} account`,
      text: `Sign in to ${a.name} and create a new workflow. Authorise the connection to ${b.name} using an account with permission to create and update records — using a personal account here is the most common cause of permission errors later.`,
      tip: `Use a dedicated service account rather than a personal login so the integration survives staff changes.`,
    },
    {
      name: 'Choose the trigger event',
      text: `Select the event in ${a.name} that should start the workflow. Prefer a specific, condition-based trigger over a generic "record updated" event — narrow triggers dramatically reduce noise and cost.`,
    },
    {
      name: 'Add a lookup step to prevent duplicates',
      text: `Before writing anything to ${b.name}, add a search action that checks whether the record already exists. Match on email address or another unique identifier. Skipping this step is the single most common reason these syncs become unusable.`,
      tip: 'Deduplicate on a stable unique key such as email. Never match on name or company.',
    },
    {
      name: `Map fields to ${b.name}`,
      text: `Map each source field to its destination property in ${b.name}. Use internal API field names rather than display labels — most platforms silently drop mismatched mappings instead of erroring.`,
    },
    {
      name: 'Filter out junk records',
      text: `Add a filter that requires the key fields to be present and excludes test or role-based addresses. Filtering before the write keeps your ${b.name} record count — and the bill attached to it — clean.`,
    },
    {
      name: 'Test with real data, then enable',
      text: `Run a test with an actual record and verify every mapped field landed correctly in ${b.name}, including custom properties. Then enable the workflow and monitor the run history for the first 24 hours.`,
    },
  ];
}

function buildTroubleshooting(a, b) {
  return [
    {
      problem: 'Records are created but custom fields are empty',
      fix: `You mapped a display label instead of the internal field name. Open the field settings in ${b.name}, copy the internal name, and remap in ${a.name}.`,
    },
    {
      problem: 'Duplicate records appear for the same person',
      fix: 'Your workflow is creating instead of upserting. Add a search step keyed on a unique identifier and switch the action to create-or-update.',
    },
    {
      problem: 'The workflow fails with a 429 rate limit error',
      fix: `${b.name} is throttling the request volume. Add a short delay between iterations or batch the operation rather than firing one call per record.`,
    },
    {
      problem: 'The workflow silently stopped running',
      fix: `Most platforms disable a workflow after repeated failures without emailing you. Open the run history in ${a.name}, resolve the underlying error and re-enable it.`,
    },
  ];
}

function buildFaq(a, b) {
  return [
    {
      question: `Can you connect ${a.name} to ${b.name} without code?`,
      answer: `Yes. ${a.name} provides a no-code connector for ${b.name}, so the entire workflow described here is built through the interface. You only need custom code for unusual data transformations.`,
    },
    {
      question: `How much does it cost to connect ${a.name} to ${b.name}?`,
      answer: `${a.name} starts at ${a.startingPrice}${a.freeTier ? ' and offers a free tier that covers basic single-step workflows' : ''}. ${b.name} starts at ${b.startingPrice}. A simple sync usually fits within entry-level plans.`,
    },
    {
      question: `Will this sync historical ${a.name} data to ${b.name}?`,
      answer: 'No. Trigger-based workflows only process records created or changed after the workflow is switched on. For a historical backfill, use a bulk import or a dedicated migration run.',
    },
    {
      question: `Is a two-way sync possible between ${a.name} and ${b.name}?`,
      answer: 'Yes, but it requires two separate workflows plus a guard condition to prevent an update loop. Add a "last modified by integration" flag and filter on it in both directions.',
    },
  ];
}

function buildMethods(a, b) {
  return [
    {
      name: `${a.name} (no-code)`,
      bestFor: 'Most teams — fastest path with no engineering time',
      setupTime: '15-20 min',
      cost: a.startingPrice,
      codeRequired: false,
    },
    {
      name: 'Native integration',
      bestFor: `Available if ${b.name} lists ${a.name} in its marketplace`,
      setupTime: '5 min',
      cost: 'Usually free',
      codeRequired: false,
    },
    {
      name: 'Direct API integration',
      bestFor: 'High volume or complex transformation logic',
      setupTime: '1-3 days',
      cost: 'Engineering time',
      codeRequired: true,
    },
  ];
}

/** Render one MDX file. */
function renderMdx({ a, b, author, reviewer, today }) {
  const steps = buildSteps(a, b);
  const troubleshooting = buildTroubleshooting(a, b);
  const faq = buildFaq(a, b);
  const methods = buildMethods(a, b);

  const yamlList = (items, indent = '  ') =>
    items.map((item) => `${indent}- ${yamlString(item)}`).join('\n');

  const stepsYaml = steps
    .map((step) => {
      const lines = [
        `  - name: ${yamlString(step.name)}`,
        `    text: ${yamlString(step.text)}`,
      ];
      if (step.tip) lines.push(`    tip: ${yamlString(step.tip)}`);
      return lines.join('\n');
    })
    .join('\n');

  const methodsYaml = methods
    .map((method) =>
      [
        `  - name: ${yamlString(method.name)}`,
        `    bestFor: ${yamlString(method.bestFor)}`,
        `    setupTime: ${yamlString(method.setupTime)}`,
        `    cost: ${yamlString(method.cost)}`,
        `    codeRequired: ${method.codeRequired}`,
      ].join('\n'),
    )
    .join('\n');

  const troubleshootingYaml = troubleshooting
    .map((row) =>
      [`  - problem: ${yamlString(row.problem)}`, `    fix: ${yamlString(row.fix)}`].join('\n'),
    )
    .join('\n');

  const faqYaml = faq
    .map((row) =>
      [`  - question: ${yamlString(row.question)}`, `    answer: ${yamlString(row.answer)}`].join(
        '\n',
      ),
    )
    .join('\n');

  const affiliateA = a.affiliateUrl
    ? `affiliateLinkA:\n  url: ${yamlString(a.affiliateUrl)}\n  label: ${yamlString(`Try ${a.name}`)}\n  campaign: ${yamlString(`${a.slug}-to-${b.slug}`)}\n`
    : '';
  const affiliateB = b.affiliateUrl
    ? `affiliateLinkB:\n  url: ${yamlString(b.affiliateUrl)}\n  label: ${yamlString(`Try ${b.name}`)}\n  campaign: ${yamlString(`${a.slug}-to-${b.slug}`)}\n`
    : '';

  return `---
title: ${yamlString(buildTitle(a, b))}
description: ${yamlString(buildDescription(a, b))}
heading: ${yamlString(`How to Connect ${a.name} to ${b.name}`)}
schemaType: "HowTo"
softwareA: ${yamlString(a.slug)}
softwareB: ${yamlString(b.slug)}
${affiliateA}${affiliateB}author: ${yamlString(author)}
reviewedBy: ${yamlString(reviewer)}
publishDate: ${today}
updatedDate: ${today}
useCase: ${yamlString(`Sync records from ${a.name} into ${b.name} automatically`)}
difficulty: "beginner"
totalTime: "PT15M"
estimatedCost:
  currency: "USD"
  value: 0
draft: true
tags:
${yamlList([a.name, b.name, a.category, 'Automation'])}
supplies:
${yamlList([`A ${a.name} account`, `A ${b.name} account with admin permissions`])}
tools:
${yamlList([a.name, b.name])}
methods:
${methodsYaml}
steps:
${stepsYaml}
troubleshooting:
${troubleshootingYaml}
faq:
${faqYaml}
relatedIntegrations: []
---

import Callout from '@components/ui/Callout.astro';

Connecting ${a.name} to ${b.name} takes about fifteen minutes. The setup below is the one
that survives contact with real data — most guides skip the deduplication step, which is
why so many of these syncs produce duplicate records within a month.

<Callout variant="shortcut" title="The short version">
Add a lookup step before the write action, deduplicate on a unique identifier, and filter
junk records before they reach ${b.name}. Those three decisions prevent most problems.
</Callout>

## Before you start

You need a ${a.name} account, a ${b.name} account with permission to create and update
records, and a decision about which field is your unique key. That last one is not
optional.

## What to monitor after launch

Check the run history daily for the first week. Watch for repeated failures on the same
record, which indicates a mapping problem, and for rising execution counts without a
matching rise in records, which indicates a filter problem.

<Callout variant="tip" title="Alert on failure">
Configure failure notifications before you need them. Silent failures are the reason most
integrations quietly drift out of trust.
</Callout>
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);
  const tools = JSON.parse(await readFile(TOOLS_PATH, 'utf8'));
  const bySlug = new Map(tools.map((tool) => [tool.slug, tool]));

  /** @type {Array<[string, string]>} */
  let pairs = [];

  if (args.pairs) {
    pairs = args.pairs.split(',').map((pair) => {
      const [source, target] = pair.split(':').map((value) => value.trim());
      return [source, target];
    });
  } else if (args.matrix && args.targets) {
    const sources = args.matrix.split(',').map((value) => value.trim());
    const targets = args.targets.split(',').map((value) => value.trim());
    for (const source of sources) {
      for (const target of targets) {
        if (source !== target) pairs.push([source, target]);
      }
    }
  } else if (args.all) {
    const sources = tools.filter((tool) => AUTOMATION_CATEGORIES.has(tool.category));
    for (const source of sources) {
      for (const target of tools) {
        if (source.slug !== target.slug) pairs.push([source.slug, target.slug]);
      }
    }
  } else {
    console.error(
      'Nothing to do. Pass --pairs a:b, --matrix a,b --targets c,d, or --all.\n' +
        'Run with --help semantics documented at the top of this file.',
    );
    process.exit(1);
  }

  pairs = pairs.slice(0, args.limit);

  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });

  const today = new Date().toISOString().slice(0, 10);
  let written = 0;
  let skipped = 0;
  const errors = [];

  for (const [sourceSlug, targetSlug] of pairs) {
    const a = bySlug.get(sourceSlug);
    const b = bySlug.get(targetSlug);

    if (!a || !b) {
      errors.push(`Unknown tool slug in pair ${sourceSlug}:${targetSlug}`);
      continue;
    }

    const filename = `${a.slug}-to-${b.slug}.mdx`;
    const filepath = path.join(OUT_DIR, filename);

    if (!args.force && existsSync(filepath)) {
      skipped += 1;
      continue;
    }

    const content = renderMdx({ a, b, author: args.author, reviewer: args.reviewer, today });

    if (args.dryRun) {
      console.log(`[dry-run] would write ${filename} (${content.length} bytes)`);
    } else {
      await writeFile(filepath, content, 'utf8');
      console.log(`✓ ${filename}`);
    }
    written += 1;
  }

  console.log(
    `\n${args.dryRun ? '[dry-run] ' : ''}${written} file(s) ${args.dryRun ? 'planned' : 'written'}, ${skipped} skipped (already exist).`,
  );

  if (errors.length) {
    console.warn(`\n${errors.length} problem(s):`);
    for (const error of errors) console.warn(`  - ${error}`);
  }

  if (written > 0 && !args.dryRun) {
    console.log(
      '\nGenerated pages are marked `draft: true` on purpose — they will not build until an\n' +
        'author reviews the content and removes the flag. Publishing untouched template pages\n' +
        "at scale is what Google's scaled-content-abuse policy targets.",
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
