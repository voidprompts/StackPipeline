import type { APIRoute } from 'astro';
import { SITE } from '@config/site';

export const prerender = true;

/**
 * Dynamic robots.txt.
 *
 * Explicitly allows Mediapartners-Google (the AdSense crawler) — without it, AdSense
 * cannot read page content to target ads, which degrades fill rate and RPM. Also allows
 * AdsBot-Google, which evaluates landing page quality.
 */
export const GET: APIRoute = () => {
  const body = `# robots.txt for ${SITE.domain}

User-agent: *
Allow: /
Disallow: /*?q=
Disallow: /404

# AdSense content crawler — required for contextual ad targeting
User-agent: Mediapartners-Google
Allow: /

# Landing page quality evaluation
User-agent: AdsBot-Google
Allow: /

User-agent: AdsBot-Google-Mobile
Allow: /

# Be polite to aggressive SEO crawlers without blocking them outright
User-agent: AhrefsBot
Crawl-delay: 10

User-agent: SemrushBot
Crawl-delay: 10

Sitemap: ${SITE.url}/sitemap-index.xml
`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
