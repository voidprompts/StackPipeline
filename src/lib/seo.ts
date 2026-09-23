import { SITE } from '@config/site';

/**
 * Metadata matrix helpers.
 *
 * Titles and descriptions are mechanically clamped here rather than trusted from
 * frontmatter, so a programmatic run that emits a 90-character title can never ship a
 * truncated SERP snippet.
 */

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;

const SUFFIX = ` | ${SITE.name}`;

/**
 * Build a title following the "[Topic/Software] | StackPipeline" formula, guaranteed to
 * stay under 60 characters. When the topic alone is too long, it is truncated on a word
 * boundary and an ellipsis is added — the brand suffix is always preserved.
 */
export function buildTitle(topic: string, options: { suffix?: boolean } = {}): string {
  const withSuffix = options.suffix !== false;
  const clean = topic.trim().replace(/\s+/g, ' ');

  if (!withSuffix) return truncate(clean, TITLE_MAX);
  if (clean.endsWith(SITE.name)) return truncate(clean, TITLE_MAX);

  const budget = TITLE_MAX - SUFFIX.length;
  if (clean.length <= budget) return `${clean}${SUFFIX}`;

  return `${truncate(clean, budget)}${SUFFIX}`;
}

/** Clamp a meta description to 155 characters on a word boundary. */
export function buildDescription(text: string): string {
  return truncate(text.trim().replace(/\s+/g, ' '), DESCRIPTION_MAX);
}

/** Truncate on a word boundary, appending an ellipsis only when the cut actually happens. */
export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  const slice = value.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const base = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${base.replace(/[,;:.\-\s]+$/, '')}…`;
}

/**
 * Absolute URL builder. Everything canonical-adjacent flows through this so the
 * production origin is applied exactly once, with a consistent trailing slash.
 */
export function absoluteUrl(path: string | URL, base: string = SITE.url): string {
  const raw = typeof path === 'string' ? path : path.pathname;
  if (/^https?:\/\//i.test(raw)) return raw;

  const normalized = `/${raw.replace(/^\/+/, '')}`;
  const url = new URL(normalized, base);

  // Directory-style canonicals: add a trailing slash to everything except files and root.
  const isFile = /\.[a-z0-9]{2,5}$/i.test(url.pathname);
  if (!isFile && !url.pathname.endsWith('/')) url.pathname += '/';

  return url.toString();
}

/** Strip the origin from a URL, returning a root-relative path. */
export function relativeUrl(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export type BreadcrumbEntry = { name: string; href: string };

const SEGMENT_LABELS: Record<string, string> = {
  integrations: 'Integrations',
  reviews: 'Reviews',
  alternatives: 'Alternatives',
  guides: 'Guides',
  tools: 'Tools',
  tag: 'Topics',
};

/**
 * Derive a breadcrumb trail from a URL pathname.
 * Always rooted at Home so BreadcrumbList schema is valid on every page.
 */
export function breadcrumbsFromPath(pathname: string, leafLabel?: string): BreadcrumbEntry[] {
  const segments = pathname.replace(/^\/|\/$/g, '').split('/').filter(Boolean);
  const trail: BreadcrumbEntry[] = [{ name: 'Home', href: '/' }];

  let acc = '';
  segments.forEach((segment, index) => {
    acc += `/${segment}`;
    const isLast = index === segments.length - 1;
    trail.push({
      name: isLast && leafLabel ? leafLabel : SEGMENT_LABELS[segment] ?? titleCase(segment),
      href: `${acc}/`,
    });
  });

  return trail;
}

/** "zapier-to-hubspot" -> "Zapier to HubSpot" (with known brand casing preserved). */
const BRAND_CASING: Record<string, string> = {
  hubspot: 'HubSpot',
  salesforce: 'Salesforce',
  airtable: 'Airtable',
  zapier: 'Zapier',
  make: 'Make',
  n8n: 'n8n',
  clay: 'Clay',
  apollo: 'Apollo',
  slack: 'Slack',
  notion: 'Notion',
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  api: 'API',
  crm: 'CRM',
  saas: 'SaaS',
  ai: 'AI',
  csv: 'CSV',
  b2b: 'B2B',
  seo: 'SEO',
  workato: 'Workato',
  tray: 'Tray.ai',
  clearbit: 'Clearbit',
  pipedrive: 'Pipedrive',
  webhook: 'Webhook',
  webhooks: 'Webhooks',
  to: 'to',
  and: 'and',
  vs: 'vs',
};

export function titleCase(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (BRAND_CASING[lower]) {
        // Keep small connector words lowercase unless they lead the string.
        const mapped = BRAND_CASING[lower];
        return index === 0 && mapped === lower ? capitalize(mapped) : mapped;
      }
      return capitalize(lower);
    })
    .join(' ');
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Format a Date for display, e.g. "September 22, 2026". */
export function formatDate(date: Date | string | undefined): string {
  if (!date) return '';
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(value);
}

/** ISO-8601 date string (YYYY-MM-DD) for <time datetime> and schema fields. */
export function isoDate(date: Date | string | undefined): string {
  if (!date) return '';
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return '';
  return value.toISOString();
}

/** Human-readable "Updated 3 days ago" freshness label. */
export function relativeTime(date: Date | string | undefined, now: Date = new Date()): string {
  if (!date) return '';
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return '';

  const diffDays = Math.round((value.getTime() - now.getTime()) / 86_400_000);
  const formatter = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });

  if (Math.abs(diffDays) < 1) return 'today';
  if (Math.abs(diffDays) < 30) return formatter.format(diffDays, 'day');
  if (Math.abs(diffDays) < 365) return formatter.format(Math.round(diffDays / 30), 'month');
  return formatter.format(Math.round(diffDays / 365), 'year');
}

/** Rough reading-time estimate at 225 wpm, floored at 1 minute. */
export function readingTime(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 225));
}

/** Convert "PT15M" into "15 min". */
export function humanizeDuration(iso: string): string {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(iso);
  if (!match) return iso;
  const [, hours, minutes] = match;
  const parts: string[] = [];
  if (hours) parts.push(`${hours} hr`);
  if (minutes) parts.push(`${minutes} min`);
  return parts.join(' ') || iso;
}
