import { describe, expect, it } from 'vitest';

import type {
  TanStackStartRouteRecord,
  TanStackStartRouteTemplate,
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
  buildTanStackStartSitemap,
  createTanStackStartRouteTemplates,
  generateTanStackStartPaths,
  parseTanStackStartRouteTemplates,
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

describe('TanStack Start package API', () => {
  it('declares a runtime and type package export for the TanStack Start adapter', () => {
    expect(packageJson.exports['./adapters/tanstack-start']).toEqual({
      default: './adapters/tanstack-start/index.js',
      types: './adapters/tanstack-start/index.d.ts',
    });
  });

  it('exports TanStack Start adapter APIs and types for consumer-style usage', async () => {
    expect(tanStackStartResponse).toBeTypeOf('function');
    expect(buildTanStackStartSitemap).toBeTypeOf('function');
    expect(createTanStackStartRouteTemplates).toBeTypeOf('function');
    expect(generateTanStackStartPaths).toBeTypeOf('function');
    expect(parseTanStackStartRouteTemplates).toBeTypeOf('function');

    const routes: TanStackStartRouteRecord[] = [{ fullPath: '/blog/$slug' }];
    const templates: TanStackStartRouteTemplate[] = createTanStackStartRouteTemplates({ routes });
    const config: TanStackStartSitemapConfig = {
      origin: 'https://example.com',
      paramValues: { '/blog/$slug': ['hello-world'] },
      routes,
    };
    const res = await tanStackStartResponse(config);

    expect(templates[0]?.source.compatibilityKey).toBe('/blog/$slug');
    expect(await res.text()).toContain('<loc>https://example.com/blog/hello-world</loc>');
  });
});
