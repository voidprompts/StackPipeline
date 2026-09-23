/**
 * StackPipeline — single source of truth for brand, legal and monetization variables.
 *
 * Every legal page, schema block, meta tag, ads.txt line and footer string reads from
 * this file. Changing the domain or legal entity here propagates across the entire build,
 * which is what keeps the AdSense compliance surface accurate and audit-friendly.
 */

export const SITE = {
  /** Canonical production origin. No trailing slash. */
  url: 'https://stackpipeline.com',
  /** Bare domain, used in legal copy and ads.txt commentary. */
  domain: 'stackpipeline.com',
  name: 'StackPipeline',
  legalEntity: 'StackPipeline Media',
  tagline: 'Workflow automation, data enrichment and B2B SaaS integrations',
  /** <155 chars. Used as the default meta description and og:description. */
  description:
    'Step-by-step B2B SaaS integration tutorials, workflow automation playbooks and data enrichment tool comparisons — tested by operators.',
  /** Short description reused in schema and social cards. */
  shortDescription: 'Integration tutorials and automation tooling breakdowns for revenue operations teams.',
  locale: 'en_US',
  language: 'en',
  /** Default social share image (1200x630), served from /public. */
  defaultImage: '/og/stackpipeline-default.png',
  defaultImageAlt: 'StackPipeline — workflow automation and B2B SaaS integration guides',
  themeColor: '#0b1220',
  founded: '2024',
  email: {
    general: 'hello@stackpipeline.com',
    editorial: 'editorial@stackpipeline.com',
    privacy: 'privacy@stackpipeline.com',
    partnerships: 'partners@stackpipeline.com',
  },
  address: {
    streetAddress: '2093 Philadelphia Pike #4021',
    addressLocality: 'Claymont',
    addressRegion: 'DE',
    postalCode: '19703',
    addressCountry: 'US',
  },
  social: {
    x: 'https://x.com/stackpipeline',
    xHandle: '@stackpipeline',
    linkedin: 'https://www.linkedin.com/company/stackpipeline',
    github: 'https://github.com/stackpipeline',
    youtube: 'https://www.youtube.com/@stackpipeline',
  },
} as const;

/**
 * Monetization configuration.
 *
 * `client` is read from the PUBLIC_ADSENSE_CLIENT environment variable at build time so
 * the publisher ID never has to be committed. When it is absent, ad markup is suppressed
 * entirely — an empty `<ins>` with no client ID is an AdSense policy violation, so we
 * render a neutral reserved-space div instead (keeps CLS at zero either way).
 */
export const ADS = {
  /** e.g. "ca-pub-1234567890123456" */
  client: import.meta.env.PUBLIC_ADSENSE_CLIENT ?? '',
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
   * ads.txt records. Direct AdSense line first; add resellers/exchanges as they are signed.
   * Format: <domain>, <publisher id>, <DIRECT|RESELLER>, <certification authority id>
   */
  sellers: [
    {
      domain: 'google.com',
      publisherId: import.meta.env.PUBLIC_ADSENSE_CLIENT?.replace(/^ca-/, '') ?? 'pub-0000000000000000',
      relationship: 'DIRECT' as const,
      certificationAuthorityId: 'f08c47fec0942fa0',
      comment: 'Google AdSense / Ad Manager',
    },
  ],
} as const;

/** Analytics IDs (optional — tags render only when set). */
export const ANALYTICS = {
  ga4: import.meta.env.PUBLIC_GA4_ID ?? '',
  plausibleDomain: import.meta.env.PUBLIC_PLAUSIBLE_DOMAIN ?? '',
} as const;

/** Affiliate/FTC disclosure strings, reused verbatim wherever required by policy. */
export const DISCLOSURE = {
  short: 'StackPipeline earns affiliate commissions from some links on this page. Our testing and rankings are independent.',
  inline: 'Affiliate link — StackPipeline may earn a commission at no extra cost to you.',
  long: `${SITE.name} participates in affiliate programs operated by the software vendors we cover. When you sign up for a product through a tracked link on ${SITE.domain}, we may receive a referral fee or commission at no additional cost to you. Commission rates never influence review scores, ranking order, or editorial recommendations — scoring is completed before monetization is applied.`,
} as const;

export type NavItem = {
  label: string;
  href: string;
  description?: string;
};

export const PRIMARY_NAV: readonly NavItem[] = [
  { label: 'Integrations', href: '/integrations/', description: 'Connect any two tools in your stack' },
  { label: 'Reviews', href: '/reviews/', description: 'Hands-on B2B SaaS scorecards' },
  { label: 'Alternatives', href: '/alternatives/', description: 'Side-by-side vendor breakdowns' },
  { label: 'Tools', href: '/tools/', description: 'The automation software directory' },
  { label: 'About', href: '/about/', description: 'Who writes StackPipeline' },
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

/** Legal boilerplate dates, surfaced on every policy page for compliance reviewers. */
export const LEGAL = {
  effectiveDate: '2026-01-06',
  lastUpdated: '2026-09-01',
  governingLaw: 'the State of Delaware, United States',
  dpoEmail: SITE.email.privacy,
} as const;
