import { describe, expect, it } from 'vitest';

import type {
  ParamValue as TanStackStartParamValue,
  PathObj as TanStackStartPathObj,
  SitemapConfig as TanStackStartSitemapConfig,
} from './index.js';

import packageJson from '../../../package.json';
import * as tanStackStart from './index.js';

describe('TanStack Start package API', () => {
  it('declares only the public TanStack Start package export path', () => {
    expect(Object.keys(packageJson.exports)).not.toContain('.');
    expect(packageJson.exports).not.toHaveProperty('./adapters/tanstack-start');
    expect(packageJson.exports['./tanstack-start']).toEqual({
      default: './dist/adapters/tanstack-start/index.js',
      types: './dist/adapters/tanstack-start/index.d.ts',
    });
  });

  it('exports TanStack Start adapter APIs and types for consumer-style usage', async () => {
    expect(tanStackStart.response).toBeTypeOf('function');
    expect(tanStackStart.getBody).toBeTypeOf('function');
    expect(tanStackStart.getHeaders).toBeTypeOf('function');
    expect(tanStackStart.getSamplePaths).toBeTypeOf('function');

    const router = {
      routesByPath: {
        '/blog/$slug': { fullPath: '/blog/$slug' },
      },
    };
    const getRouter = () => router;
    const config: TanStackStartSitemapConfig = {
      origin: 'https://example.com',
      paramValues: { '/blog/$slug': ['hello-world'] },
      router: getRouter,
    };
    const res = await tanStackStart.response(config);

    expect(tanStackStart.getBody(config)).toContain(
      '<loc>https://example.com/blog/hello-world</loc>'
    );
    expect(
      tanStackStart.getHeaders({
        customHeaders: { 'cache-control': 'max-age=0, s-maxage=86400' },
      })
    ).toEqual({
      'cache-control': 'max-age=0, s-maxage=86400',
      'content-type': 'application/xml',
    });
    expect(await res.text()).toContain('<loc>https://example.com/blog/hello-world</loc>');
    expect(tanStackStart.getSamplePaths({ sitemapConfig: config })).toEqual(['/blog/hello-world']);
  });

  it('exports TanStack Start config types from the adapter entrypoint', () => {
    const paramValue: TanStackStartParamValue = {
      priority: 0.8,
      values: ['hello-world'],
    };
    const pathObj: TanStackStartPathObj = { path: '/blog/hello-world' };
    const router = {
      routesByPath: {
        '/blog/$slug': { fullPath: '/blog/$slug' },
      },
    };
    const config: TanStackStartSitemapConfig = {
      origin: 'https://example.com',
      paramValues: { '/blog/$slug': [paramValue] },
      processPaths: (paths: TanStackStartPathObj[]) => [...paths, pathObj],
      router: () => router,
    };

    expect(config.processPaths?.([])).toEqual([pathObj]);
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
    const getRouter = (): GeneratedTanStackRouter => router;
    const config: TanStackStartSitemapConfig = {
      origin: 'https://example.com',
      paramValues: { '/blog/$slug': ['hello-world'] },
      router: getRouter,
    };

    expect(tanStackStart.getBody(config)).toContain(
      '<loc>https://example.com/blog/hello-world</loc>'
    );
  });
});
