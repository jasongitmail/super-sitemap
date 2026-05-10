import { describe, expect, it } from 'vitest';

import {
  createSvelteKitRouteTemplates,
  discoverSvelteKitPageRouteFiles,
  expandSvelteKitOptionalRoutes,
  filterSvelteKitRoutes,
  parseSvelteKitRouteTemplate,
} from './index.js';

describe('SvelteKit adapter', () => {
  it('discovers page routes and excludes endpoint-only files', () => {
    const routes = discoverSvelteKitPageRouteFiles();

    expect(routes).toContain('/src/routes/(public)/[[lang]]/about/+page.svelte');
    expect(routes).toContain('/src/routes/(public)/markdown-md/+page.md');
    expect(routes).toContain('/src/routes/(public)/markdown-svx/+page.svx');
    expect(routes).not.toContain('/src/routes/(public)/[[lang]]/sitemap[[page]].xml/+server.ts');
    expect(routes.some((route) => route.includes('+server.'))).toBe(false);
  });

  it('filters before removing route groups and normalizes SvelteKit page file variants', () => {
    const routes = [
      '/src/routes/(public)/+page.svelte',
      '/src/routes/(public)/terms/+page@.svelte',
      '/src/routes/(public)/break/+page@foo.svelte',
      '/src/routes/(public)/break-dynamic/+page@[id].svelte',
      '/src/routes/(public)/break-group/+page@(id).svelte',
      '/src/routes/(secret-group)/hidden/+page.svelte',
      '/src/routes/(public)/(nested-group)/visible/+page.md',
      '/src/routes/(public)/content/+page.svx',
      '/src/routes/(public)/blog/[page=integer]/+page.svelte',
    ];

    expect(filterSvelteKitRoutes(routes, ['\\(secret-group\\)', '.*\\[page=integer\\].*'])).toEqual(
      ['/', '/break', '/break-dynamic', '/break-group', '/content', '/terms', '/visible']
    );
  });

  it('expands optional params after filtering and preserves matcher syntax for route keys', () => {
    const routes = filterSvelteKitRoutes(
      [
        '/src/routes/(public)/[[lang]]/blog/[page=integer]/+page.svelte',
        '/src/routes/(public)/[[lang]]/optionals/[[optional]]/+page.svelte',
        '/src/routes/(public)/optionals/to-exclude/[[optional]]/+page.svelte',
      ],
      ['/optionals/to-exclude/\\[\\[optional\\]\\]']
    );

    expect(routes).toEqual(['/[[lang]]/blog/[page=integer]', '/[[lang]]/optionals/[[optional]]']);
    expect(expandSvelteKitOptionalRoutes(routes)).toEqual([
      '/[[lang]]/blog/[page=integer]',
      '/[[lang]]/optionals',
      '/[[lang]]/optionals/[[optional]]',
    ]);
  });

  it('maps locale, matcher, rest, source, and compatibility metadata into normalized templates', () => {
    const optionalLocale = parseSvelteKitRouteTemplate({
      filePath: '/src/routes/(public)/[[lang=lang]]/blog/[slug]/+page.svelte',
      route: '/[[lang=lang]]/blog/[slug]',
    });
    const requiredLocale = parseSvelteKitRouteTemplate({
      route: '/[lang]/campsites/[country]/[state]',
    });
    const matcherParam = parseSvelteKitRouteTemplate({
      route: '/blog/[page=integer]',
    });
    const restParam = parseSvelteKitRouteTemplate({
      route: '/docs/[...rest]',
    });

    expect(optionalLocale).toMatchObject({
      locale: { matcher: 'lang', mode: 'optional', paramName: 'lang', segmentIndex: 0 },
      params: [{ name: 'slug', segmentIndex: 2 }],
      segments: [
        { kind: 'locale', matcher: 'lang', name: 'lang' },
        { kind: 'static', value: 'blog' },
        { kind: 'param', name: 'slug' },
      ],
      source: {
        adapter: 'sveltekit',
        compatibilityKey: '/[[lang=lang]]/blog/[slug]',
        filePath: '/src/routes/(public)/[[lang=lang]]/blog/[slug]/+page.svelte',
      },
    });
    expect(requiredLocale.locale).toEqual({
      mode: 'required',
      paramName: 'lang',
      segmentIndex: 0,
    });
    expect(matcherParam.params).toEqual([
      { matcher: 'integer', name: 'page', rest: false, segmentIndex: 1 },
    ]);
    expect(restParam.params).toEqual([{ name: 'rest', rest: true, segmentIndex: 1 }]);

    for (const template of [optionalLocale, requiredLocale, matcherParam, restParam]) {
      expect(template.segments).not.toContainEqual(
        expect.objectContaining({ value: expect.stringMatching(/\+page|\.svelte|\[\[/) })
      );
      expect(template.segments).not.toContainEqual(
        expect.objectContaining({ name: expect.stringMatching(/\[[^\]]+\]/) })
      );
    }
  });

  it('requires locale config when localized SvelteKit routes exist', () => {
    expect(() =>
      createSvelteKitRouteTemplates({
        lang: { alternates: [], default: 'en' },
        routeFiles: ['/src/routes/(public)/[[lang]]/about/+page.svelte'],
      })
    ).toThrow(
      'Must specify `lang` property within the sitemap config because one or more routes contain [[lang]].'
    );
  });

  it('returns normalized syntax-free templates from SvelteKit route files', () => {
    const templates = createSvelteKitRouteTemplates({
      excludeRoutePatterns: ['\\(authenticated\\)'],
      lang: { alternates: ['zh'], default: 'en' },
      routeFiles: [
        '/src/routes/(public)/[[lang]]/about/+page.svelte',
        '/src/routes/(authenticated)/dashboard/+page.svelte',
      ],
    });

    expect(templates).toHaveLength(1);
    expect(templates[0]).toMatchObject({
      locale: { mode: 'optional', paramName: 'lang' },
      segments: [
        { kind: 'locale', name: 'lang' },
        { kind: 'static', value: 'about' },
      ],
      source: {
        compatibilityKey: '/[[lang]]/about',
        filePath: '/src/routes/(public)/[[lang]]/about/+page.svelte',
      },
    });
    expect(templates[0]?.segments).not.toContainEqual(
      expect.objectContaining({ value: expect.stringMatching(/\(|\)|\+page|\.svelte|\[/) })
    );
  });
});
