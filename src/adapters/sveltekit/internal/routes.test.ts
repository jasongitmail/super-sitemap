import { describe, expect, it } from 'vitest';

import type { RouteTemplate } from '../../../core/internal/types.js';

import {
  createSvelteKitRouteTemplates,
  filterSvelteKitRoutes,
  orderSvelteKitTemplatesForCompatibility,
} from './routes.js';

const source = (compatibilityKey: string) => ({
  adapter: 'sveltekit',
  compatibilityKey,
});

describe('SvelteKit route templates', () => {
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
