import { describe, expect, it } from 'vitest';

import type { PathObj } from '../../../core/internal/types.js';

import { getSamplePaths } from './sample-paths.js';

describe('SvelteKit adapter sample paths', () => {
  const routeFiles = [
    '/src/routes/+page.svelte',
    '/src/routes/about/+page.svelte',
    '/src/routes/blog/+page.svelte',
    '/src/routes/blog/[slug]/+page.svelte',
    '/src/routes/docs/[...rest]/+page.svelte',
    '/src/routes/rankings/[country]/[state]/+page.svelte',
  ];

  it('returns one sample path per sitemap-published route shape', () => {
    const paths = getSamplePaths({
      sitemapConfig: {
        additionalPaths: ['/manual.pdf'],
        origin: 'https://example.com',
        paramValues: {
          '/blog/[slug]': ['hello-world', 'another-post'],
          '/docs/[...rest]': ['intro/getting-started'],
          '/rankings/[country]/[state]': [
            ['usa', 'new-york'],
            ['canada', 'ontario'],
          ],
        },
        routeFiles,
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
        routeFiles: ['/src/routes/about/+page.svelte', '/src/routes/dashboard/+page.svelte'],
      },
    });

    expect(paths).toEqual(['/about']);
  });

  it('samples after processPaths and preserves the prepared sitemap order', () => {
    const sitemapConfig = {
      origin: 'https://example.com',
      processPaths: (paths: PathObj[]) => [...paths].reverse(),
      routeFiles: ['/src/routes/zeta/+page.svelte', '/src/routes/alpha/+page.svelte'],
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
        routeFiles: ['/src/routes/contact/+page.svelte'],
      },
    });

    expect(paths).toEqual(['/contact']);
  });

  it('matches static routes before dynamic sibling routes', () => {
    const paths = getSamplePaths({
      sitemapConfig: {
        origin: 'https://example.com',
        paramValues: {
          '/[slug]': ['contact'],
        },
        routeFiles: ['/src/routes/about/+page.svelte', '/src/routes/[slug]/+page.svelte'],
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
          '/blog/[[category]]': ['tech'],
        },
        routeFiles: ['/src/routes/blog/[[category]]/+page.svelte'],
      },
    });

    expect(paths).toEqual(['/blog', '/blog/tech']);
  });

  it('supports optional and required locale route mappings while sampling once per route', () => {
    const optionalLocalePaths = getSamplePaths({
      sitemapConfig: {
        lang: { alternates: ['de'], default: 'en' },
        origin: 'https://example.com',
        routeFiles: ['/src/routes/[[lang]]/about/+page.svelte'],
      },
    });
    const requiredLocalePaths = getSamplePaths({
      getCanonicalPath: (path) => path.replace(/^\/(?:de|en)(?=\/|$)/, '') || '/',
      sitemapConfig: {
        lang: { alternates: ['de'], default: 'en' },
        origin: 'https://example.com',
        routeFiles: ['/src/routes/[lang]/docs/+page.svelte'],
      },
    });

    expect(optionalLocalePaths).toEqual(['/about']);
    expect(requiredLocalePaths).toEqual(['/docs']);
  });
});
