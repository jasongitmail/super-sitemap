import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  discoverSvelteKitPageRouteFilesFromDirectory,
  listFilePathsRecursively,
} from '../../../test-utils/sveltekit-route-files.js';
import {
  convertToNormalizedRoute,
  createSvelteKitNormalizedRoutes,
  expandOptionalParamRouteVariants,
  findSvelteKitLocaleToken,
  normalizeSvelteKitRouteFile,
  removeSvelteKitRouteGroups,
} from './routes.js';

describe('SvelteKit routes', () => {
  // Real import.meta.glob discovery is integration-tested in examples/sveltekit,
  // which is a live SvelteKit app with routes at /src/routes.
  it('returns the full path of each file in nested directories', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'super-sitemap-'));
    const nestedDir = path.join(tmpDir, 'nested', 'deeper');

    try {
      fs.mkdirSync(nestedDir, { recursive: true });
      const rootFile = path.join(tmpDir, '+page.svelte');
      const nestedFile = path.join(tmpDir, 'nested', '+page@.svelte');
      const deepFile = path.join(nestedDir, '+page.md');

      fs.writeFileSync(rootFile, '');
      fs.writeFileSync(nestedFile, '');
      fs.writeFileSync(deepFile, '');

      expect(listFilePathsRecursively(tmpDir).sort()).toEqual(
        [deepFile, nestedFile, rootFile].sort()
      );
    } finally {
      fs.rmSync(tmpDir, { force: true, recursive: true });
    }
  });

  it('discovers supported page file variants from disk and excludes endpoints', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'super-sitemap-routes-'));

    try {
      const files = [
        '+page.svelte',
        'terms/+page@.svelte',
        'break/+page@foo.svelte',
        'break-dynamic/+page@[id].svelte',
        'break-group/+page@(id).svelte',
        'markdown/+page.md',
        'content/+page.svx',
        'api/+server.ts',
      ];

      for (const file of files) {
        const filePath = path.join(tmpDir, file);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, '');
      }

      expect(discoverSvelteKitPageRouteFilesFromDirectory(tmpDir).sort()).toEqual(
        [
          '/src/routes/+page.svelte',
          '/src/routes/break/+page@foo.svelte',
          '/src/routes/break-dynamic/+page@[id].svelte',
          '/src/routes/break-group/+page@(id).svelte',
          '/src/routes/content/+page.svx',
          '/src/routes/markdown/+page.md',
          '/src/routes/terms/+page@.svelte',
        ].sort()
      );
    } finally {
      fs.rmSync(tmpDir, { force: true, recursive: true });
    }
  });

  it('normalizes SvelteKit page file variants into route keys', () => {
    expect(normalizeSvelteKitRouteFile('/src/routes/(public)/+page.svelte')).toBe('/(public)');
    expect(normalizeSvelteKitRouteFile('/src/routes/(public)/terms/+page@.svelte')).toBe(
      '/(public)/terms'
    );
    expect(normalizeSvelteKitRouteFile('/src/routes/(public)/content/+page.svx')).toBe(
      '/(public)/content'
    );
    expect(normalizeSvelteKitRouteFile('/src/routes/(public)/markdown/+page.md')).toBe(
      '/(public)/markdown'
    );
  });

  it('removes route groups from route keys', () => {
    expect(removeSvelteKitRouteGroups('/(public)/(nested-group)/visible')).toBe('/visible');
    expect(removeSvelteKitRouteGroups('/(public)')).toBe('/');
  });

  // Exclusions match the same normalized route keys as paramValues so all
  // framework adapters share consistent route-key matching and exclusion behavior.
  it('filters after route groups are removed', () => {
    const normalizedRoutes = createSvelteKitNormalizedRoutes({
      excludeRoutePatterns: [/\(secret-group\)/, /^\/hidden$/],
      routeFiles: [
        '/src/routes/(public)/+page.svelte',
        '/src/routes/(public)/terms/+page@.svelte',
        '/src/routes/(public)/break/+page@foo.svelte',
        '/src/routes/(public)/break-dynamic/+page@[id].svelte',
        '/src/routes/(public)/break-group/+page@(id).svelte',
        '/src/routes/(secret-group)/hidden/+page.svelte',
        '/src/routes/(secret-group)/kept/+page.svelte',
        '/src/routes/(public)/(nested-group)/visible/+page.md',
        '/src/routes/(public)/content/+page.svx',
      ],
    });

    expect(
      normalizedRoutes.map((normalizedRoute) => normalizedRoute.source.compatibilityKey)
    ).toEqual([
      '/',
      '/break',
      '/break-dynamic',
      '/break-group',
      '/content',
      '/kept',
      '/terms',
      '/visible',
    ]);
  });

  it('filters optional route variants after expansion', () => {
    const normalizedRoutes = createSvelteKitNormalizedRoutes({
      excludeRoutePatterns: [/^\/blog$/],
      routeFiles: ['/src/routes/blog/[[page=integer]]/+page.svelte'],
    });

    expect(
      normalizedRoutes.map((normalizedRoute) => normalizedRoute.source.compatibilityKey)
    ).toEqual(['/blog/[[page=integer]]']);
  });

  it('throws a helpful error when route exclusions use strings', () => {
    expect(() =>
      createSvelteKitNormalizedRoutes({
        excludeRoutePatterns: ['/dashboard'] as unknown as RegExp[],
        routeFiles: ['/src/routes/dashboard/+page.svelte'],
      })
    ).toThrow('super-sitemap: `excludeRoutePatterns[0]` must be a RegExp, not a string.');
  });

  it('resets global regex state before route exclusion matching', () => {
    const dashboardPattern = /\/dashboard/g;
    const routeFiles = [
      '/src/routes/about/+page.svelte',
      '/src/routes/dashboard/+page.svelte',
      '/src/routes/dashboard/profile/+page.svelte',
    ];

    for (let i = 0; i < 2; i++) {
      expect(
        createSvelteKitNormalizedRoutes({
          excludeRoutePatterns: [dashboardPattern],
          routeFiles,
        }).map((normalizedRoute) => normalizedRoute.source.compatibilityKey)
      ).toEqual(['/about']);
    }
  });

  it('expands optional params while preserving matcher syntax for route keys', () => {
    expect([
      '/[[locale]]/blog/[page=integer]',
      ...expandOptionalParamRouteVariants('/[[locale]]/optionals/[[optional]]'),
    ]).toEqual([
      '/[[locale]]/blog/[page=integer]',
      '/[[locale]]/optionals',
      '/[[locale]]/optionals/[[optional]]',
    ]);
  });

  it('expands a single optional route and preserves optional locale position', () => {
    expect(expandOptionalParamRouteVariants('/[[locale]]/docs/[[section]]/[[slug]]')).toEqual([
      '/[[locale]]/docs',
      '/[[locale]]/docs/[[section]]',
      '/[[locale]]/docs/[[section]]/[[slug]]',
    ]);
  });

  it('expands consecutive optional params before a static suffix with SvelteKit prefix-only semantics', () => {
    expect(
      expandOptionalParamRouteVariants('/[[locale]]/optionals/many/[[paramA]]/[[paramB]]/foo')
    ).toEqual([
      '/[[locale]]/optionals/many/foo',
      '/[[locale]]/optionals/many/[[paramA]]/foo',
      '/[[locale]]/optionals/many/[[paramA]]/[[paramB]]/foo',
    ]);
  });

  it('matches optional and required SvelteKit locale route tokens', () => {
    const regex = findSvelteKitLocaleToken();

    expect(regex.test('/[[locale]]/about')).toBe(true);
    expect(findSvelteKitLocaleToken().test('/[locale=locale]/about')).toBe(true);
    expect(findSvelteKitLocaleToken().test('/blog/[slug]')).toBe(false);
  });

  it('maps locale, matcher, rest, source, and compatibility metadata into normalized normalizedRoutes', () => {
    const optionalLocale = convertToNormalizedRoute({
      filePath: '/src/routes/(public)/[[locale=locale]]/blog/[slug]/+page.svelte',
      route: '/[[locale=locale]]/blog/[slug]',
    });
    const requiredLocale = convertToNormalizedRoute({
      route: '/[locale]/campsites/[country]/[state]',
    });
    const matcherParam = convertToNormalizedRoute({
      route: '/blog/[page=integer]',
    });
    const restParam = convertToNormalizedRoute({
      route: '/docs/[...rest]',
    });

    expect(optionalLocale).toMatchObject({
      locale: { matcher: 'locale', mode: 'optional', paramName: 'locale', segmentIndex: 0 },
      params: [{ name: 'slug', segmentIndex: 2 }],
      segments: [
        { kind: 'locale', matcher: 'locale', name: 'locale' },
        { kind: 'static', value: 'blog' },
        { kind: 'param', name: 'slug' },
      ],
      source: {
        adapter: 'sveltekit',
        compatibilityKey: '/[[locale=locale]]/blog/[slug]',
        filePath: '/src/routes/(public)/[[locale=locale]]/blog/[slug]/+page.svelte',
      },
    });
    expect(requiredLocale.locale).toEqual({
      mode: 'required',
      paramName: 'locale',
      segmentIndex: 0,
    });
    expect(matcherParam.params).toEqual([
      { matcher: 'integer', name: 'page', rest: false, segmentIndex: 1 },
    ]);
    expect(restParam.params).toEqual([{ name: 'rest', rest: true, segmentIndex: 1 }]);

    for (const normalizedRoute of [optionalLocale, requiredLocale, matcherParam, restParam]) {
      expect(normalizedRoute.segments).not.toContainEqual(
        expect.objectContaining({ value: expect.stringMatching(/\+page|\.svelte|\[\[/) })
      );
      expect(normalizedRoute.segments).not.toContainEqual(
        expect.objectContaining({ name: expect.stringMatching(/\[[^\]]+\]/) })
      );
    }
  });

  it('requires locale config when localized SvelteKit routes exist', () => {
    expect(() =>
      createSvelteKitNormalizedRoutes({
        locales: { alternates: [], default: 'en' },
        routeFiles: ['/src/routes/(public)/[[locale]]/about/+page.svelte'],
      })
    ).toThrow(
      'super-sitemap: `locales` property is required in sitemap config because one or more routes contain [[locale]].'
    );
  });

  it('throws a migration error when localized SvelteKit routes use the v1 lang param', () => {
    expect(() =>
      createSvelteKitNormalizedRoutes({
        locales: { alternates: ['de'], default: 'en' },
        routeFiles: ['/src/routes/(public)/[[lang]]/about/+page.svelte'],
      })
    ).toThrow(
      'super-sitemap: v2 recognizes locale routes by a param named `locale`. Rename `[lang]`/`[[lang]]` to `[locale]`/`[[locale]]`.'
    );
  });

  it('returns normalized syntax-free normalizedRoutes from SvelteKit route files', () => {
    const normalizedRoutes = createSvelteKitNormalizedRoutes({
      excludeRoutePatterns: [/^\/dashboard$/],
      locales: { alternates: ['zh'], default: 'en' },
      routeFiles: [
        '/src/routes/(public)/[[locale]]/about/+page.svelte',
        '/src/routes/(authenticated)/dashboard/+page.svelte',
      ],
    });

    expect(normalizedRoutes).toHaveLength(1);
    expect(normalizedRoutes[0]).toMatchObject({
      locale: { mode: 'optional', paramName: 'locale' },
      segments: [
        { kind: 'locale', name: 'locale' },
        { kind: 'static', value: 'about' },
      ],
      source: {
        compatibilityKey: '/[[locale]]/about',
        filePath: '/src/routes/(public)/[[locale]]/about/+page.svelte',
      },
    });
    expect(normalizedRoutes[0]?.segments).not.toContainEqual(
      expect.objectContaining({ value: expect.stringMatching(/\(|\)|\+page|\.svelte|\[/) })
    );
  });
});
