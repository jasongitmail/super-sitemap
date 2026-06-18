import { describe, expect, it } from 'vitest';

import { deduplicateNormalizedRoutesByCompatibilityKey } from './normalized-routes.js';
import type { NormalizedRoute } from './types.js';

describe('normalized route dedupe', () => {
  it('keeps the first framework route that resolves to a compatibility key', () => {
    const firstRoute: NormalizedRoute = {
      id: '/duplicate',
      segments: [{ kind: 'static', value: 'duplicate' }],
      source: {
        adapter: 'test',
        compatibilityKey: '/duplicate',
        filePath: 'first.tsx',
      },
    };
    const secondRoute: NormalizedRoute = {
      id: '/duplicate',
      segments: [{ kind: 'static', value: 'duplicate' }],
      source: {
        adapter: 'test',
        compatibilityKey: '/duplicate',
        filePath: 'second.tsx',
      },
    };

    expect(deduplicateNormalizedRoutesByCompatibilityKey([firstRoute, secondRoute])).toEqual([
      firstRoute,
    ]);
  });
});
