import { describe, expect, it } from 'vitest';

import { generatePathsFromRouteTemplates } from '../../core/index.js';
import {
  buildTanStackStartSitemap,
  createTanStackStartRouteTemplates,
  generateTanStackStartPaths,
  getBody,
  getHeaders,
  getTanStackStartRouteRecordsFromRouteTree,
  parseTanStackStartRouteTemplates,
  response,
} from './index.js';

describe('TanStack Start adapter route parser', () => {
  it('normalizes static, root, and index routes into syntax-free templates', () => {
    const templates = createTanStackStartRouteTemplates({
      routes: [{ fullPath: '/' }, { fullPath: '' }, { fullPath: '/about/team' }],
    });

    expect(templates).toHaveLength(2);
    expect(templates.map((template) => template.segments)).toEqual([
      [],
      [
        { kind: 'static', value: 'about' },
        { kind: 'static', value: 'team' },
      ],
    ]);
    expect(templates.map((template) => template.source.compatibilityKey)).toEqual([
      '/',
      '/about/team',
    ]);
  });

  it('normalizes dynamic params, preserves multi-param order, and handles splat rest params', () => {
    const [blog] = parseTanStackStartRouteTemplates({ fullPath: '/blog/$slug' });
    const [campsite] = parseTanStackStartRouteTemplates({
      fullPath: '/campsites/$country/$state',
    });
    const [docs] = parseTanStackStartRouteTemplates({ fullPath: '/docs/$' });

    expect(blog).toMatchObject({
      params: [{ name: 'slug', rest: false, segmentIndex: 1 }],
      segments: [
        { kind: 'static', value: 'blog' },
        { kind: 'param', name: 'slug', rest: false },
      ],
      source: { adapter: 'tanstack-start', compatibilityKey: '/blog/$slug' },
    });
    expect(campsite?.params).toEqual([
      { name: 'country', rest: false, segmentIndex: 1 },
      { name: 'state', rest: false, segmentIndex: 2 },
    ]);
    expect(
      generatePathsFromRouteTemplates({
        paramValues: {
          '/campsites/$country/$state': [
            ['usa', 'new-york'],
            ['canada', 'ontario'],
          ],
        },
        templates: campsite ? [campsite] : [],
      }).map(({ path }) => path)
    ).toEqual(['/campsites/usa/new-york', '/campsites/canada/ontario']);
    expect(docs).toMatchObject({
      params: [{ name: '_splat', rest: true, segmentIndex: 1 }],
      segments: [
        { kind: 'static', value: 'docs' },
        { kind: 'param', name: '_splat', rest: true },
      ],
    });
  });

  it('expands optional params to base and dynamic variants without implicit locale inference', () => {
    const templates = parseTanStackStartRouteTemplates({ fullPath: '/blog/{-$category}' });
    const langTemplates = parseTanStackStartRouteTemplates({ fullPath: '/{-$lang}/about' });

    expect(templates).toMatchObject([
      {
        params: [],
        segments: [{ kind: 'static', value: 'blog' }],
        source: { compatibilityKey: '/blog' },
      },
      {
        params: [{ name: 'category', rest: false, segmentIndex: 1 }],
        segments: [
          { kind: 'static', value: 'blog' },
          { kind: 'param', name: 'category', rest: false },
        ],
        source: { compatibilityKey: '/blog/{-$category}' },
      },
    ]);
    expect(langTemplates[0]?.locale).toBeUndefined();
    expect(langTemplates[1]?.locale).toBeUndefined();
    expect(langTemplates[1]?.params).toEqual([{ name: 'lang', rest: false, segmentIndex: 0 }]);
  });

  it('omits pathless and group-like segments and respects canonical fullPath over path', () => {
    const [template] = parseTanStackStartRouteTemplates({
      fullPath: '/app/$postId',
      id: '/_layout/(marketing)/app/$postId',
      path: '/_layout/(marketing)/wrong/$ignored',
    });
    const [pathlessTemplate] = parseTanStackStartRouteTemplates({
      fullPath: '/_layout/(marketing)/pricing',
    });

    expect(template).toMatchObject({
      params: [{ name: 'postId', rest: false, segmentIndex: 1 }],
      segments: [
        { kind: 'static', value: 'app' },
        { kind: 'param', name: 'postId', rest: false },
      ],
      source: {
        compatibilityKey: '/app/$postId',
        id: '/_layout/(marketing)/app/$postId',
        path: '/_layout/(marketing)/wrong/$ignored',
      },
    });
    expect(pathlessTemplate?.segments).toEqual([{ kind: 'static', value: 'pricing' }]);
  });

  it('retains source metadata and collapses duplicate canonical records deterministically', () => {
    const templates = createTanStackStartRouteTemplates({
      routes: [
        { filePath: '/src/routes/duplicate-a.tsx', fullPath: '/duplicate' },
        { filePath: '/src/routes/duplicate-b.tsx', fullPath: '/duplicate' },
        { filePath: '/src/routes/about.tsx', fullPath: '/about' },
      ],
    });

    expect(templates).toHaveLength(2);
    expect(templates.map((template) => template.source)).toEqual([
      {
        adapter: 'tanstack-start',
        compatibilityKey: '/about',
        filePath: '/src/routes/about.tsx',
        fullPath: '/about',
      },
      {
        adapter: 'tanstack-start',
        compatibilityKey: '/duplicate',
        filePath: '/src/routes/duplicate-a.tsx',
        fullPath: '/duplicate',
      },
    ]);
  });

  it('uses TanStack compatibility keys for core safety errors', () => {
    const templates = createTanStackStartRouteTemplates({
      routes: [{ fullPath: '/blog/$slug' }],
    });

    expect(() => generatePathsFromRouteTemplates({ templates })).toThrow(
      "Core: paramValues not provided for route: '/blog/$slug'."
    );
    expect(() =>
      generatePathsFromRouteTemplates({
        paramValues: { '/blog/$missing': ['hello-world'] },
        templates,
      })
    ).toThrow("Core: paramValues were provided for a route that does not exist: '/blog/$missing'.");
  });

  it('allows optional route variants to be excluded explicitly', () => {
    const templates = createTanStackStartRouteTemplates({
      excludeRoutePatterns: ['/blog/\\{\\-\\$category\\}'],
      routes: [{ fullPath: '/blog/{-$category}' }],
    });

    expect(templates.map((template) => template.source.compatibilityKey)).toEqual(['/blog']);
    expect(generatePathsFromRouteTemplates({ templates }).map(({ path }) => path)).toEqual([
      '/blog',
    ]);
  });

  it('supports explicit locale mapping without leaking TanStack syntax into normalized IR', () => {
    const [optionalLocale] = parseTanStackStartRouteTemplates(
      { fullPath: '/{-$locale}/about' },
      { locale: { mode: 'optional', paramName: 'locale' } }
    );
    const [requiredLocale] = parseTanStackStartRouteTemplates(
      { fullPath: '/$locale/docs/$slug' },
      { locale: { mode: 'required', paramName: 'locale' } }
    );

    expect(optionalLocale).toMatchObject({
      locale: { mode: 'optional', paramName: 'locale', segmentIndex: 0 },
      params: [],
      segments: [
        { kind: 'locale', name: 'locale' },
        { kind: 'static', value: 'about' },
      ],
    });
    expect(requiredLocale).toMatchObject({
      locale: { mode: 'required', paramName: 'locale', segmentIndex: 0 },
      params: [{ name: 'slug', rest: false, segmentIndex: 2 }],
      segments: [
        { kind: 'locale', name: 'locale' },
        { kind: 'static', value: 'docs' },
        { kind: 'param', name: 'slug', rest: false },
      ],
    });

    for (const template of [optionalLocale, requiredLocale]) {
      expect(template?.segments).not.toContainEqual(
        expect.objectContaining({ value: expect.stringMatching(/\$|\{|\}|\(|\)|^_/) })
      );
      expect(template?.segments).not.toContainEqual(
        expect.objectContaining({ name: expect.stringMatching(/\$|\{|\}/) })
      );
    }
  });
});

describe('TanStack Start adapter route sources', () => {
  const routeTree = {
    children: {
      aboutRoute: {
        children: [
          { fullPath: '/about/team', id: '/about/team' },
          { fullPath: '/about/company', id: '/about/company' },
        ],
        fullPath: '/about',
        id: '/about',
      },
      appLayoutRoute: {
        children: {
          dashboardRoute: { fullPath: '/dashboard', id: '/_app/dashboard' },
        },
        fullPath: '/_app',
        id: '/_app',
      },
      blogRoute: {
        children: {
          postRoute: { fullPath: '/blog/$slug', id: '/blog/$slug' },
        },
        fullPath: '/blog',
        id: '/blog',
      },
    },
    fullPath: '/',
    id: '__root__',
  };

  it('recursively discovers routes from route tree object-map and array child shapes', () => {
    const templates = createTanStackStartRouteTemplates({ routeTree });

    expect(templates.map((template) => template.source.compatibilityKey)).toEqual([
      '/about',
      '/about/company',
      '/about/team',
      '/blog',
      '/blog/$slug',
      '/dashboard',
    ]);
  });

  it('produces route records from route tree input without emitting layout-only nodes', () => {
    expect(getTanStackStartRouteRecordsFromRouteTree(routeTree)).toEqual([
      { fullPath: '/about', id: '/about' },
      { fullPath: '/about/company', id: '/about/company' },
      { fullPath: '/about/team', id: '/about/team' },
      { fullPath: '/blog', id: '/blog' },
      { fullPath: '/blog/$slug', id: '/blog/$slug' },
      { fullPath: '/dashboard', id: '/_app/dashboard' },
    ]);
  });

  it('matches equivalent manifest records and route tree output', () => {
    const manifestTemplates = createTanStackStartRouteTemplates({
      routes: [
        { fullPath: '/_app', id: '/_app' },
        { fullPath: '/dashboard', id: '/_app/dashboard' },
        { fullPath: '/blog/$slug', id: '/blog/$slug' },
        { fullPath: '/about', id: '/about' },
        { fullPath: '/blog', id: '/blog' },
        { fullPath: '/about/team', id: '/about/team' },
        { fullPath: '/about/company', id: '/about/company' },
      ],
    });
    const routeTreeTemplates = createTanStackStartRouteTemplates({ routeTree });

    expect(routeTreeTemplates).toEqual(manifestTemplates);
  });

  it('does not emit false root routes from manifest layout-only records', () => {
    const templates = createTanStackStartRouteTemplates({
      routes: [
        { fullPath: '/_app', id: '/_app' },
        { fullPath: '/(marketing)', id: '/(marketing)' },
        { fullPath: '/_app/dashboard', id: '/_app/dashboard' },
      ],
    });

    expect(templates.map((template) => template.source.compatibilityKey)).toEqual(['/dashboard']);
    expect(generatePathsFromRouteTemplates({ templates }).map(({ path }) => path)).toEqual([
      '/dashboard',
    ]);
  });

  it('supports minimum route record source fields and returns deterministic order', () => {
    const templates = createTanStackStartRouteTemplates({
      routes: [
        { id: '/id-only' },
        { path: '/path-only' },
        { to: '/to-only/$id' },
        { fullPath: '/full-path' },
      ],
    });

    expect(templates.map((template) => template.source.compatibilityKey)).toEqual([
      '/full-path',
      '/id-only',
      '/path-only',
      '/to-only/$id',
    ]);
  });

  it('collapses duplicate route tree and manifest records deterministically', () => {
    const templates = createTanStackStartRouteTemplates({
      routes: [
        { filePath: 'b.tsx', fullPath: '/duplicate' },
        { filePath: 'a.tsx', fullPath: '/duplicate' },
        { fullPath: '/alpha' },
      ],
    });

    expect(templates.map((template) => template.source)).toEqual([
      { adapter: 'tanstack-start', compatibilityKey: '/alpha', fullPath: '/alpha' },
      {
        adapter: 'tanstack-start',
        compatibilityKey: '/duplicate',
        filePath: 'b.tsx',
        fullPath: '/duplicate',
      },
    ]);
  });

  it('applies exclusions before emitting templates and before requiring param values', () => {
    const templates = createTanStackStartRouteTemplates({
      excludeRoutePatterns: ['/blog/\\$slug'],
      routeTree,
    });

    expect(templates.map((template) => template.source.compatibilityKey)).toEqual([
      '/about',
      '/about/company',
      '/about/team',
      '/blog',
      '/dashboard',
    ]);
    expect(generatePathsFromRouteTemplates({ templates }).map(({ path }) => path)).toEqual([
      '/about',
      '/about/company',
      '/about/team',
      '/blog',
      '/dashboard',
    ]);
  });

  it('rejects missing and ambiguous route sources explicitly', () => {
    expect(() => createTanStackStartRouteTemplates({})).toThrow(
      'TanStack Start adapter: provide exactly one route source: `routeTree` or `routes`.'
    );
    expect(() =>
      createTanStackStartRouteTemplates({ routeTree, routes: [{ fullPath: '/about' }] })
    ).toThrow('TanStack Start adapter: provide exactly one route source: `routeTree` or `routes`.');
    expect(() => createTanStackStartRouteTemplates({ routes: [{}] })).toThrow(
      'TanStack Start adapter: route records must include at least one path field: `fullPath`, `to`, `path`, or `id`.'
    );
  });
});

describe('TanStack Start adapter response wrapper', () => {
  const routeTree = {
    children: {
      aboutRoute: { fullPath: '/about', id: '/about' },
      blogRoute: {
        children: {
          postRoute: { fullPath: '/blog/$slug', id: '/blog/$slug' },
        },
        fullPath: '/blog',
        id: '/blog',
      },
      docsRoute: { fullPath: '/docs/$', id: '/docs/$' },
      rankingRoute: { fullPath: '/rankings/$country/$state', id: '/rankings/$country/$state' },
    },
    fullPath: '/',
    id: '__root__',
  };

  const locsFromXml = (xml: string) =>
    Array.from(xml.matchAll(/<loc>https:\/\/example\.com([^<]+)<\/loc>/g)).map(([, path]) => path);

  it('requires origin and generates static route XML through the core renderer', async () => {
    await expect(
      response({
        // @ts-expect-error - runtime validation covers JavaScript callers.
        origin: undefined,
        routes: [{ fullPath: '/about' }],
      })
    ).rejects.toThrow('TanStack Start sitemap: `origin` property is required in sitemap config.');

    const res = await response({
      origin: 'https://example.com',
      routes: [{ fullPath: '/' }, { fullPath: '/about' }],
    });
    const xml = await res.text();

    expect(res.headers.get('content-type')).toBe('application/xml');
    expect(res.headers.get('cache-control')).toBe('max-age=0, s-maxage=3600');
    expect(xml).toContain('<urlset');
    expect(locsFromXml(xml)).toEqual(['/', '/about']);
  });

  it('exports body and header helpers for framework-specific response wrappers', () => {
    const xml = getBody({
      origin: 'https://example.com',
      routes: [{ fullPath: '/' }, { fullPath: '/about' }],
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
      routeTree,
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
        routes: [{ fullPath: '/blog/$slug' }],
      })
    ).rejects.toThrow("TanStack Start sitemap: paramValues not provided for route: '/blog/$slug'.");
    await expect(
      response({
        origin: 'https://example.com',
        paramValues: { '/missing/$slug': ['hello-world'] },
        routes: [{ fullPath: '/blog/$slug' }],
      })
    ).rejects.toThrow(
      "TanStack Start sitemap: paramValues were provided for a route that does not exist: '/missing/$slug'."
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
      routes: [{ fullPath: '/about' }],
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

  it('preserves deterministic default ordering without alpha sorting', () => {
    const paths = generateTanStackStartPaths({
      paramValues: {
        '/blog/$slug': ['hello-world', 'another-post'],
      },
      routes: [{ fullPath: '/blog/$slug' }, { fullPath: '/about' }, { fullPath: '/' }],
    });

    expect(paths.map(({ path }) => path)).toEqual([
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
      routes: [{ fullPath: '/' }, { fullPath: '/about' }, { fullPath: '/pricing' }],
    });
    expect(await indexRes.text()).toContain('<sitemapindex');

    const pageRes = await response({
      maxPerPage: 2,
      origin: 'https://example.com',
      page: '2',
      routes: [{ fullPath: '/' }, { fullPath: '/about' }, { fullPath: '/pricing' }],
    });
    expect(locsFromXml(await pageRes.text())).toEqual(['/pricing']);

    const invalidRes = await response({
      maxPerPage: 2,
      origin: 'https://example.com',
      page: 'invalid',
      routes: [{ fullPath: '/' }],
    });
    expect(invalidRes.status).toBe(400);
    expect(await invalidRes.text()).toBe('Invalid page param');

    const notFoundRes = await response({
      maxPerPage: 2,
      origin: 'https://example.com',
      page: '99',
      routes: [{ fullPath: '/' }],
    });
    expect(notFoundRes.status).toBe(404);
    expect(await notFoundRes.text()).toBe('Page does not exist');
  });

  it('supports explicit optional and required locale route mappings', async () => {
    const optionalLocaleRes = await response({
      lang: { alternates: ['de'], default: 'en' },
      locale: { mode: 'optional', paramName: 'locale' },
      origin: 'https://example.com',
      routes: [{ fullPath: '/{-$locale}/about' }],
    });
    const requiredLocaleRes = await response({
      lang: { alternates: ['de'], default: 'en' },
      locale: { mode: 'required', paramName: 'locale' },
      origin: 'https://example.com',
      routes: [{ fullPath: '/$locale/docs' }],
    });

    expect(locsFromXml(await optionalLocaleRes.text())).toEqual(['/about', '/de/about']);
    expect(locsFromXml(await requiredLocaleRes.text())).toEqual(['/en/docs', '/de/docs']);
  });

  it('builds static XML strings for prerender-style usage', () => {
    expect(
      buildTanStackStartSitemap({
        origin: 'https://example.com',
        routes: [{ fullPath: '/about' }],
      })
    ).toContain('<loc>https://example.com/about</loc>');
  });
});
