import { describe, expect, it } from 'vitest';

import { getBody, getHeaders, prepareSitemapPaths, response } from './sitemap.js';

describe('SvelteKit adapter sitemap paths', () => {
  it('preserves deterministic default ordering without alpha sorting', () => {
    const paths = prepareSitemapPaths({
      paramValues: {
        '/blog/[slug]': ['hello-world', 'another-post'],
      },
      routeFiles: [
        '/src/routes/blog/[slug]/+page.svelte',
        '/src/routes/about/+page.svelte',
        '/src/routes/+page.svelte',
      ],
    });

    expect(paths.map(({ path }) => path)).toEqual([
      '/',
      '/about',
      '/blog/hello-world',
      '/blog/another-post',
    ]);
  });
});

describe('SvelteKit adapter response wrapper', () => {
  const locsFromXml = (xml: string) =>
    Array.from(xml.matchAll(/<loc>https:\/\/example\.com([^<]+)<\/loc>/g)).map(([, path]) => path);

  it('requires origin and generates XML through the core renderer', async () => {
    await expect(
      response({
        // @ts-expect-error - runtime validation covers JavaScript callers.
        origin: undefined,
      })
    ).rejects.toThrow('super-sitemap: `origin` property is required in sitemap config.');

    const res = await response({
      additionalPaths: ['/', '/about'],
      origin: 'https://example.com',
    });
    const xml = await res.text();

    expect(res.headers.get('content-type')).toBe('application/xml');
    expect(res.headers.get('cache-control')).toBe('max-age=0, s-maxage=3600');
    expect(xml).toContain('<urlset');
    expect(locsFromXml(xml)).toEqual(['/', '/about']);
  });

  it('exports body and header helpers for framework-specific response wrappers', () => {
    const xml = getBody({
      additionalPaths: ['/', '/about'],
      origin: 'https://example.com',
    });
    const headers = getHeaders({
      customHeaders: {
        'cache-control': 'max-age=0, s-maxage=86400',
        'x-custom': 'yes',
      },
    });

    expect(xml).toContain('<urlset');
    expect(xml).toContain('<loc>https://example.com/</loc>');
    expect(xml).toContain('<loc>https://example.com/about</loc>');
    expect(headers).toEqual({
      'cache-control': 'max-age=0, s-maxage=86400',
      'content-type': 'application/xml',
      'x-custom': 'yes',
    });
  });

  it('interpolates dynamic, metadata, and defaults without SvelteKit syntax', () => {
    const paths = prepareSitemapPaths({
      defaultChangefreq: 'daily',
      defaultPriority: 0.7,
      paramValues: {
        '/blog/[slug]': ['hello-world', 'another-post'],
        '/rankings/[country]/[state]': [
          {
            changefreq: 'weekly',
            lastmod: '2026-01-01',
            priority: 0.8,
            values: ['usa', 'new-york'],
          },
          {
            values: ['canada', 'ontario'],
          },
        ],
      },
      routeFiles: [
        '/src/routes/about/+page.svelte',
        '/src/routes/blog/+page.svelte',
        '/src/routes/blog/[slug]/+page.svelte',
        '/src/routes/rankings/[country]/[state]/+page.svelte',
      ],
      sort: 'alpha',
    });

    expect(paths.map(({ path }) => path)).toEqual([
      '/about',
      '/blog',
      '/blog/another-post',
      '/blog/hello-world',
      '/rankings/canada/ontario',
      '/rankings/usa/new-york',
    ]);
    expect(paths).toContainEqual({
      changefreq: 'weekly',
      lastmod: '2026-01-01',
      path: '/rankings/usa/new-york',
      priority: 0.8,
    });
    expect(paths).toContainEqual({
      changefreq: 'daily',
      path: '/rankings/canada/ontario',
      priority: 0.7,
    });
    for (const { path } of paths) {
      expect(path).not.toMatch(/\[|\]/);
    }
  });

  it('requires paramValues for parameterized routes and reports SvelteKit-specific unknown keys', () => {
    expect(() =>
      prepareSitemapPaths({
        routeFiles: ['/src/routes/blog/[slug]/+page.svelte'],
      })
    ).toThrow("super-sitemap: paramValues not provided for route: '/blog/[slug]'.");
    expect(() =>
      prepareSitemapPaths({
        paramValues: { '/missing/[slug]': ['hello-world'] },
        routeFiles: ['/src/routes/blog/[slug]/+page.svelte'],
      })
    ).toThrow(
      "super-sitemap: paramValues were provided for a route that does not exist: '/missing/[slug]'."
    );
  });

  it('includes additional paths, processPaths, pagination statuses, and locale routes', async () => {
    const res = await response({
      additionalPaths: ['manual.pdf', '/about'],
      headers: {
        'Cache-Control': 'max-age=0, s-maxage=60',
        'Content-Type': 'text/custom+xml',
      },
      origin: 'https://example.com',
      processPaths: (paths) => [
        ...paths,
        { changefreq: 'weekly', path: '/about' },
        { path: '/zzzz-process-paths-sort-marker' },
      ],
      sort: 'alpha',
    });
    const xml = await res.text();

    expect(res.headers.get('cache-control')).toBe('max-age=0, s-maxage=60');
    expect(res.headers.get('content-type')).toBe('text/custom+xml');
    expect(locsFromXml(xml)).toEqual(['/about', '/manual.pdf', '/zzzz-process-paths-sort-marker']);
    expect(xml).toContain(
      '<loc>https://example.com/about</loc>\n    <changefreq>weekly</changefreq>'
    );

    const invalidRes = await response({
      maxPerPage: 2,
      origin: 'https://example.com',
      page: 'invalid',
    });
    expect(invalidRes.status).toBe(400);
    expect(await invalidRes.text()).toBe('Invalid page param');

    const localePaths = prepareSitemapPaths({
      locales: { alternates: ['de'], default: 'en' },
      routeFiles: ['/src/routes/[[locale]]/about/+page.svelte'],
    });
    expect(localePaths.map(({ path }) => path)).toEqual(['/about', '/de/about']);
  });
});
