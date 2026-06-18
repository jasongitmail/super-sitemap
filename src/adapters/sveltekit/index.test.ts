import { describe, expect, it } from 'vitest';

import packageJson from '../../../package.json';
import type {
  ParamValue as SvelteKitParamValue,
  PathObj as SvelteKitPathObj,
  SitemapConfig as SvelteKitSitemapConfig,
} from './index.js';
import * as sveltekit from './index.js';

describe('SvelteKit package API', () => {
  it('declares only the public SvelteKit package export path', () => {
    expect(Object.keys(packageJson.exports)).not.toContain('.');
    expect(packageJson.exports).not.toHaveProperty('./adapters/sveltekit');
    expect(packageJson.exports).not.toHaveProperty('./core');
    expect(packageJson.exports['./sveltekit']).toEqual({
      default: './dist/adapters/sveltekit/index.js',
      types: './dist/adapters/sveltekit/index.d.ts',
    });
  });

  it('exports SvelteKit adapter APIs and types for consumer-style usage', () => {
    expect(sveltekit.response).toBeTypeOf('function');
    expect(sveltekit.getBody).toBeTypeOf('function');
    expect(sveltekit.getHeaders).toBeTypeOf('function');
    expect(sveltekit.getSamplePaths).toBeTypeOf('function');

    const config: SvelteKitSitemapConfig = {
      additionalPaths: ['/blog/hello-world'],
      origin: 'https://example.com',
    };
    const configWithRouteFiles: SvelteKitSitemapConfig = {
      origin: 'https://example.com',
      // @ts-expect-error - route file injection is an internal adapter test hook.
      routeFiles: ['/src/routes/blog/[slug]/+page.svelte'],
    };

    expect(configWithRouteFiles.origin).toBe('https://example.com');
    expect(sveltekit.getBody(config)).toContain('<loc>https://example.com/blog/hello-world</loc>');
    expect(
      sveltekit.getHeaders({
        customHeaders: { 'cache-control': 'max-age=0, s-maxage=86400' },
      })
    ).toEqual({
      'cache-control': 'max-age=0, s-maxage=86400',
      'content-type': 'application/xml',
    });
    expect(sveltekit.getSamplePaths({ sitemapConfig: config })).toEqual([]);
  });

  it('exports SvelteKit config types from the adapter entrypoint', () => {
    const paramValue: SvelteKitParamValue = {
      priority: 0.8,
      values: ['hello-world'],
    };
    const pathObj: SvelteKitPathObj = { path: '/blog/hello-world' };
    const config: SvelteKitSitemapConfig = {
      origin: 'https://example.com',
      paramValues: { '/blog/[slug]': [paramValue] },
      processPaths: (paths: SvelteKitPathObj[]) => [...paths, pathObj],
    };

    expect(config.processPaths?.([])).toEqual([pathObj]);
  });
});
