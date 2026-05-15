import { describe, expect, it } from 'vitest';

import { expandSvelteKitOptionalRoute, expandSvelteKitOptionalRoutes } from './optional-routes.js';

describe('SvelteKit optional routes', () => {
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
});
