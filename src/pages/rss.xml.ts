import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE } from '@config/site';
import { absoluteUrl } from '@lib/seo';

export const prerender = true;

/** Escape the five XML entities so titles containing & or < cannot break the feed. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async () => {
  const [integrations, reviews, alternatives] = await Promise.all([
    getCollection('integrations', ({ data }) => !data.draft),
    getCollection('reviews', ({ data }) => !data.draft),
    getCollection('alternatives', ({ data }) => !data.draft),
  ]);

  const items = [
    ...integrations.map((entry) => ({ entry, base: '/integrations', category: 'Integrations' })),
    ...reviews.map((entry) => ({ entry, base: '/reviews', category: 'Reviews' })),
    ...alternatives.map((entry) => ({ entry, base: '/alternatives', category: 'Alternatives' })),
  ]
    .sort(
      (a, b) =>
        (b.entry.data.updatedDate ?? b.entry.data.publishDate).getTime() -
        (a.entry.data.updatedDate ?? a.entry.data.publishDate).getTime(),
    )
    .slice(0, 50);

  const entries = items
    .map(({ entry, base, category }) => {
      const url = absoluteUrl(`${base}/${entry.id}/`);
      const pubDate = (entry.data.updatedDate ?? entry.data.publishDate).toUTCString();
      return `    <item>
      <title>${escapeXml(entry.data.heading ?? entry.data.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escapeXml(entry.data.description)}</description>
      <category>${escapeXml(category)}</category>
      <pubDate>${pubDate}</pubDate>
    </item>`;
    })
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE.name)} — ${escapeXml(SITE.tagline)}</title>
    <link>${SITE.url}/</link>
    <description>${escapeXml(SITE.description)}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE.url}/rss.xml" rel="self" type="application/rss+xml" />
${entries}
  </channel>
</rss>
`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
