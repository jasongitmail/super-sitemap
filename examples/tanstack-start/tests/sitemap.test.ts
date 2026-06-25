import { describe, expect, it } from 'vitest';

import { optionalStaticSuffixSuccessPaths } from '../../test-utils/framework-routing-contract.js';
// Evaluate the app router (and generated route tree) before the sitemap route
// module, mirroring TanStack Start's own evaluation order. The route file and
// router.tsx import each other (route -> router -> routeTree.gen -> route), so
// importing the route file first would observe an uninitialized `Route`.
import '../src/router';

const { Route } = await import('../src/routes/(public)/sitemap{-$page}[.]xml');

const expectedLocs = [
  'https://example.com/',
  'https://example.com/about',
  'https://example.com/blog/hello-world',
  'https://example.com/blog/another-post',
  'https://example.com/blog/awesome-post',
  'https://example.com/blog/tag/red',
  'https://example.com/campsites/usa/new-york',
  'https://example.com/foo-path-1',
  'https://example.com/foo.pdf',
  ...optionalStaticSuffixSuccessPaths.map((path) => `https://example.com${path}`),
  'https://example.com/optionals/optional-1',
  'https://example.com/zh/about',
  'https://example.com/zh/blog/hello-world',
];

/** Invokes the sitemap route's GET server handler the way TanStack Start does. */
async function get(page?: string): Promise<Response> {
  const handler = Route.options.server?.handlers?.GET;
  if (typeof handler !== 'function') throw new Error('GET handler not found on Route');

  const path = page === undefined ? '/sitemap.xml' : `/sitemap${page}.xml`;
  const ctx = {
    params: { page },
    request: new Request(`https://example.com${path}`),
  };
  return (await handler(ctx as never)) as Response;
}

/**
 * Extracts sitemap loc values from a generated XML response.
 */
function getLocs(xml: string) {
  return [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1]);
}

describe('super-sitemap TanStack Start integration', () => {
  it('generates a sitemap from the real generated route tree (no page param)', async () => {
    const res = await get();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/xml');

    const body = await res.text();

    expect(body).toContain('<urlset');
    for (const loc of expectedLocs) {
      expect(body).toContain(`<loc>${loc}</loc>`);
    }

    const locs = getLocs(body);
    expect(locs.length).toBeGreaterThan(0);

    // TanStack route syntax (e.g. `$slug` and `{-$locale}`) must never leak into emitted URLs.
    for (const loc of locs) {
      expect(loc).not.toContain('$');
      expect(loc).not.toContain('{');
      expect(loc).not.toContain('}');
    }

    // Excluded routes and server-only routes do not appear.
    expect(body).not.toContain('/dashboard');
    expect(body).not.toContain('/landing-page-draft');
    expect(body).not.toContain('/to-exclude');
    expect(body).not.toContain('/api/');
    expect(body).not.toContain('/blog/page/');
    for (const loc of locs) {
      expect(loc).not.toContain('/sitemap');
    }

    // Per-route metadata from ParamValue objects is preserved.
    expect(body).toContain('<lastmod>2025-01-01T00:00:00Z</lastmod>');
    expect(body).toContain('<priority>0.5</priority>');
  });

  it("returns the same urlset for page '1'", async () => {
    const res = await get('1');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/xml');

    const body = await res.text();

    expect(body).toContain('<urlset');
    for (const loc of expectedLocs) {
      expect(body).toContain(`<loc>${loc}</loc>`);
    }
  });

  it("returns 400 for page 'invalid'", async () => {
    const res = await get('invalid');
    expect(res.status).toBe(400);
  });

  it("returns 404 for out-of-range page '99'", async () => {
    const res = await get('99');
    expect(res.status).toBe(404);
  });
});
