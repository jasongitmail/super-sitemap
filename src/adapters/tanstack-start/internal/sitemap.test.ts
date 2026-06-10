import { describe, expect, it } from 'vitest';

import { getBody, getHeaders, prepareSitemapPaths, response } from './sitemap.js';

type TestRouteRecord = {
  filePath?: string;
  fullPath?: string;
  id?: string;
  path?: string;
  to?: string;
};

function routerFromRoutes(routes: TestRouteRecord[]) {
  return () => ({
    routesByPath: Object.fromEntries(
      routes.map((route) => [route.fullPath ?? route.to ?? route.path ?? route.id ?? '/', route])
    ),
  });
}

describe('TanStack Start adapter sitemap paths', () => {
  it('uses route map keys as normalized routes when router records only have ids', () => {
    const paths = prepareSitemapPaths({
      paramValues: {
        '/blog/$slug': ['hello-world'],
      },
      router: () => ({
        routesByPath: {
          '/blog/$slug': { id: '/_layout/blog/$slug' },
        },
      }),
    });

    expect(paths.map(({ path }) => path)).toEqual(['/blog/hello-world']);
  });

  it('rejects empty route sources through param validation', () => {
    expect(() =>
      prepareSitemapPaths({
        paramValues: { '/missing/$slug': ['hello-world'] },
        router: routerFromRoutes([{ id: '__root__' }]),
      })
    ).toThrow(
      "super-sitemap: paramValues were provided for a route that does not exist: '/missing/$slug'."
    );
  });

  it('preserves deterministic default ordering without alpha sorting', () => {
    const paths = prepareSitemapPaths({
      paramValues: {
        '/blog/$slug': ['hello-world', 'another-post'],
      },
      router: routerFromRoutes([
        { fullPath: '/blog/$slug' },
        { fullPath: '/about' },
        { fullPath: '/' },
      ]),
    });

    expect(paths.map(({ path }) => path)).toEqual([
      '/',
      '/about',
      '/blog/hello-world',
      '/blog/another-post',
    ]);
  });
});

describe('TanStack Start adapter response wrapper', () => {
  const router = () => ({
    routesByPath: {
      '/about': { fullPath: '/about', id: '/about' },
      '/blog': { fullPath: '/blog', id: '/blog' },
      '/blog/$slug': { fullPath: '/blog/$slug', id: '/blog/$slug' },
      '/docs/$': { fullPath: '/docs/$', id: '/docs/$' },
      '/rankings/$country/$state': {
        fullPath: '/rankings/$country/$state',
        id: '/rankings/$country/$state',
      },
    },
  });

  const locsFromXml = (xml: string) =>
    Array.from(xml.matchAll(/<loc>https:\/\/example\.com([^<]+)<\/loc>/g)).map(([, path]) => path);

  it('requires origin and generates static route XML through the core renderer', async () => {
    await expect(
      response({
        // @ts-expect-error - runtime validation covers JavaScript callers.
        origin: undefined,
        router: routerFromRoutes([{ fullPath: '/about' }]),
      })
    ).rejects.toThrow('super-sitemap: `origin` property is required in sitemap config.');

    const res = await response({
      origin: 'https://example.com',
      router: routerFromRoutes([{ fullPath: '/' }, { fullPath: '/about' }]),
    });
    const xml = await res.text();

    expect(res.headers.get('content-type')).toBe('application/xml');
    expect(res.headers.get('cache-control')).toBe('max-age=0, s-maxage=3600');
    expect(xml).toContain('<urlset');
    expect(locsFromXml(xml)).toEqual(['/', '/about']);
  });

  it('calls the getRouter function for each sitemap response', async () => {
    let calls = 0;
    const getRouter = () => {
      calls += 1;
      return {
        routesByPath: {
          '/blog/$slug': { fullPath: '/blog/$slug', id: '/blog/$slug' },
          ...(calls > 1 ? { '/docs/$slug': { fullPath: '/docs/$slug', id: '/docs/$slug' } } : {}),
        },
      };
    };

    const firstRes = await response({
      origin: 'https://example.com',
      paramValues: { '/blog/$slug': ['hello-world'] },
      router: getRouter,
    });
    const secondRes = await response({
      origin: 'https://example.com',
      paramValues: {
        '/blog/$slug': ['another-post'],
        '/docs/$slug': ['guide'],
      },
      router: getRouter,
    });

    expect(calls).toBe(2);
    expect(locsFromXml(await firstRes.text())).toEqual(['/blog/hello-world']);
    expect(locsFromXml(await secondRes.text())).toEqual(['/blog/another-post', '/docs/guide']);
  });

  it('exports body and header helpers for framework-specific response wrappers', () => {
    const xml = getBody({
      origin: 'https://example.com',
      router: routerFromRoutes([{ fullPath: '/' }, { fullPath: '/about' }]),
    });
    const headers = getHeaders({
      customHeaders: {
        'cache-control': 'max-age=0, s-maxage=86400',
        'x-custom': 'yes',
      },
    });

    expect(xml).toContain('<urlset');
    expect(xml).toContain('<loc>https://example.com/</loc>');
    expect(xml).toContain('<loc>https://example.com/about</loc>');
    expect(headers).toEqual({
      'cache-control': 'max-age=0, s-maxage=86400',
      'content-type': 'application/xml',
      'x-custom': 'yes',
    });
  });

  it('interpolates dynamic, multi-param, splat, metadata, and defaults without TanStack syntax', async () => {
    const res = await response({
      defaultChangefreq: 'daily',
      defaultPriority: 0.7,
      origin: 'https://example.com',
      paramValues: {
        '/blog/$slug': ['hello-world', 'another-post'],
        '/docs/$': ['intro/getting-started'],
        '/rankings/$country/$state': [
          {
            changefreq: 'weekly',
            lastmod: '2026-01-01',
            priority: 0.8,
            values: ['usa', 'new-york'],
          },
          {
            values: ['canada', 'ontario'],
          },
        ],
      },
      router,
      sort: 'alpha',
    });
    const xml = await res.text();

    expect(locsFromXml(xml)).toEqual([
      '/about',
      '/blog',
      '/blog/another-post',
      '/blog/hello-world',
      '/docs/intro/getting-started',
      '/rankings/canada/ontario',
      '/rankings/usa/new-york',
    ]);
    expect(xml).toContain('<lastmod>2026-01-01</lastmod>');
    expect(xml).toContain('<changefreq>weekly</changefreq>');
    expect(xml).toContain('<priority>0.8</priority>');
    expect(xml).toContain('<loc>https://example.com/rankings/canada/ontario</loc>');
    expect(xml).toContain('<changefreq>daily</changefreq>');
    expect(xml).toContain('<priority>0.7</priority>');
    expect(xml).not.toMatch(/<loc>[^<]*(\$|\{|\}|^_)|<loc>[^<]*\/_/);
  });

  it('requires paramValues for parameterized routes and reports TanStack-specific unknown keys', async () => {
    await expect(
      response({
        origin: 'https://example.com',
        router: routerFromRoutes([{ fullPath: '/blog/$slug' }]),
      })
    ).rejects.toThrow("super-sitemap: paramValues not provided for route: '/blog/$slug'.");
    await expect(
      response({
        origin: 'https://example.com',
        paramValues: { '/missing/$slug': ['hello-world'] },
        router: routerFromRoutes([{ fullPath: '/blog/$slug' }]),
      })
    ).rejects.toThrow(
      "super-sitemap: paramValues were provided for a route that does not exist: '/missing/$slug'."
    );
  });

  it('includes additional paths once, lets processPaths run before dedupe and sort, and overrides headers case-insensitively', async () => {
    const res = await response({
      additionalPaths: ['manual.pdf', '/about'],
      defaultChangefreq: 'daily',
      headers: {
        'Cache-Control': 'max-age=0, s-maxage=60',
        'Content-Type': 'text/custom+xml',
      },
      origin: 'https://example.com',
      processPaths: (paths) => {
        expect(paths.at(-2)).toMatchObject({ path: '/manual.pdf' });
        expect(paths.at(-1)).toMatchObject({ path: '/about' });
        expect(paths.filter(({ path }) => path === '/about')).toHaveLength(2);
        return [
          ...paths,
          { changefreq: 'weekly', path: '/about' },
          { path: '/zzzz-process-paths-sort-marker' },
        ];
      },
      router: routerFromRoutes([{ fullPath: '/about' }]),
      sort: 'alpha',
    });
    const xml = await res.text();

    expect(res.headers.get('cache-control')).toBe('max-age=0, s-maxage=60');
    expect(res.headers.get('content-type')).toBe('text/custom+xml');
    expect(locsFromXml(xml)).toEqual(['/about', '/manual.pdf', '/zzzz-process-paths-sort-marker']);
    expect(xml).toContain(
      '<loc>https://example.com/about</loc>\n    <changefreq>weekly</changefreq>'
    );
  });

  it('preserves generated order when sorting is disabled explicitly', async () => {
    const res = await response({
      origin: 'https://example.com',
      paramValues: {
        '/blog/$slug': ['hello-world', 'another-post'],
      },
      router: routerFromRoutes([
        { fullPath: '/blog/$slug' },
        { fullPath: '/about' },
        { fullPath: '/' },
      ]),
      sort: false,
    });

    expect(locsFromXml(await res.text())).toEqual([
      '/',
      '/about',
      '/blog/hello-world',
      '/blog/another-post',
    ]);
  });

  it('supports sitemap indexes, paginated pages, and invalid page response statuses', async () => {
    const indexRes = await response({
      maxPerPage: 2,
      origin: 'https://example.com',
      router: routerFromRoutes([
        { fullPath: '/' },
        { fullPath: '/about' },
        { fullPath: '/pricing' },
      ]),
    });
    expect(await indexRes.text()).toContain('<sitemapindex');

    const pageRes = await response({
      maxPerPage: 2,
      origin: 'https://example.com',
      page: '2',
      router: routerFromRoutes([
        { fullPath: '/' },
        { fullPath: '/about' },
        { fullPath: '/pricing' },
      ]),
    });
    expect(locsFromXml(await pageRes.text())).toEqual(['/pricing']);

    const invalidRes = await response({
      maxPerPage: 2,
      origin: 'https://example.com',
      page: 'invalid',
      router: routerFromRoutes([{ fullPath: '/' }]),
    });
    expect(invalidRes.status).toBe(400);
    expect(await invalidRes.text()).toBe('Invalid page param');

    const notFoundRes = await response({
      maxPerPage: 2,
      origin: 'https://example.com',
      page: '99',
      router: routerFromRoutes([{ fullPath: '/' }]),
    });
    expect(notFoundRes.status).toBe(404);
    expect(await notFoundRes.text()).toBe('Page does not exist');
  });

  it('supports explicit optional and required locale route mappings', async () => {
    const optionalLocaleRes = await response({
      lang: { alternates: ['de'], default: 'en' },
      langParam: { mode: 'optional', paramName: 'locale' },
      origin: 'https://example.com',
      router: routerFromRoutes([{ fullPath: '/{-$locale}/about' }]),
    });
    const requiredLocaleRes = await response({
      lang: { alternates: ['de'], default: 'en' },
      langParam: { mode: 'required', paramName: 'locale' },
      origin: 'https://example.com',
      router: routerFromRoutes([{ fullPath: '/$locale/docs' }]),
    });

    expect(locsFromXml(await optionalLocaleRes.text())).toEqual(['/about', '/de/about']);
    expect(locsFromXml(await requiredLocaleRes.text())).toEqual(['/en/docs', '/de/docs']);
  });
});
