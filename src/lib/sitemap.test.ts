import { describe, it, expect } from 'vitest';
import * as sitemap from './sitemap';
import { XMLValidator } from 'fast-xml-parser';
import fs from 'fs';

describe('sitemap.ts', () => {
  describe('response()', async () => {
    it('should return expected result', async () => {
      // This test creates a sitemap based off the actual routes found within
      // this projects `/src/routes`, for a realistic test of:
      // 1. basic static pages (e.g. `/about`)
      // 2. multiple exclusion patterns (e.g. dashboard and pagination)
      // 3. groups that should be ignored (e.g. `(public)`)
      // 4. multiple routes with a single parameter (e.g. `/blog/[slug]` &
      //    `/blog/tag/[tag]`)
      // 5. ignoring of server-side routes (e.g. `/og/blog/[title].png` and
      //    `sitemap.xml` itself)

      const excludePatterns = [
        '^/dashboard.*',

        // Exclude routes containing `[page=integer]`–e.g. `/blog/2`
        `.*\\[page=integer\\].*`
      ];

      // Provide data for parameterized routes
      const paramValues = {
        '/blog/[slug]': ['hello-world', 'another-post', 'awesome-post'],
        '/blog/tag/[tag]': ['red', 'blue', 'green', 'cyan']
      };

      const res = await sitemap.response({
        origin: 'https://example.com',
        excludePatterns,
        paramValues,
        headers: {
          'custom-header': 'mars'
        },
        additionalPaths: ['/additional-path'],
        changefreq: 'daily', // TODO: Add test excluding changefreq & priority, and also setting them to false. or values different from these here.
        priority: 0.7
      });
      const resultXml = await res.text();

      const expectedSitemapXml = await fs.promises.readFile(
        './src/lib/fixtures/expected-sitemap.xml',
        'utf-8'
      );

      expect(resultXml).toEqual(expectedSitemapXml.trim());
      expect(res.headers.get('custom-header')).toEqual('mars');
    });
  });

  describe('generateBody()', () => {
    const paths = new Set(['/path1', '/path2']);
    const resultXml = sitemap.generateBody('https://example.com', paths);

    it('should generate the expected XML sitemap string', () => {
      const expected = `<?xml version="1.0" encoding="UTF-8" ?>
<urlset
  xmlns="https://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:news="https://www.google.com/schemas/sitemap-news/0.9"
  xmlns:xhtml="https://www.w3.org/1999/xhtml"
  xmlns:mobile="https://www.google.com/schemas/sitemap-mobile/1.0"
  xmlns:image="https://www.google.com/schemas/sitemap-image/1.1"
  xmlns:video="https://www.google.com/schemas/sitemap-video/1.1"
>
  <url>
    <loc>https://example.com/path1</loc>
  </url>
  <url>
    <loc>https://example.com/path2</loc>
  </url>
</urlset>`;

      expect(resultXml).toEqual(expected);
    });

    it('should return valid XML', () => {
      const validationResult = XMLValidator.validate(resultXml);
      expect(validationResult).toBe(true);
    });
  });

  describe('generatePaths()', () => {
    it('should return expected result', async () => {
      // This test creates a sitemap based off the actual routes found within
      // this projects `/src/routes`

      const excludePatterns = [
        '^/dashboard.*',

        // Exclude routes containing `[page=integer]`–e.g. `/blog/2`
        `.*\\[page=integer\\].*`
      ];

      // Provide data for parameterized routes
      const paramValues = {
        '/blog/[slug]': ['hello-world', 'another-post', 'awesome-post'],
        '/blog/tag/[tag]': ['red', 'blue', 'green', 'cyan']
      };

      const resultPaths = sitemap.generatePaths(excludePatterns, paramValues);

      const expectedPaths = [
        '/',
        '/about',
        '/blog',
        '/login',
        '/pricing',
        '/privacy',
        '/signup',
        '/terms',
        '/blog/hello-world',
        '/blog/another-post',
        '/blog/awesome-post',
        '/blog/tag/red',
        '/blog/tag/blue',
        '/blog/tag/green',
        '/blog/tag/cyan'
      ];

      expect(resultPaths).toEqual(expectedPaths);
    });
  });

  describe('filterRoutes()', () => {
    it('should filter routes correctly', () => {
      const routes = [
        '/src/routes/(marketing)/(home)/+page.svelte',
        '/src/routes/(marketing)/about/+page.svelte',
        '/src/routes/(marketing)/blog/(index)/+page.svelte',
        '/src/routes/(marketing)/blog/(index)/[page=integer]/+page.svelte',
        '/src/routes/(marketing)/blog/[slug]/+page.svelte',
        '/src/routes/(marketing)/blog/tag/[tag]/+page.svelte',
        '/src/routes/(marketing)/blog/tag/[tag]/[page=integer]/+page.svelte',
        '/src/routes/(marketing)/do-not-remove-this-dashboard-occurrence/+page.svelte',
        '/src/routes/(marketing)/login/+page.svelte',
        '/src/routes/(marketing)/pricing/+page.svelte',
        '/src/routes/(marketing)/privacy/+page.svelte',
        '/src/routes/(marketing)/signup/+page.svelte',
        '/src/routes/(marketing)/support/+page.svelte',
        '/src/routes/(marketing)/terms/+page.svelte',
        '/src/routes/dashboard/(index)/+page.svelte',
        '/src/routes/dashboard/settings/+page.svelte'
      ];

      const excludePatterns = [
        '^/dashboard.*',

        // Exclude all routes that contain [page=integer], e.g. `/blog/2`
        `.*\\[page\\=integer\\].*`
      ];

      const expectedResult = [
        '/',
        '/about',
        '/blog',
        '/blog/[slug]',
        '/blog/tag/[tag]',
        '/do-not-remove-this-dashboard-occurrence',
        '/login',
        '/pricing',
        '/privacy',
        '/signup',
        '/support',
        '/terms'
      ];

      const result = sitemap.filterRoutes(routes, excludePatterns);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('buildParameterizedPaths()', () => {
    let routes = ['/', '/about', '/pricing', '/blog', '/blog/[slug]', '/blog/tag/[tag]'];
    const paramValues = {
      '/blog/[slug]': ['hello-world', 'another-post'],
      '/blog/tag/[tag]': ['red', 'blue', 'green']
    };

    it('should build parameterized paths and remove the original tokenized route(s)', () => {
      const expectedRoutes = ['/', '/about', '/pricing', '/blog'];
      const expectedPaths = [
        '/blog/hello-world',
        '/blog/another-post',
        '/blog/tag/red',
        '/blog/tag/blue',
        '/blog/tag/green'
      ];

      let parameterizedPaths;
      [routes, parameterizedPaths] = sitemap.buildParameterizedPaths(routes, paramValues);
      expect(parameterizedPaths).toEqual(expectedPaths);
      expect(routes).toEqual(expectedRoutes);
    });

    it('should return routes unchanged, when no tokenized routes exist & given no paramValues', () => {
      let routes = ['/', '/about', '/pricing', '/blog'];
      const paramValues = {};

      let parameterizedPaths;
      // eslint-disable-next-line prefer-const
      [routes, parameterizedPaths] = sitemap.buildParameterizedPaths(routes, paramValues);
      expect(parameterizedPaths).toEqual([]);
      expect(routes).toEqual(routes);
    });

    it('should throw error, when paramValues contains data for a route that no longer exists', () => {
      let routes = ['/', '/about', '/pricing', '/blog'];

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      let parameterizedPaths;
      const result = () => {
        [routes, parameterizedPaths] = sitemap.buildParameterizedPaths(routes, paramValues);
      };
      expect(result).toThrow(Error);
    });

    it('should throw error, when tokenized routes exist that are not given data via paramValues', () => {
      let routes = ['/', '/about', '/blog', '/products/[product]'];
      const paramValues = {};

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      let parameterizedPaths;
      const result = () => {
        [routes, parameterizedPaths] = sitemap.buildParameterizedPaths(routes, paramValues);
      };
      expect(result).toThrow(Error);
    });
  });
});
