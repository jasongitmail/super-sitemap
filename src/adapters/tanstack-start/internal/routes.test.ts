import { describe, expect, it } from 'vitest';

import { generatePathsFromNormalizedRoutes } from '../../../core/internal/path-generation.js';
import { createTanStackStartNormalizedRoutes } from './routes.js';

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

describe('TanStack Start adapter route parser', () => {
  it('normalizes static, root, and index routes into syntax-free normalizedRoutes', () => {
    const normalizedRoutes = createTanStackStartNormalizedRoutes({
      router: routerFromRoutes([{ fullPath: '/' }, { fullPath: '' }, { fullPath: '/about/team' }]),
    });

    expect(normalizedRoutes).toHaveLength(2);
    expect(normalizedRoutes.map((normalizedRoute) => normalizedRoute.segments)).toEqual([
      [],
      [
        { kind: 'static', value: 'about' },
        { kind: 'static', value: 'team' },
      ],
    ]);
    expect(
      normalizedRoutes.map((normalizedRoute) => normalizedRoute.source.compatibilityKey)
    ).toEqual(['/', '/about/team']);
  });

  it('normalizes dynamic params, preserves multi-param order, and handles splat rest params', () => {
    const [blog] = createTanStackStartNormalizedRoutes({
      router: routerFromRoutes([{ fullPath: '/blog/$slug' }]),
    });
    const [campsite] = createTanStackStartNormalizedRoutes({
      router: routerFromRoutes([{ fullPath: '/campsites/$country/$state' }]),
    });
    const [docs] = createTanStackStartNormalizedRoutes({
      router: routerFromRoutes([{ fullPath: '/docs/$' }]),
    });

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
      generatePathsFromNormalizedRoutes({
        normalizedRoutes: campsite ? [campsite] : [],
        paramValues: {
          '/campsites/$country/$state': [
            ['usa', 'new-york'],
            ['canada', 'ontario'],
          ],
        },
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
    const normalizedRoutes = createTanStackStartNormalizedRoutes({
      router: routerFromRoutes([{ fullPath: '/blog/{-$category}' }]),
    });
    const languageNormalizedRoutes = createTanStackStartNormalizedRoutes({
      router: routerFromRoutes([{ fullPath: '/{-$language}/about' }]),
    });

    expect(normalizedRoutes).toMatchObject([
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
    expect(languageNormalizedRoutes[0]?.locale).toBeUndefined();
    expect(languageNormalizedRoutes[1]?.locale).toBeUndefined();
    expect(
      languageNormalizedRoutes.find((normalizedRoute) =>
        normalizedRoute.source.compatibilityKey.includes('$')
      )?.params
    ).toEqual([{ name: 'language', rest: false, segmentIndex: 0 }]);
  });

  it('expands consecutive optional params with TanStack prefix-only semantics', () => {
    const normalizedRoutes = createTanStackStartNormalizedRoutes({
      router: routerFromRoutes([{ fullPath: '/something/{-$paramA}/{-$paramB}' }]),
    });

    expect(
      normalizedRoutes.map((normalizedRoute) => normalizedRoute.source.compatibilityKey)
    ).toEqual(['/something', '/something/{-$paramA}', '/something/{-$paramA}/{-$paramB}']);
    expect(normalizedRoutes.map((normalizedRoute) => normalizedRoute.params)).toEqual([
      [],
      [{ name: 'paramA', rest: false, segmentIndex: 1 }],
      [
        { name: 'paramA', rest: false, segmentIndex: 1 },
        { name: 'paramB', rest: false, segmentIndex: 2 },
      ],
    ]);
    expect(
      generatePathsFromNormalizedRoutes({
        normalizedRoutes,
        paramValues: {
          '/something/{-$paramA}': ['a'],
          '/something/{-$paramA}/{-$paramB}': [['a', 'b']],
        },
      }).map(({ path }) => path)
    ).toEqual(['/something', '/something/a', '/something/a/b']);
  });

  it('omits pathless and group-like segments and respects canonical fullPath over path', () => {
    const [normalizedRoute] = createTanStackStartNormalizedRoutes({
      router: routerFromRoutes([
        {
          fullPath: '/app/$postId',
          id: '/_layout/(marketing)/app/$postId',
          path: '/_layout/(marketing)/wrong/$ignored',
        },
      ]),
    });
    const [pathlessNormalizedRoute] = createTanStackStartNormalizedRoutes({
      router: routerFromRoutes([{ fullPath: '/_layout/(marketing)/pricing' }]),
    });

    expect(normalizedRoute).toMatchObject({
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
    expect(pathlessNormalizedRoute?.segments).toEqual([{ kind: 'static', value: 'pricing' }]);
  });

  it('retains source metadata and collapses duplicate canonical records deterministically', () => {
    const normalizedRoutes = createTanStackStartNormalizedRoutes({
      router: () => ({
        routesByPath: {
          '/about': { filePath: '/src/routes/about.tsx', fullPath: '/about' },
          '/duplicate-a': { filePath: '/src/routes/duplicate-a.tsx', fullPath: '/duplicate' },
          '/duplicate-b': { filePath: '/src/routes/duplicate-b.tsx', fullPath: '/duplicate' },
        },
      }),
    });

    expect(normalizedRoutes).toHaveLength(2);
    expect(normalizedRoutes.map((normalizedRoute) => normalizedRoute.source)).toEqual([
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
    const normalizedRoutes = createTanStackStartNormalizedRoutes({
      router: routerFromRoutes([{ fullPath: '/blog/$slug' }]),
    });

    expect(() => generatePathsFromNormalizedRoutes({ normalizedRoutes })).toThrow(
      "paramValues not provided for route: '/blog/$slug'."
    );
    expect(() =>
      generatePathsFromNormalizedRoutes({
        normalizedRoutes,
        paramValues: { '/blog/$missing': ['hello-world'] },
      })
    ).toThrow("paramValues were provided for a route that does not exist: '/blog/$missing'.");
  });

  it('excludes server-only routes such as the sitemap endpoint itself', () => {
    const component = () => null;
    const normalizedRoutes = createTanStackStartNormalizedRoutes({
      router: () => ({
        routesByPath: {
          '/about': { fullPath: '/about', options: { component } },
          '/api/health': { fullPath: '/api/health', options: { server: { handlers: {} } } },
          '/lazy-page': { fullPath: '/lazy-page', options: {} },
          '/page-with-server': {
            fullPath: '/page-with-server',
            options: { component, server: { handlers: {} } },
          },
          '/sitemap{-$page}.xml': {
            fullPath: '/sitemap{-$page}.xml',
            options: { server: { handlers: {} } },
          },
        },
      }),
    });

    expect(
      normalizedRoutes.map((normalizedRoute) => normalizedRoute.source.compatibilityKey)
    ).toEqual(['/about', '/lazy-page', '/page-with-server']);
  });

  it('allows optional route variants to be excluded explicitly', () => {
    const normalizedRoutes = createTanStackStartNormalizedRoutes({
      excludeRoutePatterns: [/\/blog\/\{-\$category\}/],
      router: routerFromRoutes([{ fullPath: '/blog/{-$category}' }]),
    });

    expect(
      normalizedRoutes.map((normalizedRoute) => normalizedRoute.source.compatibilityKey)
    ).toEqual(['/blog']);
    expect(generatePathsFromNormalizedRoutes({ normalizedRoutes }).map(({ path }) => path)).toEqual(
      ['/blog']
    );
  });

  it('infers locale mapping from TanStack route syntax without leaking syntax into normalized IR', () => {
    const [optionalLocale] = createTanStackStartNormalizedRoutes({
      router: routerFromRoutes([{ fullPath: '/{-$locale}/about' }]),
    });
    const [requiredLocale] = createTanStackStartNormalizedRoutes({
      router: routerFromRoutes([{ fullPath: '/$locale/docs/$slug' }]),
    });

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

    for (const normalizedRoute of [optionalLocale, requiredLocale]) {
      expect(normalizedRoute?.segments).not.toContainEqual(
        expect.objectContaining({ value: expect.stringMatching(/\$|\{|\}|\(|\)|^_/) })
      );
      expect(normalizedRoute?.segments).not.toContainEqual(
        expect.objectContaining({ name: expect.stringMatching(/\$|\{|\}/) })
      );
    }
  });
});

describe('TanStack Start adapter route sources', () => {
  const router = () => ({
    routesById: {
      '/_app': { fullPath: '/_app', id: '/_app' },
      '/_app/dashboard': { fullPath: '/dashboard', id: '/_app/dashboard' },
      '/_pathlessLayout': { fullPath: '/_pathlessLayout', id: '/_pathlessLayout' },
    },
    routesByPath: {
      '/about': { fullPath: '/about', id: '/about' },
      '/about/company': { fullPath: '/about/company', id: '/about/company' },
      '/about/team': { fullPath: '/about/team', id: '/about/team' },
      '/blog': { fullPath: '/blog', id: '/blog' },
      '/blog/$slug': { fullPath: '/blog/$slug', id: '/blog/$slug' },
      '/dashboard': { fullPath: '/dashboard', id: '/_app/dashboard' },
    },
  });

  it('discovers resolved public routes from router.routesByPath', () => {
    const normalizedRoutes = createTanStackStartNormalizedRoutes({ router });

    expect(
      normalizedRoutes.map((normalizedRoute) => normalizedRoute.source.compatibilityKey)
    ).toEqual(['/about', '/about/company', '/about/team', '/blog', '/blog/$slug', '/dashboard']);
  });

  it('uses route map keys as normalized routes when router records only have ids', () => {
    const [normalizedRoute] = createTanStackStartNormalizedRoutes({
      router: () => ({
        routesByPath: {
          '/blog/$slug': { id: '/_layout/blog/$slug' },
        },
      }),
    });

    expect(normalizedRoute?.source.compatibilityKey).toBe('/blog/$slug');
    expect(
      generatePathsFromNormalizedRoutes({
        normalizedRoutes: normalizedRoute ? [normalizedRoute] : [],
        paramValues: {
          '/blog/$slug': ['hello-world'],
        },
      }).map(({ path }) => path)
    ).toEqual(['/blog/hello-world']);
  });

  it('does not use routesById or emit noisy pathless route ids', () => {
    const normalizedRoutes = createTanStackStartNormalizedRoutes({
      router,
    });

    expect(
      normalizedRoutes.map((normalizedRoute) => normalizedRoute.source.compatibilityKey)
    ).not.toContain('/_app');
    expect(
      normalizedRoutes.map((normalizedRoute) => normalizedRoute.source.compatibilityKey)
    ).not.toContain('/_pathlessLayout');
    expect(
      normalizedRoutes.map((normalizedRoute) => normalizedRoute.source.compatibilityKey)
    ).toContain('/dashboard');
  });

  it('supports minimum route record source fields and preserves route map order', () => {
    const normalizedRoutes = createTanStackStartNormalizedRoutes({
      router: routerFromRoutes([
        { id: '/id-only' },
        { path: '/path-only' },
        { to: '/to-only/$id' },
        { fullPath: '/full-path' },
      ]),
    });

    expect(
      normalizedRoutes.map((normalizedRoute) => normalizedRoute.source.compatibilityKey)
    ).toEqual(['/id-only', '/path-only', '/to-only/$id', '/full-path']);
  });

  it('collapses duplicate route records deterministically', () => {
    const normalizedRoutes = createTanStackStartNormalizedRoutes({
      router: () => ({
        routesByPath: {
          '/alpha': { fullPath: '/alpha' },
          '/duplicate-a': { filePath: 'a.tsx', fullPath: '/duplicate' },
          '/duplicate-b': { filePath: 'b.tsx', fullPath: '/duplicate' },
        },
      }),
    });

    expect(normalizedRoutes.map((normalizedRoute) => normalizedRoute.source)).toEqual([
      { adapter: 'tanstack-start', compatibilityKey: '/alpha', fullPath: '/alpha' },
      {
        adapter: 'tanstack-start',
        compatibilityKey: '/duplicate',
        filePath: 'a.tsx',
        fullPath: '/duplicate',
      },
    ]);
  });

  it('applies exclusions before emitting normalizedRoutes and before requiring param values', () => {
    const normalizedRoutes = createTanStackStartNormalizedRoutes({
      excludeRoutePatterns: [/\/blog\/\$slug/],
      router,
    });

    expect(
      normalizedRoutes.map((normalizedRoute) => normalizedRoute.source.compatibilityKey)
    ).toEqual(['/about', '/about/company', '/about/team', '/blog', '/dashboard']);
    expect(generatePathsFromNormalizedRoutes({ normalizedRoutes }).map(({ path }) => path)).toEqual(
      ['/about', '/about/company', '/about/team', '/blog', '/dashboard']
    );
  });

  it('throws a helpful error when route exclusions use strings', () => {
    expect(() =>
      createTanStackStartNormalizedRoutes({
        excludeRoutePatterns: ['/dashboard'] as unknown as RegExp[],
        router,
      })
    ).toThrow(
      'super-sitemap: `excludeRoutePatterns[0]` must be a RegExp, not a string. Use a regex literal like /dashboard/ instead of "/dashboard".'
    );
  });
});
