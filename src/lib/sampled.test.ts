import fs from 'fs';
import { http } from 'msw';
import os from 'os';
import path from 'path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { discoverSvelteKitPageRouteFilesFromDirectory } from '../adapters/sveltekit/index.js';
import { server } from './fixtures/mocks.js';
import { sampledPaths, sampledUrls } from './index.js';
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
      'https://example.com/markdown-md',
      'https://example.com/markdown-svx',
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

      it('root-exported sampledUrls() should fetch a sitemap and return expected urls', async () => {
        const xml = await fs.promises.readFile('./src/lib/fixtures/expected-sitemap.xml', 'utf-8');
        server.use(http.get('https://example.com/sitemap.xml', () => new Response(xml)));

        const result = await sampledUrls('https://example.com/sitemap.xml');
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
      '/markdown-md',
      '/markdown-svx',
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

      it('root-exported sampledPaths() should fetch a sitemap and return expected paths', async () => {
        const xml = await fs.promises.readFile('./src/lib/fixtures/expected-sitemap.xml', 'utf-8');
        server.use(http.get('https://example.com/sitemap.xml', () => new Response(xml)));

        const result = await sampledPaths('https://example.com/sitemap.xml');
        expect(result).toEqual(expectedSampledPaths);
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

  describe('listFilePathsRecursively()', () => {
    it('should return the full path of each file in nested directories', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'super-sitemap-'));
      const nestedDir = path.join(tmpDir, 'nested', 'deeper');

      try {
        // Set up dirs and files
        fs.mkdirSync(nestedDir, { recursive: true });
        const rootFile = path.join(tmpDir, '+page.svelte');
        const nestedFile = path.join(tmpDir, 'nested', '+page@.svelte');
        const deepFile = path.join(nestedDir, '+page.md');

        fs.writeFileSync(rootFile, '');
        fs.writeFileSync(nestedFile, '');
        fs.writeFileSync(deepFile, '');

        const result = sitemap.listFilePathsRecursively(tmpDir).sort();
        expect(result).toEqual([deepFile, nestedFile, rootFile].sort());
      } finally {
        fs.rmSync(tmpDir, { force: true, recursive: true });
      }
    });
  });

  describe('SvelteKit adapter-compatible route discovery', () => {
    it('should discover supported SvelteKit page file variants and exclude endpoints', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'super-sitemap-routes-'));

      try {
        const files = [
          '+page.svelte',
          'terms/+page@.svelte',
          'break/+page@foo.svelte',
          'break-dynamic/+page@[id].svelte',
          'break-group/+page@(id).svelte',
          'markdown/+page.md',
          'content/+page.svx',
          'api/+server.ts',
        ];

        for (const file of files) {
          const filePath = path.join(tmpDir, file);
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, '');
        }

        expect(discoverSvelteKitPageRouteFilesFromDirectory(tmpDir).sort()).toEqual(
          [
            '/src/routes/+page.svelte',
            '/src/routes/break/+page@foo.svelte',
            '/src/routes/break-dynamic/+page@[id].svelte',
            '/src/routes/break-group/+page@(id).svelte',
            '/src/routes/content/+page.svx',
            '/src/routes/markdown/+page.md',
            '/src/routes/terms/+page@.svelte',
          ].sort()
        );
      } finally {
        fs.rmSync(tmpDir, { force: true, recursive: true });
      }
    });
  });
});
