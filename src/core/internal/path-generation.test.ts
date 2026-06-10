import { describe, expect, it } from 'vitest';

import { SitemapRouteParamError, generatePathsFromNormalizedRoutes } from './path-generation.js';
import type { NormalizedRoute, ParamValues } from './types.js';

const source = (compatibilityKey: string) => ({
  adapter: 'unit',
  compatibilityKey,
});

function captureError(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('Expected function to throw.');
}

describe('core normalized routes', () => {
  it('generates static entries from normalized segment IR', () => {
    const normalizedRoutes: NormalizedRoute[] = [
      { id: 'home', segments: [], source: source('home') },
      {
        id: 'about',
        segments: [{ kind: 'static', value: 'about' }],
        source: source('about'),
      },
      {
        id: 'blog',
        segments: [{ kind: 'static', value: 'blog' }],
        source: source('blog'),
      },
    ];

    expect(generatePathsFromNormalizedRoutes({ normalizedRoutes }).map(({ path }) => path)).toEqual(
      ['/', '/about', '/blog']
    );
  });

  it('interpolates single param normalizedRoutes from normalized params', () => {
    const normalizedRoutes: NormalizedRoute[] = [
      {
        id: 'blog-entry',
        params: [{ name: 'slug', segmentIndex: 1 }],
        segments: [
          { kind: 'static', value: 'blog' },
          { kind: 'param', name: 'slug' },
        ],
        source: source('blog-entry'),
      },
    ];

    expect(
      generatePathsFromNormalizedRoutes({
        normalizedRoutes,
        paramValues: {
          'blog-entry': ['hello-world', 'another-post'],
        },
      }).map(({ path }) => path)
    ).toEqual(['/blog/hello-world', '/blog/another-post']);
  });

  it('interpolates multi param normalizedRoutes in positional order', () => {
    const normalizedRoutes: NormalizedRoute[] = [
      {
        id: 'campsite-state',
        params: [
          { name: 'country', segmentIndex: 1 },
          { name: 'state', segmentIndex: 2 },
        ],
        segments: [
          { kind: 'static', value: 'campsites' },
          { kind: 'param', name: 'country' },
          { kind: 'param', name: 'state' },
        ],
        source: source('campsite-state'),
      },
    ];

    expect(
      generatePathsFromNormalizedRoutes({
        normalizedRoutes,
        paramValues: {
          'campsite-state': [
            ['usa', 'new-york'],
            ['usa', 'california'],
            ['canada', 'ontario'],
          ],
        },
      }).map(({ path }) => path)
    ).toEqual([
      '/campsites/usa/new-york',
      '/campsites/usa/california',
      '/campsites/canada/ontario',
    ]);
  });

  it('preserves ParamValue metadata and fills supported defaults', () => {
    const normalizedRoutes: NormalizedRoute[] = [
      {
        id: 'rankings',
        params: [
          { name: 'country', segmentIndex: 1 },
          { name: 'state', segmentIndex: 2 },
        ],
        segments: [
          { kind: 'static', value: 'rankings' },
          { kind: 'param', name: 'country' },
          { kind: 'param', name: 'state' },
        ],
        source: source('rankings'),
      },
    ];

    expect(
      generatePathsFromNormalizedRoutes({
        defaultChangefreq: 'weekly',
        defaultPriority: 0.7,
        normalizedRoutes,
        paramValues: {
          rankings: [
            {
              changefreq: 'daily',
              lastmod: '2026-01-01',
              priority: 0.5,
              values: ['usa', 'new-york'],
            },
            {
              values: ['canada', 'ontario'],
            },
          ],
        },
      })
    ).toEqual([
      {
        changefreq: 'daily',
        lastmod: '2026-01-01',
        path: '/rankings/usa/new-york',
        priority: 0.5,
      },
      {
        changefreq: 'weekly',
        lastmod: undefined,
        path: '/rankings/canada/ontario',
        priority: 0.7,
      },
    ]);
  });

  it('expands optional and required locale slots from explicit metadata', () => {
    const normalizedRoutes: NormalizedRoute[] = [
      {
        id: 'optional-locale-about',
        locale: { mode: 'optional', paramName: 'locale', segmentIndex: 0 },
        segments: [
          { kind: 'locale', name: 'locale' },
          { kind: 'static', value: 'about' },
        ],
        source: source('optional-locale-about'),
      },
      {
        id: 'required-locale-home',
        locale: { mode: 'required', paramName: 'locale', segmentIndex: 0 },
        segments: [{ kind: 'locale', name: 'locale' }],
        source: source('required-locale-home'),
      },
    ];

    expect(
      generatePathsFromNormalizedRoutes({
        lang: { alternates: ['de', 'fr'], default: 'en' },
        normalizedRoutes,
      })
    ).toEqual([
      {
        alternates: [
          { lang: 'en', path: '/about' },
          { lang: 'de', path: '/de/about' },
          { lang: 'fr', path: '/fr/about' },
        ],
        changefreq: undefined,
        lastmod: undefined,
        path: '/about',
        priority: undefined,
      },
      {
        alternates: [
          { lang: 'en', path: '/about' },
          { lang: 'de', path: '/de/about' },
          { lang: 'fr', path: '/fr/about' },
        ],
        changefreq: undefined,
        lastmod: undefined,
        path: '/de/about',
        priority: undefined,
      },
      {
        alternates: [
          { lang: 'en', path: '/about' },
          { lang: 'de', path: '/de/about' },
          { lang: 'fr', path: '/fr/about' },
        ],
        changefreq: undefined,
        lastmod: undefined,
        path: '/fr/about',
        priority: undefined,
      },
      {
        alternates: [
          { lang: 'en', path: '/en' },
          { lang: 'de', path: '/de' },
          { lang: 'fr', path: '/fr' },
        ],
        changefreq: undefined,
        lastmod: undefined,
        path: '/en',
        priority: undefined,
      },
      {
        alternates: [
          { lang: 'en', path: '/en' },
          { lang: 'de', path: '/de' },
          { lang: 'fr', path: '/fr' },
        ],
        changefreq: undefined,
        lastmod: undefined,
        path: '/de',
        priority: undefined,
      },
      {
        alternates: [
          { lang: 'en', path: '/en' },
          { lang: 'de', path: '/de' },
          { lang: 'fr', path: '/fr' },
        ],
        changefreq: undefined,
        lastmod: undefined,
        path: '/fr',
        priority: undefined,
      },
    ]);
  });

  it('uses source metadata for core validation errors', () => {
    const normalizedRoutes: NormalizedRoute[] = [
      {
        id: 'missing-data',
        params: [{ name: 'slug', segmentIndex: 0 }],
        segments: [{ kind: 'param', name: 'slug' }],
        source: source('friendly route key'),
      },
    ];

    const missingError = captureError(() =>
      generatePathsFromNormalizedRoutes({ normalizedRoutes })
    );
    expect(missingError).toBeInstanceOf(SitemapRouteParamError);
    expect(missingError).toMatchObject({
      code: 'missing-param-values',
      message: "paramValues not provided for route: 'friendly route key'.",
      route: 'friendly route key',
    });

    const unknownError = captureError(() =>
      generatePathsFromNormalizedRoutes({
        normalizedRoutes,
        paramValues: { unknown: ['value'] },
      })
    );
    expect(unknownError).toBeInstanceOf(SitemapRouteParamError);
    expect(unknownError).toMatchObject({
      code: 'unknown-param-values-route',
      message: "paramValues were provided for a route that does not exist: 'unknown'.",
      route: 'unknown',
    });
  });

  it('handles large string arrays and ParamValue arrays without stack overflow', () => {
    const normalizedRoutes: NormalizedRoute[] = [
      {
        id: 'large-slugs',
        params: [{ name: 'slug', segmentIndex: 1 }],
        segments: [
          { kind: 'static', value: 'large' },
          { kind: 'param', name: 'slug' },
        ],
        source: source('large-slugs'),
      },
      {
        id: 'large-objects',
        params: [{ name: 'slug', segmentIndex: 1 }],
        segments: [
          { kind: 'static', value: 'objects' },
          { kind: 'param', name: 'slug' },
        ],
        source: source('large-objects'),
      },
    ];
    const size = 20_000;
    const paramValues: ParamValues = {
      'large-objects': Array.from({ length: size }, (_, index) => ({
        values: [`item-${index}`],
      })),
      'large-slugs': Array.from({ length: size }, (_, index) => `item-${index}`),
    };

    const paths = generatePathsFromNormalizedRoutes({ normalizedRoutes, paramValues });

    expect(paths).toHaveLength(size * 2);
    expect(paths[0]?.path).toBe('/large/item-0');
    expect(paths[size - 1]?.path).toBe(`/large/item-${size - 1}`);
    expect(paths[size]?.path).toBe('/objects/item-0');
    expect(paths.at(-1)?.path).toBe(`/objects/item-${size - 1}`);
  });
});
