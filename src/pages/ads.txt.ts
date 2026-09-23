import type { APIRoute } from 'astro';
import { ADS, SITE } from '@config/site';

export const prerender = true;

/**
 * IAB Authorized Digital Sellers record.
 *
 * The file intentionally contains no seller record until a real AdSense publisher ID is
 * supplied through PUBLIC_ADSENSE_CLIENT at build time. A fake pub- ID is worse than no
 * record: it misrepresents the seller and blocks a legitimate AdSense review.
 */
export const GET: APIRoute = () => {
  const header = [
    `# ads.txt for ${SITE.domain}`,
    '# Authorized Digital Sellers — IAB Tech Lab specification v1.1',
    '# Generated at build time from src/config/site.ts',
    '',
  ];

  const records = ADS.sellers.map((seller) => {
    const line = [
      seller.domain,
      seller.publisherId,
      seller.relationship,
      seller.certificationAuthorityId,
    ]
      .filter(Boolean)
      .join(', ');

    return seller.comment ? `${line} # ${seller.comment}` : line;
  });

  const inactiveNotice = records.length
    ? []
    : ['# No authorized advertising sellers are configured for this site.'];

  // Trailing newline is required by several crawlers' parsers.
  const body = `${[...header, ...inactiveNotice, ...records].join('\n')}\n`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
