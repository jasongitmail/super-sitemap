import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import type { RouteTemplate } from '../../../core/internal/types.js';

import {
  createSvelteKitRouteTemplates,
  discoverSvelteKitPageRouteFiles,
  discoverSvelteKitPageRouteFilesFromDirectory,
  expandSvelteKitOptionalRoute,
  expandSvelteKitOptionalRoutes,
  filterSvelteKitRoutes,
  findSvelteKitLangToken,
  listFilePathsRecursively,
  normalizeSvelteKitRouteFile,
  orderSvelteKitTemplatesForCompatibility,
  parseSvelteKitRouteTemplate,
  removeSvelteKitRouteGroups,
  sortSvelteKitRoutes,
} from './routes.js';

const source = (compatibilityKey: string) => ({
  adapter: 'sveltekit',
  compatibilityKey,
});

describe('SvelteKit routes', () => {
  it('discovers page routes and excludes endpoint-only files', () => {
    const routes = discoverSvelteKitPageRouteFiles();

    expect(routes).toContain('/src/routes/(public)/[[lang]]/about/+page.svelte');
    expect(routes).toContain('/src/routes/(public)/markdown-md/+page.md');
    expect(routes).toContain('/src/routes/(public)/markdown-svx/+page.svx');
    expect(routes).not.toContain('/src/routes/(public)/[[lang]]/sitemap[[page]].xml/+server.ts');
    expect(routes.some((route) => route.includes('+server.'))).toBe(false);
  });

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

  it('removes route groups after filtering', () => {
    expect(removeSvelteKitRouteGroups('/(public)/(nested-group)/visible')).toBe('/visible');
    expect(removeSvelteKitRouteGroups('/(public)')).toBe('/');
  });

  it('sorts routes alphabetically', () => {
    expect(sortSvelteKitRoutes(['/z', '/', '/a'])).toEqual(['/', '/a', '/z']);
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

  it('expands optional params while preserving matcher syntax for route keys', () => {
    expect(
      expandSvelteKitOptionalRoutes([
        '/[[lang]]/blog/[page=integer]',
        '/[[lang]]/optionals/[[optional]]',
      ])
    ).toEqual([
      '/[[lang]]/blog/[page=integer]',
      '/[[lang]]/optionals',
      '/[[lang]]/optionals/[[optional]]',
    ]);
  });

  it('expands a single optional route and preserves optional locale position', () => {
    expect(expandSvelteKitOptionalRoute('/[[lang]]/docs/[[section]]/[[slug]]')).toEqual([
      '/[[lang]]/docs',
      '/[[lang]]/docs/[[section]]',
      '/[[lang]]/docs/[[section]]/[[slug]]',
    ]);
  });

  it('matches optional and required SvelteKit locale route tokens', () => {
    const regex = findSvelteKitLangToken();

    expect(regex.test('/[[lang]]/about')).toBe(true);
    expect(findSvelteKitLangToken().test('/[lang=lang]/about')).toBe(true);
    expect(findSvelteKitLangToken().test('/blog/[slug]')).toBe(false);
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

  it('orders dynamic templates by paramValues while keeping static templates first', () => {
    const paramValues = Object.fromEntries([
      ['/tag/[tag]', ['red']],
      ['/blog/[slug]', ['hello-world']],
    ]);
    const templates: RouteTemplate[] = [
      {
        id: '/blog/[slug]',
        params: [{ name: 'slug', segmentIndex: 1 }],
        segments: [
          { kind: 'static', value: 'blog' },
          { kind: 'param', name: 'slug' },
        ],
        source: source('/blog/[slug]'),
      },
      {
        id: '/about',
        segments: [{ kind: 'static', value: 'about' }],
        source: source('/about'),
      },
      {
        id: '/tag/[tag]',
        params: [{ name: 'tag', segmentIndex: 1 }],
        segments: [
          { kind: 'static', value: 'tag' },
          { kind: 'param', name: 'tag' },
        ],
        source: source('/tag/[tag]'),
      },
    ];

    expect(
      orderSvelteKitTemplatesForCompatibility({
        paramValues,
        templates,
      }).map((template) => template.source.compatibilityKey)
    ).toEqual(['/about', '/tag/[tag]', '/blog/[slug]']);
  });
});
