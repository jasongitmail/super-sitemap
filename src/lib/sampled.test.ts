import { describe, expect, it } from 'vitest';
import fs from 'fs';

import * as sitemap from './sampled';

describe('sample.ts', () => {
  describe('sampledUrls()', () => {
    it('should return expected urls', async () => {
      const sitemapXml = await fs.promises.readFile(
        './src/lib/fixtures/expected-sitemap.xml',
        'utf-8'
      );

      const result = await sitemap._sampledUrls(sitemapXml);
      expect(result).toEqual([
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
        'https://example.com/blog/hello-world',
        'https://example.com/blog/tag/red',
        'https://example.com/campsites/usa/new-york',
        'https://example.com/foo-path-1'
      ]);
      expect(result).not.toEqual([
        'https://example.com/dashboard',
        'https://example.com/dashboard/settings'
      ]);
    });
  });

  describe('sampledPaths()', () => {
    it('should return expected paths', async () => {
      const sitemapXml = await fs.promises.readFile(
        './src/lib/fixtures/expected-sitemap.xml',
        'utf-8'
      );

      const result = await sitemap._sampledPaths(sitemapXml);
      expect(result).toEqual([
        '/',
        '/about',
        '/blog',
        '/login',
        '/pricing',
        '/privacy',
        '/signup',
        '/terms',
        '/blog/hello-world',
        '/blog/tag/red',
        '/campsites/usa/new-york',
        '/foo-path-1'
      ]);
      expect(result).not.toEqual(['/dashboard', '/dashboard/settings']);
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
        'https://example.com/campsites/canada/ontario'
      ];
      const result = sitemap.findFirstMatches(patterns, haystack);
      expect(result).toEqual(
        new Set(['https://example.com/blog/hello-world', 'https://example.com/blog/tag/red'])
      );
    });
  });
});
