import { describe, expect, it } from 'vitest';

// Evaluate the app router (and generated route tree) before the sitemap route
// module, mirroring TanStack Start's own evaluation order. The route file and
// router.tsx import each other (route -> router -> routeTree.gen -> route), so
// importing the route file first would observe an uninitialized `Route`.
import '../src/router';

const { Route } = await import('../src/routes/sitemap{-$page}[.]xml');

const expectedLocs = [
  '<loc>https://example.com/</loc>',
  '<loc>https://example.com/about</loc>',
  '<loc>https://example.com/blog/hello-world</loc>',
  '<loc>https://example.com/blog/another-post</loc>',
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

describe('super-sitemap TanStack Start integration', () => {
  it('generates a sitemap from the real generated route tree (no page param)', async () => {
    const res = await get();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/xml');

    const body = await res.text();

    expect(body).toContain('<urlset');
    for (const loc of expectedLocs) {
      expect(body).toContain(loc);
    }

    // TanStack route syntax (e.g. `$slug`) must never leak into emitted URLs.
    const locs = [...body.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1]);
    expect(locs.length).toBeGreaterThan(0);
    for (const loc of locs) {
      expect(loc).not.toContain('$');
    }

    // Only page routes appear — exactly these, nothing more. Server-only routes
    // (this sitemap route itself) are excluded automatically.
    expect([...locs].sort()).toEqual(
      expectedLocs.map((loc) => loc.replace('<loc>', '').replace('</loc>', '')).sort()
    );
  });

  it("returns the same urlset for page '1'", async () => {
    const res = await get('1');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/xml');

    const body = await res.text();

    expect(body).toContain('<urlset');
    for (const loc of expectedLocs) {
      expect(body).toContain(loc);
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
