import { describe, expect, it } from 'vitest';

import type { PathObj } from './types.js';

import { deduplicatePaths, generateAdditionalPaths, sortPaths } from './paths.js';

describe('core path helpers', () => {
  it('normalizes additional paths with defaults without locale expansion', () => {
    expect(
      generateAdditionalPaths({
        additionalPaths: ['manual.pdf', '/already-normalized'],
        defaultChangefreq: 'weekly',
        defaultPriority: 0.4,
      })
    ).toEqual([
      {
        changefreq: 'weekly',
        lastmod: undefined,
        path: '/manual.pdf',
        priority: 0.4,
      },
      {
        changefreq: 'weekly',
        lastmod: undefined,
        path: '/already-normalized',
        priority: 0.4,
      },
    ]);
  });

  it('deduplicates paths by keeping first position and last object metadata', () => {
    const paths: PathObj[] = [
      { path: '/first' },
      { changefreq: 'daily', path: '/duplicate', priority: 0.3 },
      { path: '/middle' },
      { changefreq: 'monthly', path: '/duplicate', priority: 0.9 },
    ];

    expect(deduplicatePaths(paths)).toEqual([
      { path: '/first' },
      { changefreq: 'monthly', path: '/duplicate', priority: 0.9 },
      { path: '/middle' },
    ]);
  });

  it('sorts paths alphabetically only when requested', () => {
    const paths = [{ path: '/z' }, { path: '/a' }, { path: '/m' }];

    expect(sortPaths(paths, false).map(({ path }) => path)).toEqual(['/z', '/a', '/m']);
    expect(sortPaths(paths, 'alpha').map(({ path }) => path)).toEqual(['/a', '/m', '/z']);
  });
});
