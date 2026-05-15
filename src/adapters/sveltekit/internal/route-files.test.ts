import { describe, expect, it } from 'vitest';

import {
  normalizeSvelteKitRouteFile,
  removeSvelteKitRouteGroups,
  sortSvelteKitRoutes,
} from './route-files.js';

describe('SvelteKit route file helpers', () => {
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

  it('removes route groups after compatibility filtering', () => {
    expect(removeSvelteKitRouteGroups('/(public)/(nested-group)/visible')).toBe('/visible');
    expect(removeSvelteKitRouteGroups('/(public)')).toBe('/');
  });

  it('sorts routes alphabetically', () => {
    expect(sortSvelteKitRoutes(['/z', '/', '/a'])).toEqual(['/', '/a', '/z']);
  });
});
