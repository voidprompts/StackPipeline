/**
 * StackPipeline — public-site configuration.
 *
 * Keep only facts that are verified and public here. Legal identity, postal address,
 * social accounts, a contact email and ad publisher IDs are intentionally absent until
 * the publisher has established and verified them.
 */

export const SITE = {
  /** Current public Cloudflare Pages origin. Replace only after a custom domain is live. */
  url: 'https://stack-pipeline.pages.dev',
  domain: 'stack-pipeline.pages.dev',
  name: 'StackPipeline',
  tagline: 'Workflow automation, data enrichment and B2B SaaS integrations',
  /** <155 chars. Used as the default meta description and og:description. */
  description:
    'B2B SaaS integration tutorials, workflow automation playbooks and data enrichment tool comparisons.',
  /** Short description reused in schema and social cards. */
  shortDescription: 'Integration tutorials and automation tooling breakdowns for revenue operations teams.',
  locale: 'en_US',
  language: 'en',
  /** Default social share image (1200x630), served from /public. */
  defaultImage: '/og/stackpipeline-default.png',
  defaultImageAlt: 'StackPipeline — workflow automation and B2B SaaS integration guides',
  themeColor: '#0b1220',
} as const;

const adsenseClient = (import.meta.env.PUBLIC_ADSENSE_CLIENT ?? '').trim();
const adsensePublisherId = adsenseClient.replace(/^ca-/, '');
const hasAdSensePublisherId = /^pub-\d{16}$/.test(adsensePublisherId);

/**
 * Monetization configuration.
 *
 * No seller is published until a real AdSense publisher ID is supplied at build time.
 * This prevents a fake ads.txt record from being deployed before the publisher account
 * and verified business identity are ready.
 */
export const ADS = {
  /** e.g. "ca-pub-1234567890123456"; empty until a real account is configured. */
  client: hasAdSensePublisherId ? adsenseClient : '',
  /** Auto Ads injects its own placements when enabled in the AdSense dashboard. */
  autoAdsEnabled: import.meta.env.PUBLIC_ADSENSE_AUTO_ADS !== 'false',
  /** Manual slot IDs, overridable per environment. */
  slots: {
    inArticleTop: import.meta.env.PUBLIC_ADSENSE_SLOT_IN_ARTICLE_TOP ?? '',
    inArticleMid: import.meta.env.PUBLIC_ADSENSE_SLOT_IN_ARTICLE_MID ?? '',
    inArticleFoot: import.meta.env.PUBLIC_ADSENSE_SLOT_IN_ARTICLE_FOOT ?? '',
    sidebar: import.meta.env.PUBLIC_ADSENSE_SLOT_SIDEBAR ?? '',
    listing: import.meta.env.PUBLIC_ADSENSE_SLOT_LISTING ?? '',
  },
  /**
   * ads.txt records. Direct AdSense line first; add resellers/exchanges only once signed.
   * Format: <domain>, <publisher id>, <DIRECT|RESELLER>, <certification authority id>
   */
  sellers: hasAdSensePublisherId
    ? [
        {
          domain: 'google.com',
          publisherId: adsensePublisherId,
          relationship: 'DIRECT' as const,
          certificationAuthorityId: 'f08c47fec0942fa0',
          comment: 'Google AdSense / Ad Manager',
        },
      ]
    : [],
} as const;

/** Analytics IDs (optional — tags render only when set). */
export const ANALYTICS = {
  ga4: import.meta.env.PUBLIC_GA4_ID ?? '',
  plausibleDomain: import.meta.env.PUBLIC_PLAUSIBLE_DOMAIN ?? '',
} as const;

/** Affiliate/FTC disclosure strings, reused verbatim wherever required by policy. */
export const DISCLOSURE = {
  short: 'StackPipeline may earn affiliate commissions from qualifying links. Editorial assessments are kept separate from monetization.',
  inline: 'Affiliate link — StackPipeline may earn a commission at no extra cost to you.',
  long: `${SITE.name} may participate in affiliate programs operated by software vendors we cover. When you sign up for a product through a tracked link on ${SITE.domain}, we may receive a referral fee or commission at no additional cost to you. Commission rates do not determine whether a product is covered, its score, ranking order, or editorial recommendation.`,
} as const;

export type NavItem = {
  label: string;
  href: string;
  description?: string;
};

export const PRIMARY_NAV: readonly NavItem[] = [
  { label: 'Integrations', href: '/integrations/', description: 'Connect any two tools in your stack' },
  { label: 'Reviews', href: '/reviews/', description: 'B2B SaaS scorecards' },
  { label: 'Alternatives', href: '/alternatives/', description: 'Side-by-side vendor breakdowns' },
  { label: 'Tools', href: '/tools/', description: 'The automation software directory' },
  { label: 'About', href: '/about/', description: 'About StackPipeline' },
] as const;

export const FOOTER_NAV = {
  Content: [
    { label: 'Integration guides', href: '/integrations/' },
    { label: 'Software reviews', href: '/reviews/' },
    { label: 'Alternatives', href: '/alternatives/' },
    { label: 'Tool directory', href: '/tools/' },
    { label: 'RSS feed', href: '/rss.xml' },
  ],
  Company: [
    { label: 'About StackPipeline', href: '/about/' },
    { label: 'Editorial policy', href: '/editorial-policy/' },
    { label: 'How we test', href: '/how-we-test/' },
    { label: 'Contact', href: '/contact/' },
  ],
  Legal: [
    { label: 'Privacy policy', href: '/privacy-policy/' },
    { label: 'Terms of service', href: '/terms-of-service/' },
    { label: 'Affiliate disclosure', href: '/affiliate-disclosure/' },
    { label: 'Cookie policy', href: '/cookie-policy/' },
  ],
} as const satisfies Record<string, readonly NavItem[]>;

/** Legal boilerplate dates, surfaced on every policy page. */
export const LEGAL = {
  effectiveDate: '2026-09-23',
  lastUpdated: '2026-09-23',
} as const;
