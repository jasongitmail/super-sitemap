import { describe, expect, it } from 'vitest';

import { GET } from './(public)/[[lang]]/sitemap[[page]].xml/+server.js';

type RequestEvent = Parameters<typeof GET>[0];

const event = (page?: string) => ({ params: { page } } as unknown as RequestEvent);

describe('demo app sitemap endpoint (end to end)', () => {
  it('serves valid sitemap XML from the real SvelteKit route handler', async () => {
    const res = await GET(event());
    const xml = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/xml');

    // Valid sitemap document.
    expect(xml).toContain('<urlset');

    // Static route with the trailing slash added by the demo's processPaths.
    expect(xml).toContain('https://example.com/about/');
    // Localized alternate from the [[lang]] route and lang config.
    expect(xml).toContain('https://example.com/zh/about/');
    // Parameterized route interpolated from paramValues.
    expect(xml).toContain('https://example.com/campsites/usa/new-york/');

    // Real import.meta.glob discovery of .md and .svx pages.
    expect(xml).toContain('https://example.com/markdown-md/');
    expect(xml).toContain('https://example.com/markdown-svx/');

    // excludeRoutePatterns: no dashboard, secret group, or paginated routes.
    expect(xml).not.toContain('/dashboard');
    expect(xml).not.toContain('secret');

    // No SvelteKit route syntax may leak into any <loc> in the published sitemap.
    const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
    expect(locs.length).toBeGreaterThan(0);
    for (const loc of locs) {
      expect(loc).not.toMatch(/[[\]()]/);
    }

    // Only page routes appear: +server.ts endpoints (this sitemap route itself
    // and the og image endpoint) are invisible to route discovery.
    for (const loc of locs) {
      expect(loc).not.toContain('sitemap');
      expect(loc).not.toContain('/og/');
    }
  });

  it('returns pagination error statuses through the real route handler', async () => {
    const invalidRes = await GET(event('invalid'));
    expect(invalidRes.status).toBe(400);

    const notFoundRes = await GET(event('99'));
    expect(notFoundRes.status).toBe(404);
  });
});
