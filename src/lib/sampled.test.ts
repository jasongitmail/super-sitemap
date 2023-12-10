import fs from 'fs';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { server } from './fixtures/mocks.js';
import * as sitemap from './sampled.js';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('sample.ts', () => {
  describe('_sampledUrls()', () => {
    const expectedSampledUrls = [
      // static
      'https://example.com/',
      'https://example.com/about',
      'https://example.com/blog',
      'https://example.com/login',
      'https://example.com/pricing',
      'https://example.com/privacy',
      'https://example.com/signup',
      'https://example.com/terms',
      // dynamic
      'https://example.com/blog/another-post',
      'https://example.com/blog/tag/blue',
      'https://example.com/campsites/canada/toronto',
      'https://example.com/foo-path-1',
    ];

    describe('sitemap', () => {
      it('should return expected urls', async () => {
        const xml = await fs.promises.readFile('./src/lib/fixtures/expected-sitemap.xml', 'utf-8');
        const result = await sitemap._sampledUrls(xml);
        expect(result).toEqual(expectedSampledUrls);
      });
    });

    describe('sitemap index', () => {
      it('should return expected urls from subpages', async () => {
        const xml = await fs.promises.readFile(
          './src/lib/fixtures/expected-sitemap-index.xml',
          'utf-8'
        );
        const result = await sitemap._sampledUrls(xml);
        expect(result).toEqual(expectedSampledUrls);
      });
    });
  });

  describe('_sampledPaths()', () => {
    const expectedSampledPaths = [
      '/',
      '/about',
      '/blog',
      '/login',
      '/pricing',
      '/privacy',
      '/signup',
      '/terms',
      '/blog/another-post',
      '/blog/tag/blue',
      '/campsites/canada/toronto',
      '/foo-path-1',
    ];

    describe('sitemap', () => {
      it('should return expected paths', async () => {
        const xml = await fs.promises.readFile('./src/lib/fixtures/expected-sitemap.xml', 'utf-8');
        const result = await sitemap._sampledPaths(xml);
        expect(result).toEqual(expectedSampledPaths);
        expect(result).not.toEqual(['/dashboard', '/dashboard/settings']);
      });
    });

    describe('sitemap index', () => {
      it('should return expected paths', async () => {
        const xml = await fs.promises.readFile(
          './src/lib/fixtures/expected-sitemap-index.xml',
          'utf-8'
        );
        const result = await sitemap._sampledPaths(xml);
        expect(result).toEqual(expectedSampledPaths);
        expect(result).not.toEqual(['/dashboard', '/dashboard/settings']);
      });
    });
  });

  describe('findFirstMatches()', () => {
    it('should a max of one match for each regex', () => {
      const patterns = new Set(['/blog/([^/]+)', '/blog/([^/]+)/([^/]+)']);
      const haystack = [
        // static routes
        'https://example.com/',
        'https://example.com/blog',

        // /blog/[slug]
        'https://example.com/blog/hello-world',
        'https://example.com/blog/another-post',

        // /blog/tag/[tag]
        'https://example.com/blog/tag/red',
        'https://example.com/blog/tag/green',
        'https://example.com/blog/tag/blue',

        // /campsites/[country]/[state]
        'https://example.com/campsites/usa/new-york',
        'https://example.com/campsites/usa/california',
        'https://example.com/campsites/canada/ontario',
      ];
      const result = sitemap.findFirstMatches(patterns, haystack);
      expect(result).toEqual(
        new Set(['https://example.com/blog/hello-world', 'https://example.com/blog/tag/red'])
      );
    });
  });
});
