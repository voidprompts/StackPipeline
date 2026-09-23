import { SITE } from '@config/site';
import { absoluteUrl, isoDate, type BreadcrumbEntry } from './seo';

/**
 * JSON-LD builders.
 *
 * Everything is emitted as a single connected graph using `@id` references rather than a
 * pile of disconnected blocks. Google resolves entity relationships (Article -> author ->
 * Organization -> WebSite) far more reliably this way, and it eliminates the duplicated
 * Organization payload that normally appears on every page.
 */

export type JsonLdNode = Record<string, unknown>;

/** Stable @id anchors for the global entity graph. */
export const IDS = {
  website: `${SITE.url}/#website`,
  organization: `${SITE.url}/#organization`,
  logo: `${SITE.url}/#logo`,
  page: (url: string) => `${url}#webpage`,
  primaryImage: (url: string) => `${url}#primaryimage`,
  breadcrumb: (url: string) => `${url}#breadcrumb`,
  article: (url: string) => `${url}#article`,
  product: (url: string) => `${url}#product`,
  review: (url: string) => `${url}#review`,
  howto: (url: string) => `${url}#howto`,
  faq: (url: string) => `${url}#faq`,
  itemlist: (url: string) => `${url}#itemlist`,
  person: (slug: string) => `${SITE.url}/authors/${slug}/#person`,
} as const;

export function organizationSchema(): JsonLdNode {
  return {
    '@type': 'Organization',
    '@id': IDS.organization,
    name: SITE.name,
    legalName: SITE.legalEntity,
    url: `${SITE.url}/`,
    description: SITE.shortDescription,
    foundingDate: SITE.founded,
    logo: {
      '@type': 'ImageObject',
      '@id': IDS.logo,
      url: absoluteUrl('/logo.svg'),
      contentUrl: absoluteUrl('/logo.svg'),
      width: 512,
      height: 512,
      caption: SITE.name,
    },
    image: { '@id': IDS.logo },
    sameAs: [SITE.social.x, SITE.social.linkedin, SITE.social.github, SITE.social.youtube],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'editorial',
        email: SITE.email.editorial,
        availableLanguage: ['English'],
      },
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: SITE.email.general,
        availableLanguage: ['English'],
      },
    ],
    address: {
      '@type': 'PostalAddress',
      ...SITE.address,
    },
    publishingPrinciples: absoluteUrl('/editorial-policy/'),
    // Explicitly declares the monetization model — an E-E-A-T transparency signal.
    ethicsPolicy: absoluteUrl('/affiliate-disclosure/'),
  };
}

/**
 * WebSite node.
 *
 * Deliberately omits `potentialAction`/SearchAction: Google retired the sitelinks
 * search box in 2024, and declaring a SearchAction that points at a route the site does
 * not serve is a structured-data error. Add it back only alongside a real /search page.
 */
export function websiteSchema(): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': IDS.website,
    url: `${SITE.url}/`,
    name: SITE.name,
    alternateName: SITE.domain,
    description: SITE.description,
    inLanguage: SITE.language,
    publisher: { '@id': IDS.organization },
    copyrightHolder: { '@id': IDS.organization },
    copyrightYear: Number(SITE.founded),
  };
}

export function breadcrumbSchema(items: BreadcrumbEntry[], pageUrl: string): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    '@id': IDS.breadcrumb(pageUrl),
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.href),
    })),
  };
}

export type WebPageInput = {
  url: string;
  title: string;
  description: string;
  image?: string;
  datePublished?: Date | string;
  dateModified?: Date | string;
  breadcrumbs?: BreadcrumbEntry[];
  type?: 'WebPage' | 'CollectionPage' | 'AboutPage' | 'ContactPage' | 'ItemPage';
};

export function webPageSchema(input: WebPageInput): JsonLdNode {
  const node: JsonLdNode = {
    '@type': input.type ?? 'WebPage',
    '@id': IDS.page(input.url),
    url: input.url,
    name: input.title,
    description: input.description,
    isPartOf: { '@id': IDS.website },
    about: { '@id': IDS.organization },
    inLanguage: SITE.language,
  };

  if (input.image) {
    node.primaryImageOfPage = { '@id': IDS.primaryImage(input.url) };
  }
  if (input.datePublished) node.datePublished = isoDate(input.datePublished);
  if (input.dateModified) node.dateModified = isoDate(input.dateModified);
  if (input.breadcrumbs?.length) node.breadcrumb = { '@id': IDS.breadcrumb(input.url) };

  return node;
}

export function imageObjectSchema(url: string, imageUrl: string, caption?: string): JsonLdNode {
  return {
    '@type': 'ImageObject',
    '@id': IDS.primaryImage(url),
    url: absoluteUrl(imageUrl),
    contentUrl: absoluteUrl(imageUrl),
    width: 1200,
    height: 630,
    ...(caption ? { caption } : {}),
  };
}

export type AuthorInput = {
  name: string;
  slug: string;
  role?: string;
  bio?: string;
  url?: string;
  sameAs?: string[];
  expertise?: string[];
  credentials?: string[];
};

export function personSchema(author: AuthorInput): JsonLdNode {
  return {
    '@type': 'Person',
    '@id': IDS.person(author.slug),
    name: author.name,
    url: author.url ?? absoluteUrl(`/authors/${author.slug}/`),
    ...(author.role ? { jobTitle: author.role } : {}),
    ...(author.bio ? { description: author.bio } : {}),
    ...(author.expertise?.length ? { knowsAbout: author.expertise } : {}),
    ...(author.credentials?.length
      ? {
          hasCredential: author.credentials.map((credential) => ({
            '@type': 'EducationalOccupationalCredential',
            name: credential,
          })),
        }
      : {}),
    ...(author.sameAs?.length ? { sameAs: author.sameAs } : {}),
    worksFor: { '@id': IDS.organization },
  };
}

export type ArticleInput = {
  url: string;
  headline: string;
  description: string;
  image?: string;
  datePublished: Date | string;
  dateModified?: Date | string;
  author: AuthorInput;
  reviewedBy?: AuthorInput;
  section?: string;
  keywords?: string[];
  wordCount?: number;
};

export function articleSchema(input: ArticleInput): JsonLdNode {
  return {
    '@type': 'Article',
    '@id': IDS.article(input.url),
    isPartOf: { '@id': IDS.page(input.url) },
    mainEntityOfPage: { '@id': IDS.page(input.url) },
    headline: input.headline.slice(0, 110),
    description: input.description,
    datePublished: isoDate(input.datePublished),
    dateModified: isoDate(input.dateModified ?? input.datePublished),
    author: { '@id': IDS.person(input.author.slug) },
    ...(input.reviewedBy
      ? {
          reviewedBy: { '@id': IDS.person(input.reviewedBy.slug) },
          contributor: { '@id': IDS.person(input.reviewedBy.slug) },
        }
      : {}),
    publisher: { '@id': IDS.organization },
    ...(input.image ? { image: { '@id': IDS.primaryImage(input.url) } } : {}),
    ...(input.section ? { articleSection: input.section } : {}),
    ...(input.keywords?.length ? { keywords: input.keywords.join(', ') } : {}),
    ...(input.wordCount ? { wordCount: input.wordCount } : {}),
    inLanguage: SITE.language,
  };
}

export type HowToStepInput = {
  name: string;
  text: string;
  url?: string;
  image?: string;
};

export type HowToInput = {
  url: string;
  name: string;
  description: string;
  image?: string;
  totalTime?: string;
  estimatedCost?: { currency: string; value: number };
  supplies?: string[];
  tools?: string[];
  steps: HowToStepInput[];
  datePublished?: Date | string;
  dateModified?: Date | string;
};

export function howToSchema(input: HowToInput): JsonLdNode {
  return {
    '@type': 'HowTo',
    '@id': IDS.howto(input.url),
    isPartOf: { '@id': IDS.page(input.url) },
    mainEntityOfPage: { '@id': IDS.page(input.url) },
    name: input.name,
    description: input.description,
    ...(input.image ? { image: { '@id': IDS.primaryImage(input.url) } } : {}),
    ...(input.totalTime ? { totalTime: input.totalTime } : {}),
    ...(input.estimatedCost
      ? {
          estimatedCost: {
            '@type': 'MonetaryAmount',
            currency: input.estimatedCost.currency,
            value: input.estimatedCost.value,
          },
        }
      : {}),
    ...(input.supplies?.length
      ? { supply: input.supplies.map((name) => ({ '@type': 'HowToSupply', name })) }
      : {}),
    ...(input.tools?.length
      ? { tool: input.tools.map((name) => ({ '@type': 'HowToTool', name })) }
      : {}),
    ...(input.datePublished ? { datePublished: isoDate(input.datePublished) } : {}),
    ...(input.dateModified ? { dateModified: isoDate(input.dateModified) } : {}),
    step: input.steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
      url: step.url ?? `${input.url}#step-${index + 1}`,
      ...(step.image ? { image: absoluteUrl(step.image) } : {}),
    })),
  };
}

export type ProductInput = {
  url: string;
  name: string;
  description: string;
  image?: string;
  brand?: string;
  category?: string;
  offerUrl?: string;
  price?: string;
  priceCurrency?: string;
  aggregateRating?: { value: number; count: number; best?: number; worst?: number };
  /** When set, the Product links back to the Review node so the pairing is bidirectional. */
  linkedReview?: boolean;
};

/**
 * SoftwareApplication is the correct Product subtype for SaaS. Google accepts Product
 * review snippets for it and it unlocks the applicationCategory/operatingSystem fields.
 */
export function softwareProductSchema(input: ProductInput): JsonLdNode {
  const node: JsonLdNode = {
    '@type': ['Product', 'SoftwareApplication'],
    '@id': IDS.product(input.url),
    name: input.name,
    description: input.description,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web-based',
    ...(input.image ? { image: { '@id': IDS.primaryImage(input.url) } } : {}),
    ...(input.brand ? { brand: { '@type': 'Brand', name: input.brand } } : {}),
    ...(input.category ? { category: input.category } : {}),
  };

  if (input.offerUrl || input.price) {
    node.offers = {
      '@type': 'Offer',
      ...(input.price ? { price: input.price } : {}),
      priceCurrency: input.priceCurrency ?? 'USD',
      ...(input.offerUrl ? { url: input.offerUrl } : {}),
      availability: 'https://schema.org/InStock',
    };
  }

  // Bidirectional Product <-> Review link, which is what Google uses to attach the
  // star rating to the product entity in search results.
  if (input.linkedReview) {
    node.review = { '@id': IDS.review(input.url) };
  }

  /**
   * AggregateRating is only emitted when it summarises more than one rating. With a
   * single editorial review the Review node already carries the score, and adding an
   * AggregateRating of reviewCount:1 double-counts the same rating — Google's Rich
   * Results guidance treats that as invalid.
   */
  if (input.aggregateRating && input.aggregateRating.count > 1) {
    node.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: input.aggregateRating.value,
      reviewCount: input.aggregateRating.count,
      bestRating: input.aggregateRating.best ?? 5,
      worstRating: input.aggregateRating.worst ?? 0,
    };
  }

  return node;
}

export type ReviewInput = {
  url: string;
  itemName: string;
  itemUrl?: string;
  headline: string;
  body: string;
  rating: { value: number; best?: number; worst?: number };
  author: AuthorInput;
  datePublished: Date | string;
  dateModified?: Date | string;
  pros?: string[];
  cons?: string[];
};

export function reviewSchema(input: ReviewInput): JsonLdNode {
  return {
    '@type': 'Review',
    '@id': IDS.review(input.url),
    isPartOf: { '@id': IDS.page(input.url) },
    mainEntityOfPage: { '@id': IDS.page(input.url) },
    name: input.headline,
    headline: input.headline,
    reviewBody: input.body,
    datePublished: isoDate(input.datePublished),
    dateModified: isoDate(input.dateModified ?? input.datePublished),
    author: { '@id': IDS.person(input.author.slug) },
    publisher: { '@id': IDS.organization },
    itemReviewed: { '@id': IDS.product(input.url) },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: input.rating.value,
      bestRating: input.rating.best ?? 5,
      worstRating: input.rating.worst ?? 0,
    },
    // positiveNotes/negativeNotes are the supported pros & cons fields for review snippets.
    ...(input.pros?.length
      ? {
          positiveNotes: {
            '@type': 'ItemList',
            itemListElement: input.pros.map((name, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name,
            })),
          },
        }
      : {}),
    ...(input.cons?.length
      ? {
          negativeNotes: {
            '@type': 'ItemList',
            itemListElement: input.cons.map((name, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name,
            })),
          },
        }
      : {}),
  };
}

export type FaqEntry = { question: string; answer: string };

export function faqSchema(items: FaqEntry[], pageUrl: string): JsonLdNode {
  return {
    '@type': 'FAQPage',
    '@id': IDS.faq(pageUrl),
    isPartOf: { '@id': IDS.page(pageUrl) },
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export type ItemListEntry = {
  name: string;
  url?: string;
  position: number;
  description?: string;
};

export function itemListSchema(items: ItemListEntry[], pageUrl: string, name?: string): JsonLdNode {
  return {
    '@type': 'ItemList',
    '@id': IDS.itemlist(pageUrl),
    ...(name ? { name } : {}),
    numberOfItems: items.length,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: items.map((item) => ({
      '@type': 'ListItem',
      position: item.position,
      name: item.name,
      ...(item.description ? { description: item.description } : {}),
      ...(item.url ? { url: absoluteUrl(item.url) } : {}),
    })),
  };
}

/**
 * Wrap a set of nodes into a single @graph document.
 * Undefined/empty entries are dropped so callers can use conditional spreads freely.
 */
export function buildGraph(nodes: Array<JsonLdNode | undefined | false | null>): string {
  const graph = nodes.filter((node): node is JsonLdNode => Boolean(node));
  return JSON.stringify(
    { '@context': 'https://schema.org', '@graph': graph },
    // Strip characters that could break out of the <script> context.
    (_key, value) => (typeof value === 'string' ? value.replace(/<\/script/gi, '<\\/script') : value),
  );
}

/**
 * Map an `authors` collection entry onto the `AuthorInput` shape used by `personSchema`.
 *
 * Lives here rather than in each route because all four editorial templates need the
 * identical mapping, and the `links` -> `sameAs` flattening is easy to get subtly wrong
 * (an undefined social link must be dropped, not serialised as null).
 */
export function toAuthorInput(record: {
  data: {
    name: string;
    slug: string;
    role: string;
    shortBio: string;
    expertise: string[];
    credentials: string[];
    links: Record<string, string | undefined>;
  };
}): AuthorInput {
  return {
    name: record.data.name,
    slug: record.data.slug,
    role: record.data.role,
    bio: record.data.shortBio,
    expertise: record.data.expertise,
    credentials: record.data.credentials,
    sameAs: Object.values(record.data.links).filter((link): link is string => Boolean(link)),
  };
}
