import { describe, expect, it } from 'vitest';

import { selectSamplePaths } from './sample-paths.js';
import type { NormalizedRoute } from './types.js';

const source = (compatibilityKey: string) => ({
  adapter: 'unit',
  compatibilityKey,
});

const normalizedRoutes: NormalizedRoute[] = [
  { id: '/', segments: [], source: source('/') },
  {
    id: '/about',
    segments: [{ kind: 'static', value: 'about' }],
    source: source('/about'),
  },
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
    id: '/docs/[...rest]',
    params: [{ name: 'rest', rest: true, segmentIndex: 1 }],
    segments: [
      { kind: 'static', value: 'docs' },
      { kind: 'param', name: 'rest', rest: true },
    ],
    source: source('/docs/[...rest]'),
  },
];

describe('core selectSamplePaths', () => {
  it('selects one sample per route shape and ignores unmatched paths', () => {
    const samples = selectSamplePaths({
      normalizedRoutes,
      paths: [
        { path: '/' },
        { path: '/about' },
        { path: '/blog/hello-world' },
        { path: '/blog/another-post' },
        { path: '/docs/intro/getting-started' },
        { path: '/manual.pdf' },
      ],
    });

    expect(samples).toEqual(['/', '/about', '/blog/hello-world', '/docs/intro/getting-started']);
  });

  it('prefers specific static routes over dynamic siblings matching the same path', () => {
    const samples = selectSamplePaths({
      normalizedRoutes: [
        ...normalizedRoutes,
        {
          id: '/blog/featured',
          segments: [
            { kind: 'static', value: 'blog' },
            { kind: 'static', value: 'featured' },
          ],
          source: source('/blog/featured'),
        },
      ],
      paths: [{ path: '/blog/featured' }],
    });

    expect(samples).toEqual(['/blog/featured']);
  });

  it('canonicalizes paths before dedupe so localized variants collapse into one sample', () => {
    const samples = selectSamplePaths({
      getCanonicalPath: (path) => path.replace(/^\/(?:de|en)(?=\/|$)/, '') || '/',
      normalizedRoutes,
      paths: [{ path: '/de/about' }, { path: '/about' }, { path: '/en/about/' }],
    });

    expect(samples).toEqual(['/about']);
  });
});
