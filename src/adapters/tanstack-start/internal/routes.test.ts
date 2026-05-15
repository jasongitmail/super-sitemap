import { describe, expect, it } from 'vitest';

import { generatePathsFromRouteTemplates } from '../../../core/internal/route-templates.js';
import { createTanStackStartRouteTemplates } from './routes.js';

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
  it('normalizes static, root, and index routes into syntax-free templates', () => {
    const templates = createTanStackStartRouteTemplates({
      router: routerFromRoutes([{ fullPath: '/' }, { fullPath: '' }, { fullPath: '/about/team' }]),
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
    const [blog] = createTanStackStartRouteTemplates({
      router: routerFromRoutes([{ fullPath: '/blog/$slug' }]),
    });
    const [campsite] = createTanStackStartRouteTemplates({
      router: routerFromRoutes([{ fullPath: '/campsites/$country/$state' }]),
    });
    const [docs] = createTanStackStartRouteTemplates({
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
    const templates = createTanStackStartRouteTemplates({
      router: routerFromRoutes([{ fullPath: '/blog/{-$category}' }]),
    });
    const langTemplates = createTanStackStartRouteTemplates({
      router: routerFromRoutes([{ fullPath: '/{-$lang}/about' }]),
    });

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
    expect(
      langTemplates.find((template) => template.source.compatibilityKey.includes('$'))?.params
    ).toEqual([{ name: 'lang', rest: false, segmentIndex: 0 }]);
  });

  it('omits pathless and group-like segments and respects canonical fullPath over path', () => {
    const [template] = createTanStackStartRouteTemplates({
      router: routerFromRoutes([
        {
          fullPath: '/app/$postId',
          id: '/_layout/(marketing)/app/$postId',
          path: '/_layout/(marketing)/wrong/$ignored',
        },
      ]),
    });
    const [pathlessTemplate] = createTanStackStartRouteTemplates({
      router: routerFromRoutes([{ fullPath: '/_layout/(marketing)/pricing' }]),
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
      router: () => ({
        routesByPath: {
          '/about': { filePath: '/src/routes/about.tsx', fullPath: '/about' },
          '/duplicate-a': { filePath: '/src/routes/duplicate-a.tsx', fullPath: '/duplicate' },
          '/duplicate-b': { filePath: '/src/routes/duplicate-b.tsx', fullPath: '/duplicate' },
        },
      }),
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
      router: routerFromRoutes([{ fullPath: '/blog/$slug' }]),
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
      router: routerFromRoutes([{ fullPath: '/blog/{-$category}' }]),
    });

    expect(templates.map((template) => template.source.compatibilityKey)).toEqual(['/blog']);
    expect(generatePathsFromRouteTemplates({ templates }).map(({ path }) => path)).toEqual([
      '/blog',
    ]);
  });

  it('supports explicit locale mapping without leaking TanStack syntax into normalized IR', () => {
    const [optionalLocale] = createTanStackStartRouteTemplates({
      locale: { mode: 'optional', paramName: 'locale' },
      router: routerFromRoutes([{ fullPath: '/{-$locale}/about' }]),
    });
    const [requiredLocale] = createTanStackStartRouteTemplates({
      locale: { mode: 'required', paramName: 'locale' },
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
    const templates = createTanStackStartRouteTemplates({ router });

    expect(templates.map((template) => template.source.compatibilityKey)).toEqual([
      '/about',
      '/about/company',
      '/about/team',
      '/blog',
      '/blog/$slug',
      '/dashboard',
    ]);
  });

  it('uses route map keys as route templates when router records only have ids', () => {
    const [template] = createTanStackStartRouteTemplates({
      router: () => ({
        routesByPath: {
          '/blog/$slug': { id: '/_layout/blog/$slug' },
        },
      }),
    });

    expect(template?.source.compatibilityKey).toBe('/blog/$slug');
    expect(
      generatePathsFromRouteTemplates({
        paramValues: {
          '/blog/$slug': ['hello-world'],
        },
        templates: template ? [template] : [],
      }).map(({ path }) => path)
    ).toEqual(['/blog/hello-world']);
  });

  it('does not use routesById or emit noisy pathless route ids', () => {
    const templates = createTanStackStartRouteTemplates({
      router,
    });

    expect(templates.map((template) => template.source.compatibilityKey)).not.toContain('/_app');
    expect(templates.map((template) => template.source.compatibilityKey)).not.toContain(
      '/_pathlessLayout'
    );
    expect(templates.map((template) => template.source.compatibilityKey)).toContain('/dashboard');
  });

  it('supports minimum route record source fields and returns deterministic order', () => {
    const templates = createTanStackStartRouteTemplates({
      router: routerFromRoutes([
        { id: '/id-only' },
        { path: '/path-only' },
        { to: '/to-only/$id' },
        { fullPath: '/full-path' },
      ]),
    });

    expect(templates.map((template) => template.source.compatibilityKey)).toEqual([
      '/full-path',
      '/id-only',
      '/path-only',
      '/to-only/$id',
    ]);
  });

  it('collapses duplicate route records deterministically', () => {
    const templates = createTanStackStartRouteTemplates({
      router: () => ({
        routesByPath: {
          '/alpha': { fullPath: '/alpha' },
          '/duplicate-a': { filePath: 'a.tsx', fullPath: '/duplicate' },
          '/duplicate-b': { filePath: 'b.tsx', fullPath: '/duplicate' },
        },
      }),
    });

    expect(templates.map((template) => template.source)).toEqual([
      { adapter: 'tanstack-start', compatibilityKey: '/alpha', fullPath: '/alpha' },
      {
        adapter: 'tanstack-start',
        compatibilityKey: '/duplicate',
        filePath: 'a.tsx',
        fullPath: '/duplicate',
      },
    ]);
  });

  it('applies exclusions before emitting templates and before requiring param values', () => {
    const templates = createTanStackStartRouteTemplates({
      excludeRoutePatterns: ['/blog/\\$slug'],
      router,
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
});
