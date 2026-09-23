import { SITE } from '@config/site';
import { absoluteUrl, isoDate, type BreadcrumbEntry } from './seo';

/**
 * JSON-LD builders.
 *
 * Everything is emitted as a single connected graph using `@id` references rather than a
 * pile of disconnected blocks. Google resolves entity relationships (Article -> Organization -> WebSite) far more reliably this way, and it eliminates the duplicated
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
} as const;

export function organizationSchema(): JsonLdNode {
  return {
    '@type': 'Organization',
    '@id': IDS.organization,
    name: SITE.name,
    url: `${SITE.url}/`,
    description: SITE.shortDescription,
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

export type ArticleInput = {
  url: string;
  headline: string;
  description: string;
  image?: string;
  datePublished: Date | string;
  dateModified?: Date | string;
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
    author: { '@id': IDS.organization },
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
    author: { '@id': IDS.organization },
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
