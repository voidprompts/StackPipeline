import { defineCollection, reference, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

/**
 * StackPipeline content model.
 *
 * Designed so a generator script can emit hundreds of MDX files with zero manual editing:
 * every field a page needs is declared here, optional fields have sane defaults, and the
 * schema fails the build loudly when a programmatic run produces malformed frontmatter.
 */

/** Shared affiliate link object. `nofollow`/`sponsored` rel is applied at render time. */
const affiliateLink = z.object({
  url: z.string().url(),
  label: z.string().optional(),
  /** Vendor-side campaign identifier, useful for revenue attribution reports. */
  campaign: z.string().optional(),
});

/** A single pro/con bullet, kept as plain strings so schema.org can consume them directly. */
const prosCons = z.object({
  pros: z.array(z.string()).min(1).max(12),
  cons: z.array(z.string()).min(1).max(12),
});

/** Rating block feeding Review / AggregateRating JSON-LD. */
const rating = z.object({
  value: z.number().min(0).max(5),
  best: z.number().default(5),
  worst: z.number().default(0),
  count: z.number().int().positive().default(1),
  breakdown: z
    .array(
      z.object({
        criterion: z.string(),
        score: z.number().min(0).max(5),
        weight: z.number().min(0).max(1).optional(),
        note: z.string().optional(),
      }),
    )
    .optional(),
});

/** One step of a HowTo tutorial. Maps 1:1 onto schema.org HowToStep. */
const howToStep = z.object({
  name: z.string(),
  text: z.string(),
  url: z.string().optional(),
  image: z.string().optional(),
  /** Rendered as an inline code block under the step when present. */
  code: z.string().optional(),
  tip: z.string().optional(),
});

/**
 * Base fields shared by every editorial collection (E-E-A-T + SEO surface).
 *
 * `title` is capped at 44 characters on purpose: the SEO component appends
 * " | StackPipeline" (16 chars), so 44 + 16 = 60 — exactly the SERP truncation limit.
 * Enforcing it here means a programmatic run fails the build rather than silently
 * shipping an ellipsis. Use `heading` when the on-page <h1> should be longer.
 */
const editorialBase = {
  title: z.string().min(10).max(44),
  /** Meta description. Hard-capped at 155 so the SEO component never truncates. */
  description: z.string().min(50).max(155),
  /** Optional override when the <h1> should differ from the <title> tag. */
  heading: z.string().max(110).optional(),
  author: reference('authors'),
  /** Second byline for the editorial review loop that proves E-E-A-T. */
  reviewedBy: reference('authors').optional(),
  publishDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  /** Set by the editorial review script; surfaced as a "Verified" badge. */
  lastReviewedDate: z.coerce.date().optional(),
  draft: z.boolean().default(false),
  featured: z.boolean().default(false),
  /** Overrides the default social card. */
  image: z.string().optional(),
  imageAlt: z.string().optional(),
  tags: z.array(z.string()).default([]),
  /** Manual canonical override for syndicated or consolidated content. */
  canonical: z.string().url().optional(),
  noindex: z.boolean().default(false),
  /** Estimated reading time in minutes; computed by the generator when omitted. */
  readingTime: z.number().int().positive().optional(),
  faq: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .default([]),
};

/**
 * INTEGRATIONS — the programmatic money pages.
 * "How to connect [Software A] to [Software B]" at arbitrary scale.
 */
const integrations = defineCollection({
  loader: glob({ base: './src/content/integrations', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    ...editorialBase,
    schemaType: z.literal('HowTo').default('HowTo'),
    softwareA: reference('tools'),
    softwareB: reference('tools'),
    affiliateLinkA: affiliateLink.optional(),
    affiliateLinkB: affiliateLink.optional(),
    /** Use case label, e.g. "Sync new leads to your CRM". */
    useCase: z.string().optional(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
    /** ISO-8601 duration string for HowTo.totalTime, e.g. "PT15M". */
    totalTime: z.string().regex(/^PT(\d+H)?(\d+M)?$/).default('PT15M'),
    estimatedCost: z
      .object({ currency: z.string().length(3).default('USD'), value: z.number().min(0) })
      .optional(),
    supplies: z.array(z.string()).default([]),
    tools: z.array(z.string()).default([]),
    steps: z.array(howToStep).min(1),
    /** Connector methods compared in the "which approach" table. */
    methods: z
      .array(
        z.object({
          name: z.string(),
          bestFor: z.string(),
          setupTime: z.string(),
          cost: z.string(),
          codeRequired: z.boolean().default(false),
        }),
      )
      .default([]),
    troubleshooting: z
      .array(z.object({ problem: z.string(), fix: z.string() }))
      .default([]),
    relatedIntegrations: z.array(reference('integrations')).default([]),
  }),
});

/** REVIEWS — Product + Review schema nodes. */
const reviews = defineCollection({
  loader: glob({ base: './src/content/reviews', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    ...editorialBase,
    schemaType: z.literal('Review').default('Review'),
    tool: reference('tools'),
    softwareA: reference('tools').optional(),
    softwareB: reference('tools').optional(),
    affiliateLinkA: affiliateLink.optional(),
    affiliateLinkB: affiliateLink.optional(),
    rating,
    verdict: z.string().min(40).max(400),
    prosCons,
    bestFor: z.array(z.string()).default([]),
    notFor: z.array(z.string()).default([]),
    pricing: z
      .array(
        z.object({
          plan: z.string(),
          price: z.string(),
          billing: z.enum(['monthly', 'annual', 'usage', 'one-time', 'free']).default('monthly'),
          highlights: z.array(z.string()).default([]),
        }),
      )
      .default([]),
    /** Hands-on testing metadata — direct E-E-A-T signal. */
    testing: z
      .object({
        hoursTested: z.number().min(0),
        planTested: z.string(),
        periodStart: z.coerce.date().optional(),
        periodEnd: z.coerce.date().optional(),
        methodology: z.string().optional(),
      })
      .optional(),
  }),
});

/** ALTERNATIVES — comparison tables and "X vs Y" breakdowns. */
const alternatives = defineCollection({
  loader: glob({ base: './src/content/alternatives', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    ...editorialBase,
    schemaType: z.enum(['ItemList', 'Product']).default('ItemList'),
    softwareA: reference('tools'),
    softwareB: reference('tools').optional(),
    affiliateLinkA: affiliateLink.optional(),
    affiliateLinkB: affiliateLink.optional(),
    /** Ranked candidates rendered as the comparison table + ItemList schema. */
    contenders: z
      .array(
        z.object({
          tool: reference('tools'),
          position: z.number().int().positive(),
          verdict: z.string(),
          rating: z.number().min(0).max(5).optional(),
          bestFor: z.string().optional(),
          startingPrice: z.string().optional(),
          affiliateLink: affiliateLink.optional(),
          pros: z.array(z.string()).default([]),
          cons: z.array(z.string()).default([]),
        }),
      )
      .min(1),
    comparisonMatrix: z
      .object({
        columns: z.array(z.string()),
        rows: z.array(z.object({ feature: z.string(), values: z.array(z.string()) })),
      })
      .optional(),
  }),
});

/** GUIDES — long-form evergreen articles (Article schema). */
const guides = defineCollection({
  loader: glob({ base: './src/content/guides', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    ...editorialBase,
    schemaType: z.literal('Article').default('Article'),
    softwareA: reference('tools').optional(),
    softwareB: reference('tools').optional(),
    affiliateLinkA: affiliateLink.optional(),
    affiliateLinkB: affiliateLink.optional(),
  }),
});

/**
 * TOOLS — the normalised software directory.
 *
 * A JSON data collection rather than MDX: the generator joins against it to build
 * integration permutations, and every page that mentions a vendor resolves pricing,
 * category and affiliate metadata from this single record.
 */
const tools = defineCollection({
  loader: file('./src/content/tools/tools.json'),
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    category: z.string(),
    /** One-line positioning statement used in tables and cards. */
    tagline: z.string(),
    description: z.string(),
    website: z.string().url(),
    affiliateUrl: z.string().url().optional(),
    logo: z.string().optional(),
    /** Brand hex, used for the letter-mark fallback badge. */
    brandColor: z.string().regex(/^#([0-9a-fA-F]{6})$/).default('#354c6e'),
    startingPrice: z.string().default('Custom'),
    freeTier: z.boolean().default(false),
    /** Populated on review pages; also feeds directory sorting. */
    rating: z.number().min(0).max(5).optional(),
    apiAvailable: z.boolean().default(true),
    nativeIntegrations: z.number().int().min(0).default(0),
    bestFor: z.string().optional(),
    g2Rating: z.number().min(0).max(5).optional(),
  }),
});

/**
 * AUTHORS — E-E-A-T entity records.
 * Referenced by every editorial page and emitted as Person schema.
 */
const authors = defineCollection({
  loader: file('./src/content/authors/authors.json'),
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    role: z.string(),
    bio: z.string().min(80),
    shortBio: z.string().max(200),
    avatar: z.string().optional(),
    email: z.string().email().optional(),
    /** sameAs targets for Person schema — the strongest authorship signal available. */
    links: z
      .object({
        linkedin: z.string().url().optional(),
        x: z.string().url().optional(),
        github: z.string().url().optional(),
        website: z.string().url().optional(),
      })
      .default({}),
    expertise: z.array(z.string()).default([]),
    credentials: z.array(z.string()).default([]),
    yearsExperience: z.number().int().min(0).optional(),
  }),
});

export const collections = { integrations, reviews, alternatives, guides, tools, authors };
