import { describe, expect, it } from 'vitest';

import type { NormalizedRoute } from './types.js';

import { getBody, getHeaders, preparePaths, response } from './sitemap.js';

const source = (compatibilityKey: string) => ({
  adapter: 'unit',
  compatibilityKey,
});

const staticNormalizedRoute = (path: string): NormalizedRoute => ({
  id: path,
  segments: path === '/' ? [] : [{ kind: 'static', value: path.slice(1) }],
  source: source(path),
});

const blogSlugNormalizedRoute: NormalizedRoute = {
  id: '/blog/[slug]',
  params: [{ name: 'slug', segmentIndex: 1 }],
  segments: [
    { kind: 'static', value: 'blog' },
    { kind: 'param', name: 'slug' },
  ],
  source: source('/blog/[slug]'),
};

describe('core sitemap preparePaths', () => {
  it('combines normalizedRoute paths, additional paths, processPaths, dedupe, and sort', () => {
    const paths = preparePaths({
      additionalPaths: ['manual.pdf', '/about'],
      defaultChangefreq: 'daily',
      normalizedRoutes: [staticNormalizedRoute('/about'), staticNormalizedRoute('/')],
      processPaths: (pathObjs) => [...pathObjs, { changefreq: 'weekly', path: '/about' }],
      sort: 'alpha',
    });

    expect(paths).toEqual([
      { changefreq: 'daily', path: '/' },
      { changefreq: 'weekly', path: '/about' },
      { changefreq: 'daily', path: '/manual.pdf' },
    ]);
  });

  it('formats route param errors with the adapter name and remediation guidance', () => {
    expect(() => preparePaths({ normalizedRoutes: [blogSlugNormalizedRoute] })).toThrow(
      "super-sitemap: paramValues not provided for route: '/blog/[slug]'. Update excludeRoutePatterns to exclude this route or add data for this route's params to paramValues."
    );

    expect(() =>
      preparePaths({
        normalizedRoutes: [blogSlugNormalizedRoute],
        paramValues: { '/missing/[slug]': ['x'] },
      })
    ).toThrow(
      "super-sitemap: paramValues were provided for a route that does not exist: '/missing/[slug]'. Remove this property from paramValues or update your route source."
    );
  });
});

describe('core sitemap getHeaders', () => {
  it('returns default headers and merges custom headers case-insensitively', () => {
    expect(getHeaders()).toEqual({
      'cache-control': 'max-age=0, s-maxage=3600',
      'content-type': 'application/xml',
    });
    expect(
      getHeaders({ customHeaders: { 'Cache-Control': 'max-age=0, s-maxage=60', 'X-Custom': 'y' } })
    ).toEqual({
      'cache-control': 'max-age=0, s-maxage=60',
      'content-type': 'application/xml',
      'x-custom': 'y',
    });
  });
});

describe('core sitemap getBody and response', () => {
  const normalizedRoutes = [
    staticNormalizedRoute('/'),
    staticNormalizedRoute('/about'),
    staticNormalizedRoute('/pricing'),
  ];

  it('requires origin', () => {
    expect(() =>
      // @ts-expect-error - runtime validation covers JavaScript callers.
      getBody({ normalizedRoutes, origin: undefined })
    ).toThrow('super-sitemap: `origin` property is required in sitemap config.');
    expect(() =>
      // @ts-expect-error - runtime validation covers JavaScript callers.
      response({ normalizedRoutes, origin: undefined })
    ).toThrow('super-sitemap: `origin` property is required in sitemap config.');
  });

  it('renders a sitemap index when paths exceed one page and pages on request', async () => {
    const indexBody = getBody({
      maxPerPage: 2,
      normalizedRoutes,
      origin: 'https://example.com',
    });
    expect(indexBody).toContain('<sitemapindex');
    expect(indexBody).toContain('<loc>https://example.com/sitemap2.xml</loc>');

    const pageRes = response({
      maxPerPage: 2,
      normalizedRoutes,
      origin: 'https://example.com',
      page: '2',
    });
    expect(await pageRes.text()).toContain('<loc>https://example.com/pricing</loc>');
  });

  it('reports pagination errors as plain strings from getBody and statuses from response', async () => {
    const invalidArgs = {
      maxPerPage: 2,
      normalizedRoutes,
      origin: 'https://example.com',
    };

    expect(getBody({ ...invalidArgs, page: 'invalid' })).toBe('Invalid page param');
    expect(getBody({ ...invalidArgs, page: '99' })).toBe('Page does not exist');

    const invalidRes = response({ ...invalidArgs, page: 'invalid' });
    expect(invalidRes.status).toBe(400);
    expect(await invalidRes.text()).toBe('Invalid page param');

    const notFoundRes = response({ ...invalidArgs, page: '99' });
    expect(notFoundRes.status).toBe(404);
    expect(await notFoundRes.text()).toBe('Page does not exist');
  });

  it('returns a 200 XML response with merged headers', async () => {
    const res = response({
      headers: { 'Cache-Control': 'max-age=0, s-maxage=60' },
      normalizedRoutes,
      origin: 'https://example.com',
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('max-age=0, s-maxage=60');
    expect(res.headers.get('content-type')).toBe('application/xml');
    expect(await res.text()).toContain('<loc>https://example.com/about</loc>');
  });
});
