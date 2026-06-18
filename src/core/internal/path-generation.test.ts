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
        locales: { alternates: ['de', 'fr'], default: 'en' },
        normalizedRoutes,
      })
    ).toEqual([
      {
        alternates: [
          { hreflang: 'en', path: '/about' },
          { hreflang: 'de', path: '/de/about' },
          { hreflang: 'fr', path: '/fr/about' },
        ],
        changefreq: undefined,
        lastmod: undefined,
        path: '/about',
        priority: undefined,
      },
      {
        alternates: [
          { hreflang: 'en', path: '/about' },
          { hreflang: 'de', path: '/de/about' },
          { hreflang: 'fr', path: '/fr/about' },
        ],
        changefreq: undefined,
        lastmod: undefined,
        path: '/de/about',
        priority: undefined,
      },
      {
        alternates: [
          { hreflang: 'en', path: '/about' },
          { hreflang: 'de', path: '/de/about' },
          { hreflang: 'fr', path: '/fr/about' },
        ],
        changefreq: undefined,
        lastmod: undefined,
        path: '/fr/about',
        priority: undefined,
      },
      {
        alternates: [
          { hreflang: 'en', path: '/en' },
          { hreflang: 'de', path: '/de' },
          { hreflang: 'fr', path: '/fr' },
        ],
        changefreq: undefined,
        lastmod: undefined,
        path: '/en',
        priority: undefined,
      },
      {
        alternates: [
          { hreflang: 'en', path: '/en' },
          { hreflang: 'de', path: '/de' },
          { hreflang: 'fr', path: '/fr' },
        ],
        changefreq: undefined,
        lastmod: undefined,
        path: '/de',
        priority: undefined,
      },
      {
        alternates: [
          { hreflang: 'en', path: '/en' },
          { hreflang: 'de', path: '/de' },
          { hreflang: 'fr', path: '/fr' },
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

  it('rejects paramValues for routes with no params', () => {
    const error = captureError(() =>
      generatePathsFromNormalizedRoutes({
        normalizedRoutes: [
          {
            id: 'about',
            segments: [{ kind: 'static', value: 'about' }],
            source: source('/about'),
          },
        ],
        paramValues: { '/about': ['unused'] },
      })
    );

    expect(error).toBeInstanceOf(SitemapRouteParamError);
    expect(error).toMatchObject({
      code: 'param-value-count-mismatch',
      expectedValueCount: 0,
      message: "Route key '/about' expects no params. Remove this key from paramValues.",
      receivedValueCount: 1,
      route: '/about',
    });
  });

  it('rejects unsupported runtime paramValues shapes', () => {
    const normalizedRoutes: NormalizedRoute[] = [
      {
        id: 'blog',
        params: [{ name: 'slug', segmentIndex: 1 }],
        segments: [
          { kind: 'static', value: 'blog' },
          { kind: 'param', name: 'slug' },
        ],
        source: source('/blog/$slug'),
      },
    ];
    const invalidParamValues = [
      { name: 'object instead of array', value: { values: ['hello-world'] } },
      { name: 'empty array', value: [] },
      { name: 'wrong primitive', value: [123] },
      { name: 'ParamValue missing values', value: [{ lastmod: '2026-01-01' }] },
      { name: 'ParamValue values not an array', value: [{ values: 'hello-world' }] },
      { name: 'ParamValue values contain non-string', value: [{ values: [123] }] },
      { name: 'tuple contains non-string', value: [['hello-world', 123]] },
      { name: 'mixed array shapes', value: ['hello-world', { values: ['another-post'] }] },
    ];

    for (const { value } of invalidParamValues) {
      const error = captureError(() =>
        generatePathsFromNormalizedRoutes({
          normalizedRoutes,
          paramValues: { '/blog/$slug': value } as unknown as ParamValues,
        })
      );

      expect(error).toBeInstanceOf(SitemapRouteParamError);
      expect(error).toMatchObject({
        code: 'invalid-param-values-shape',
        message:
          "paramValues for route '/blog/$slug' must be string[], string[][], or ParamValue[].",
        route: '/blog/$slug',
      });
    }
  });

  it('rejects paramValues entries with too few or too many values per path', () => {
    const normalizedRoutes: NormalizedRoute[] = [
      {
        id: 'campsites',
        params: [
          { name: 'country', segmentIndex: 1 },
          { name: 'state', segmentIndex: 2 },
        ],
        segments: [
          { kind: 'static', value: 'campsites' },
          { kind: 'param', name: 'country' },
          { kind: 'param', name: 'state' },
        ],
        source: source('/campsites/$country/$state'),
      },
    ];

    const tooFew = captureError(() =>
      generatePathsFromNormalizedRoutes({
        normalizedRoutes,
        paramValues: { '/campsites/$country/$state': [['usa']] },
      })
    );
    expect(tooFew).toBeInstanceOf(SitemapRouteParamError);
    expect(tooFew).toMatchObject({
      code: 'param-value-count-mismatch',
      expectedValueCount: 2,
      message:
        "paramValues for route '/campsites/$country/$state' must provide 2 values per path: country, state. Received 1 value.",
      paramNames: ['country', 'state'],
      receivedValueCount: 1,
      route: '/campsites/$country/$state',
    });

    const tooMany = captureError(() =>
      generatePathsFromNormalizedRoutes({
        normalizedRoutes,
        paramValues: { '/campsites/$country/$state': [['usa', 'new-york', 'albany']] },
      })
    );
    expect(tooMany).toBeInstanceOf(SitemapRouteParamError);
    expect(tooMany).toMatchObject({
      code: 'param-value-count-mismatch',
      expectedValueCount: 2,
      message:
        "paramValues for route '/campsites/$country/$state' must provide 2 values per path: country, state. Received 3 values.",
      paramNames: ['country', 'state'],
      receivedValueCount: 3,
      route: '/campsites/$country/$state',
    });
  });

  it('rejects shorthand string arrays for routes with multiple params', () => {
    const error = captureError(() =>
      generatePathsFromNormalizedRoutes({
        normalizedRoutes: [
          {
            id: 'campsites',
            params: [
              { name: 'country', segmentIndex: 1 },
              { name: 'state', segmentIndex: 2 },
            ],
            segments: [
              { kind: 'static', value: 'campsites' },
              { kind: 'param', name: 'country' },
              { kind: 'param', name: 'state' },
            ],
            source: source('/campsites/$country/$state'),
          },
        ],
        paramValues: { '/campsites/$country/$state': ['usa'] },
      })
    );

    expect(error).toBeInstanceOf(SitemapRouteParamError);
    expect(error).toMatchObject({
      code: 'param-value-count-mismatch',
      message:
        "paramValues for route '/campsites/$country/$state' must provide 2 values per path: country, state. Received 1 value.",
    });
  });

  it('rejects ParamValue objects with the wrong value count', () => {
    const error = captureError(() =>
      generatePathsFromNormalizedRoutes({
        normalizedRoutes: [
          {
            id: 'blog',
            params: [{ name: 'slug', segmentIndex: 1 }],
            segments: [
              { kind: 'static', value: 'blog' },
              { kind: 'param', name: 'slug' },
            ],
            source: source('/blog/$slug'),
          },
        ],
        paramValues: { '/blog/$slug': [{ values: ['hello-world', 'extra'] }] },
      })
    );

    expect(error).toBeInstanceOf(SitemapRouteParamError);
    expect(error).toMatchObject({
      code: 'param-value-count-mismatch',
      expectedValueCount: 1,
      message:
        "paramValues for route '/blog/$slug' must provide 1 value per path: slug. Received 2 values.",
      paramNames: ['slug'],
      receivedValueCount: 2,
      route: '/blog/$slug',
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
