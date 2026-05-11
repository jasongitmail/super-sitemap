import { describe, expect, it } from 'vitest';

import type { CreateSvelteKitRouteTemplatesOptions } from '../adapters/sveltekit/index.js';
import type {
  TanStackStartRouter,
  TanStackStartSitemapConfig,
} from '../adapters/tanstack-start/index.js';
import type {
  Alternate,
  Changefreq,
  LangConfig,
  ParamValue,
  ParamValues,
  PathObj,
  Priority,
  SitemapConfig,
} from './index.js';

import packageJson from '../../package.json';
import {
  createSvelteKitRouteTemplates,
  filterSvelteKitRoutes,
  parseSvelteKitRouteTemplate,
} from '../adapters/sveltekit/index.js';
import {
  getBody as getTanStackStartBody,
  getHeaders as getTanStackStartHeaders,
  response as tanStackStartResponse,
} from '../adapters/tanstack-start/index.js';
import { response, sampledPaths, sampledUrls } from './index.js';

describe('public package root API', () => {
  it('should root-export response and sampled utilities', () => {
    expect(response).toBeTypeOf('function');
    expect(sampledPaths).toBeTypeOf('function');
    expect(sampledUrls).toBeTypeOf('function');
  });

  it('should typecheck documented root types without import path changes', () => {
    const paramValue: ParamValue = {
      changefreq: 'daily',
      lastmod: '2025-01-01T00:00:00Z',
      priority: 0.7,
      values: ['usa', 'new-york'],
    };
    const paramValues: ParamValues = {
      '/[[lang]]/blog/[slug]': ['hello-world'],
      '/[[lang]]/campsites/[country]/[state]': [['usa', 'new-york']],
      '/[[lang]]/rankings/[country]/[state]': [paramValue],
    };
    const alternate: Alternate = { lang: 'en', path: '/about' };
    const pathObj: PathObj = {
      alternates: [alternate],
      changefreq: 'weekly',
      path: '/about',
      priority: 0.5,
    };
    const lang: LangConfig = { alternates: ['zh'], default: 'en' };
    const changefreq: Changefreq = 'monthly';
    const priority: Priority = 0.6;
    const config: SitemapConfig = {
      defaultChangefreq: changefreq,
      defaultPriority: priority,
      lang,
      origin: 'https://example.com',
      paramValues,
      processPaths: (paths: PathObj[]) => [...paths, pathObj],
    };

    expect(config.paramValues).toBe(paramValues);
    expect(config.processPaths?.([])).toEqual([pathObj]);
  });
});

describe('SvelteKit package API', () => {
  it('declares only the public SvelteKit package export path', () => {
    expect(packageJson.exports).not.toHaveProperty('./adapters/sveltekit');
    expect(packageJson.exports['./sveltekit']).toEqual({
      default: './adapters/sveltekit/index.js',
      types: './adapters/sveltekit/index.d.ts',
    });
  });

  it('exports SvelteKit adapter APIs and types for consumer-style usage', () => {
    expect(createSvelteKitRouteTemplates).toBeTypeOf('function');
    expect(filterSvelteKitRoutes).toBeTypeOf('function');
    expect(parseSvelteKitRouteTemplate).toBeTypeOf('function');

    const options: CreateSvelteKitRouteTemplatesOptions = {
      routeFiles: ['/src/routes/blog/[slug]/+page.svelte'],
    };
    const templates = createSvelteKitRouteTemplates(options);

    expect(templates[0]?.source.compatibilityKey).toBe('/blog/[slug]');
    expect(filterSvelteKitRoutes(['/src/routes/(public)/about/+page.svelte'], [])).toEqual([
      '/about',
    ]);
    expect(parseSvelteKitRouteTemplate({ route: '/blog/[slug]' }).params).toEqual([
      { matcher: undefined, name: 'slug', rest: false, segmentIndex: 1 },
    ]);
  });
});

describe('TanStack Start package API', () => {
  it('declares only the public TanStack Start package export path', () => {
    expect(packageJson.exports).not.toHaveProperty('./adapters/tanstack-start');
    expect(packageJson.exports['./tanstack-start']).toEqual({
      default: './adapters/tanstack-start/index.js',
      types: './adapters/tanstack-start/index.d.ts',
    });
  });

  it('exports TanStack Start adapter APIs and types for consumer-style usage', async () => {
    expect(tanStackStartResponse).toBeTypeOf('function');
    expect(getTanStackStartBody).toBeTypeOf('function');
    expect(getTanStackStartHeaders).toBeTypeOf('function');

    const router: TanStackStartRouter = {
      routesByPath: {
        '/blog/$slug': { fullPath: '/blog/$slug' },
      },
    };
    const config: TanStackStartSitemapConfig = {
      origin: 'https://example.com',
      paramValues: { '/blog/$slug': ['hello-world'] },
      router,
    };
    const res = await tanStackStartResponse(config);

    expect(getTanStackStartBody(config)).toContain(
      '<loc>https://example.com/blog/hello-world</loc>'
    );
    expect(
      getTanStackStartHeaders({
        customHeaders: { 'cache-control': 'max-age=0, s-maxage=86400' },
      })
    ).toEqual({
      'cache-control': 'max-age=0, s-maxage=86400',
      'content-type': 'application/xml',
    });
    expect(await res.text()).toContain('<loc>https://example.com/blog/hello-world</loc>');
  });

  it('accepts generated TanStack router shapes without a routesByPath index signature', () => {
    interface GeneratedRoutesByPath {
      readonly '/blog/$slug': {
        readonly fullPath: '/blog/$slug';
        readonly id: '/blog/$slug';
        readonly internalRouteMetadata: {
          readonly parsed: true;
        };
      };
    }

    interface GeneratedTanStackRouter {
      readonly routesById: unknown;
      readonly routesByPath: GeneratedRoutesByPath;
    }

    const router: GeneratedTanStackRouter = {
      routesById: {},
      routesByPath: {
        '/blog/$slug': {
          fullPath: '/blog/$slug',
          id: '/blog/$slug',
          internalRouteMetadata: { parsed: true },
        },
      },
    };
    const routesByPathRouter: TanStackStartRouter<GeneratedTanStackRouter> = router;
    const config: TanStackStartSitemapConfig<GeneratedTanStackRouter> = {
      origin: 'https://example.com',
      paramValues: { '/blog/$slug': ['hello-world'] },
      router: routesByPathRouter,
    };

    expect(getTanStackStartBody(config)).toContain(
      '<loc>https://example.com/blog/hello-world</loc>'
    );
  });
});
