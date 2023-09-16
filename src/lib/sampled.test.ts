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

      const result = await sitemap.sampledUrls(sitemapXml);
      expect(result).toEqual([
        'https://example.com/',
        'https://example.com/about',
        'https://example.com/blog',
        'https://example.com/blog/hello-world',
        'https://example.com/blog/tag/red',
        'https://example.com/dashboard',
        'https://example.com/dashboard/settings',
        'https://example.com/login',
        'https://example.com/pricing',
        'https://example.com/privacy',
        'https://example.com/signup',
        'https://example.com/terms'
      ]);
    });
  });

  describe('sampledPaths()', () => {
    it('should return expected paths', async () => {
      const sitemapXml = await fs.promises.readFile(
        './src/lib/fixtures/expected-sitemap.xml',
        'utf-8'
      );

      const result = await sitemap.sampledPaths(sitemapXml);
      expect(result).toEqual([
        '/',
        '/about',
        '/blog',
        '/blog/hello-world',
        '/blog/tag/red',
        '/dashboard',
        '/dashboard/settings',
        '/login',
        '/pricing',
        '/privacy',
        '/signup',
        '/terms'
      ]);
    });
  });

  describe('findFirstMatches()', () => {
    it('should a max of one match for each regex', () => {
      const patterns = new Set(['/blog/([^/]+)', '/blog/([^/]+)/([^/]+)']);
      const haystack = [
        'https://example.com/',
        'https://example.com/blog',
        'https://example.com/blog/hello-world',
        'https://example.com/blog/another-post',
        'https://example.com/blog/tag/red',
        'https://example.com/blog/tag/green',
        'https://example.com/blog/tag/blue'
      ];
      const result = sitemap.findFirstMatches(patterns, haystack);
      expect(result).toEqual(
        new Set(['https://example.com/blog/hello-world', 'https://example.com/blog/tag/red'])
      );
    });
  });
});
