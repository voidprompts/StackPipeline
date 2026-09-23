// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

const SITE_URL = 'https://stack-pipeline.pages.dev';

/**
 * Depth-aware sitemap prioritisation.
 *
 * Google treats <priority> as a relative hint within a single site, so we grade pages by
 * URL depth and template type rather than shipping a flat 0.5 for everything:
 *
 *   /                      -> 1.0  daily    (hub, changes with every publish)
 *   /integrations/         -> 0.9  daily    (section index, high crawl value)
 *   /integrations/a-to-b/  -> 0.8  weekly   (money page, leaf content)
 *   /integrations/tag/x/   -> 0.5  weekly   (taxonomy, thin by design)
 *   /privacy-policy/       -> 0.3  yearly   (compliance, rarely edited)
 */
const SECTION_INDEXES = new Set([
  'integrations',
  'reviews',
  'alternatives',
  'tools',
  'guides',
]);

const LOW_VALUE_SEGMENTS = new Set(['tag', 'category', 'page']);

const LEGAL_PAGES = new Set([
  'privacy-policy',
  'terms-of-service',
  'affiliate-disclosure',
  'cookie-policy',
  'editorial-policy',
  'how-we-test',
  'contact',
]);

/** @param {string} url */
function grade(url) {
  const path = url.replace(SITE_URL, '').replace(/^\/|\/$/g, '');
  const segments = path ? path.split('/') : [];
  const depth = segments.length;

  if (depth === 0) return { priority: 1.0, changefreq: /** @type {const} */ ('daily') };

  const [head, second] = segments;

  if (LEGAL_PAGES.has(head)) {
    return { priority: 0.3, changefreq: /** @type {const} */ ('yearly') };
  }

  if (depth === 1) {
    return SECTION_INDEXES.has(head)
      ? { priority: 0.9, changefreq: /** @type {const} */ ('daily') }
      : { priority: 0.6, changefreq: /** @type {const} */ ('monthly') };
  }

  if (LOW_VALUE_SEGMENTS.has(second) || LOW_VALUE_SEGMENTS.has(head)) {
    return { priority: 0.5, changefreq: /** @type {const} */ ('weekly') };
  }

  if (depth === 2) return { priority: 0.8, changefreq: /** @type {const} */ ('weekly') };

  // Deeply nested pages decay but never fall below the taxonomy floor.
  return { priority: Math.max(0.4, 0.8 - (depth - 2) * 0.15), changefreq: /** @type {const} */ ('monthly') };
}

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'ignore',
  compressHTML: true,

  build: {
    // Directory format keeps canonical URLs clean (/integrations/zapier-to-hubspot/).
    format: 'directory',
    // Inline small stylesheets to remove a render-blocking round trip on first paint.
    inlineStylesheets: 'auto',
    assets: '_assets',
  },

  // Viewport-based prefetch: near-instant navigation without eagerly burning bandwidth.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },

  image: {
    // Emit modern formats; the <SmartImage> wrapper always passes explicit dimensions.
    responsiveStyles: true,
    layout: 'constrained',
    remotePatterns: [{ protocol: 'https' }],
  },

  markdown: {
    // Sätteri (Astro 7's default Markdown processor) handles GFM + smart punctuation.
    syntaxHighlight: 'shiki',
    shikiConfig: {
      theme: 'github-dark-default',
      wrap: true,
    },
  },

  integrations: [
    mdx(),
    sitemap({
      // Keep utility routes and paginated duplicates out of the index.
      filter: (page) =>
        !page.includes('/404') &&
        !/\/page\/1\/?$/.test(page),
      serialize(item) {
        const { priority, changefreq } = grade(item.url);
        return {
          ...item,
          priority,
          // The `sitemap` package types changefreq as its EnumChangefreq enum, whose
          // members are exactly these lowercase strings. Cast rather than importing the
          // enum so this config stays dependency-free.
          changefreq: /** @type {import('sitemap').EnumChangefreq} */ (changefreq),
          lastmod: item.lastmod,
        };
      },
      // Split into multiple files past 45k URLs so programmatic scale never breaks the index.
      entryLimit: 45000,
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
    build: {
      cssMinify: 'lightningcss',
    },
    server: {
      // Allow sandboxed/preview hosts (e.g. *.e2b.app) to reach the dev server.
      // Production is a static export, so this only affects local development.
      allowedHosts: true,
    },
  },
});
