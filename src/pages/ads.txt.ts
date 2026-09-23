import type { APIRoute } from 'astro';
import { ADS, SITE } from '@config/site';

export const prerender = true;

/**
 * Dynamic /ads.txt (IAB Authorized Digital Sellers).
 *
 * Generated from the seller list in site config rather than maintained by hand, so
 * adding an ad exchange is a one-line config change. Google re-crawls this file every
 * 24 hours; a malformed or missing line means unfilled inventory on those partners.
 *
 * Record format:
 *   <exchange domain>, <publisher account id>, <DIRECT|RESELLER>, <certification authority id>
 */
export const GET: APIRoute = () => {
  const header = [
    `# ads.txt for ${SITE.domain}`,
    `# Authorized Digital Sellers — IAB Tech Lab specification v1.1`,
    `# Contact: ${SITE.email.partnerships}`,
    `# Generated at build time from src/config/site.ts`,
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

  // Trailing newline is required by several crawlers' parsers.
  const body = `${[...header, ...records].join('\n')}\n`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
