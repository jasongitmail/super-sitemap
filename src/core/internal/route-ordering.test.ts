import { describe, expect, it } from 'vitest';

import { orderNormalizedRoutes } from './route-ordering.js';
import type { NormalizedRoute } from './types.js';

describe('route-ordering.ts', () => {
  describe('orderNormalizedRoutes()', () => {
    it('orders static routes first and dynamic routes by paramValues key order', () => {
      const normalizedRoutes: NormalizedRoute[] = [
        {
          id: '/blog/[slug]',
          params: [{ name: 'slug', segmentIndex: 1 }],
          segments: [
            { kind: 'static', value: 'blog' },
            { kind: 'param', name: 'slug' },
          ],
          source: {
            adapter: 'test',
            compatibilityKey: '/blog/[slug]',
          },
        },
        {
          id: '/about',
          segments: [{ kind: 'static', value: 'about' }],
          source: {
            adapter: 'test',
            compatibilityKey: '/about',
          },
        },
        {
          id: '/tag/[tag]',
          params: [{ name: 'tag', segmentIndex: 1 }],
          segments: [
            { kind: 'static', value: 'tag' },
            { kind: 'param', name: 'tag' },
          ],
          source: {
            adapter: 'test',
            compatibilityKey: '/tag/[tag]',
          },
        },
        {
          id: '/[[locale]]/about',
          locale: { mode: 'optional', paramName: 'locale', segmentIndex: 0 },
          segments: [
            { kind: 'locale', name: 'locale' },
            { kind: 'static', value: 'about' },
          ],
          source: {
            adapter: 'test',
            compatibilityKey: '/[[locale]]/about',
          },
        },
        {
          id: '/[[locale]]/news/[slug]',
          locale: { mode: 'optional', paramName: 'locale', segmentIndex: 0 },
          params: [{ name: 'slug', segmentIndex: 2 }],
          segments: [
            { kind: 'locale', name: 'locale' },
            { kind: 'static', value: 'news' },
            { kind: 'param', name: 'slug' },
          ],
          source: {
            adapter: 'test',
            compatibilityKey: '/[[locale]]/news/[slug]',
          },
        },
      ];

      const orderedRoutes = orderNormalizedRoutes({
        normalizedRoutes,
        paramValues: {
          '/[[locale]]/news/[slug]': ['release'],
          '/tag/[tag]': ['red'],
          '/blog/[slug]': ['hello-world'],
        },
      });

      expect(
        orderedRoutes.map((normalizedRoute) => normalizedRoute.source.compatibilityKey)
      ).toEqual([
        '/about',
        '/tag/[tag]',
        '/blog/[slug]',
        '/[[locale]]/about',
        '/[[locale]]/news/[slug]',
      ]);
    });

    it('preserves adapter discovery order for remaining dynamic routes', () => {
      const normalizedRoutes: NormalizedRoute[] = [
        {
          id: '/z/[id]',
          params: [{ name: 'id', segmentIndex: 1 }],
          segments: [
            { kind: 'static', value: 'z' },
            { kind: 'param', name: 'id' },
          ],
          source: {
            adapter: 'test',
            compatibilityKey: '/z/[id]',
          },
        },
        {
          id: '/a/[id]',
          params: [{ name: 'id', segmentIndex: 1 }],
          segments: [
            { kind: 'static', value: 'a' },
            { kind: 'param', name: 'id' },
          ],
          source: {
            adapter: 'test',
            compatibilityKey: '/a/[id]',
          },
        },
        {
          id: '/static',
          segments: [{ kind: 'static', value: 'static' }],
          source: {
            adapter: 'test',
            compatibilityKey: '/static',
          },
        },
      ];

      const orderedRoutes = orderNormalizedRoutes({ normalizedRoutes });

      expect(
        orderedRoutes.map((normalizedRoute) => normalizedRoute.source.compatibilityKey)
      ).toEqual(['/static', '/z/[id]', '/a/[id]']);
    });
  });
});
