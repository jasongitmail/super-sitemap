import { describe, expect, it } from 'vitest';

import type { PathObj } from '../../../core/internal/types.js';
import { getSamplePaths } from './sample-paths.js';

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

describe('TanStack Start adapter sample paths', () => {
  const router = () => ({
    routesByPath: {
      '/': { fullPath: '/', id: '/' },
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

  it('returns one sample path per sitemap-published route shape', () => {
    const paths = getSamplePaths({
      sitemapConfig: {
        additionalPaths: ['/manual.pdf'],
        origin: 'https://example.com',
        paramValues: {
          '/blog/$slug': ['hello-world', 'another-post'],
          '/docs/$': ['intro/getting-started'],
          '/rankings/$country/$state': [
            ['usa', 'new-york'],
            ['canada', 'ontario'],
          ],
        },
        router,
      },
    });

    expect(paths).toEqual([
      '/',
      '/about',
      '/blog',
      '/blog/hello-world',
      '/docs/intro/getting-started',
      '/rankings/usa/new-york',
    ]);
  });

  it('ignores routes and additional paths that are not present in the final sitemap paths', () => {
    const paths = getSamplePaths({
      sitemapConfig: {
        additionalPaths: ['/manual.pdf'],
        excludeRoutePatterns: ['^/dashboard$'],
        origin: 'https://example.com',
        router: routerFromRoutes([{ fullPath: '/about' }, { fullPath: '/dashboard' }]),
      },
    });

    expect(paths).toEqual(['/about']);
  });

  it('samples after processPaths and preserves the prepared sitemap order', () => {
    const sitemapConfig = {
      origin: 'https://example.com',
      processPaths: (paths: PathObj[]) => [...paths].reverse(),
      router: routerFromRoutes([{ fullPath: '/zeta' }, { fullPath: '/alpha' }]),
    };

    expect(getSamplePaths({ sitemapConfig })).toEqual(['/zeta', '/alpha']);
    expect(getSamplePaths({ sitemapConfig: { ...sitemapConfig, sort: 'alpha' } })).toEqual([
      '/alpha',
      '/zeta',
    ]);
  });

  it('canonicalizes paths before deduping and sampling localized variants', () => {
    const stripLocalePrefix = (path: string) => path.replace(/^\/(?:de|es)(?=\/|$)/, '') || '/';

    const paths = getSamplePaths({
      getCanonicalPath: stripLocalePrefix,
      sitemapConfig: {
        origin: 'https://example.com',
        processPaths: (paths) =>
          paths.flatMap(({ path, ...metadata }) =>
            path === '/contact'
              ? [
                  { ...metadata, path: '/es/contact' },
                  { ...metadata, path: '/de/contact' },
                  { ...metadata, path: '/contact' },
                ]
              : [{ ...metadata, path }]
          ),
        router: routerFromRoutes([{ fullPath: '/contact' }]),
      },
    });

    expect(paths).toEqual(['/contact']);
  });

  it('matches static routes before dynamic sibling routes', () => {
    const paths = getSamplePaths({
      sitemapConfig: {
        origin: 'https://example.com',
        paramValues: {
          '/$slug': ['contact'],
        },
        router: routerFromRoutes([{ fullPath: '/about' }, { fullPath: '/$slug' }]),
        sort: 'alpha',
      },
    });

    expect(paths).toEqual(['/about', '/contact']);
  });

  it('supports optional param route variants', () => {
    const paths = getSamplePaths({
      sitemapConfig: {
        origin: 'https://example.com',
        paramValues: {
          '/blog/{-$category}': ['tech'],
        },
        router: routerFromRoutes([{ fullPath: '/blog/{-$category}' }]),
      },
    });

    expect(paths).toEqual(['/blog', '/blog/tech']);
  });

  it('supports explicit locale route mappings while sampling once per route', () => {
    const optionalLocalePaths = getSamplePaths({
      sitemapConfig: {
        lang: { alternates: ['de'], default: 'en' },
        langParam: { mode: 'optional', paramName: 'locale' },
        origin: 'https://example.com',
        router: routerFromRoutes([{ fullPath: '/{-$locale}/about' }]),
      },
    });
    const requiredLocalePaths = getSamplePaths({
      getCanonicalPath: (path) => path.replace(/^\/(?:de|en)(?=\/|$)/, '') || '/',
      sitemapConfig: {
        lang: { alternates: ['de'], default: 'en' },
        langParam: { mode: 'required', paramName: 'locale' },
        origin: 'https://example.com',
        router: routerFromRoutes([{ fullPath: '/$locale/docs' }]),
      },
    });

    expect(optionalLocalePaths).toEqual(['/about']);
    expect(requiredLocalePaths).toEqual(['/docs']);
  });
});
