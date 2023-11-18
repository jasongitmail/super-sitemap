import { XMLValidator } from 'fast-xml-parser';
import fs from 'fs';
import { describe, expect, it } from 'vitest';

import type { SitemapConfig } from './sitemap.js';

import * as sitemap from './sitemap.js';

describe('sitemap.ts', () => {
  describe('response()', async () => {
    const config: SitemapConfig = {
      additionalPaths: ['/additional-path'],
      changefreq: 'daily',
      excludePatterns: [
        '.*/dashboard.*',
        '(secret-group)',

        // Exclude a single optional parameter; using 'optionals/to-exclude' as
        // the pattern would exclude both of the next 2 patterns, but I want to
        // test them separately.
        '/optionals/to-exclude/\\[\\[optional\\]\\]',
        '/optionals/to-exclude$',

        '/optionals$',

        // Exclude routes containing `[page=integer]`–e.g. `/blog/2`
        `.*\\[page=integer\\].*`,
      ],
      headers: {
        'custom-header': 'mars',
      },
      origin: 'https://example.com',

      /* eslint-disable perfectionist/sort-objects */
      paramValues: {
        '/[foo]': ['foo-path-1'],
        // Optional params
        '/optionals/[[optional]]': ['optional-1', 'optional-2'],
        '/optionals/many/[[paramA]]': ['param-a1', 'param-a2'],
        '/optionals/many/[[paramA]]/[[paramB]]': [
          ['param-a1', 'param-b1'],
          ['param-a2', 'param-b2'],
        ],
        // 1D array
        '/blog/[slug]': ['hello-world', 'another-post', 'awesome-post'],
        // 2D with only 1 element each
        '/blog/tag/[tag]': [['red'], ['blue'], ['green'], ['cyan']],
        // 2D array
        '/campsites/[country]/[state]': [
          ['usa', 'new-york'],
          ['usa', 'california'],
          ['canada', 'toronto'],
        ],
      },
      priority: 0.7,
    };

    it('when URLs <= maxPerPage, should return a sitemap', async () => {
      // This test creates a sitemap based off the actual routes found within
      // this projects `/src/routes`, for a realistic test of:
      // 1. basic static pages (e.g. `/about`)
      // 2. multiple exclusion patterns (e.g. dashboard and pagination)
      // 3. groups that should be ignored (e.g. `(public)`)
      // 4. multiple routes with a single parameter (e.g. `/blog/[slug]` &
      //    `/blog/tag/[tag]`)
      // 5. ignoring of server-side routes (e.g. `/og/blog/[title].png` and
      //    `sitemap.xml` itself)
      const res = await sitemap.response(config);
      const resultXml = await res.text();
      const expectedSitemapXml = await fs.promises.readFile(
        './src/lib/fixtures/expected-sitemap.xml',
        'utf-8'
      );
      expect(resultXml).toEqual(expectedSitemapXml.trim());
      expect(res.headers.get('custom-header')).toEqual('mars');
    });

    it('when config.origin is not provided, should throw error', async () => {
      const newConfig = JSON.parse(JSON.stringify(config));
      delete newConfig.origin;
      const fn = () => sitemap.response(newConfig);
      expect(fn()).rejects.toThrow('Sitemap: `origin` property is required in sitemap config.');
    });

    it('when param values are not provided for a parameterized route, should throw error', async () => {
      const newConfig = JSON.parse(JSON.stringify(config));
      delete newConfig.paramValues['/campsites/[country]/[state]'];
      const fn = () => sitemap.response(newConfig);
      expect(fn()).rejects.toThrow(
        "Sitemap: paramValues not provided for: '/campsites/[country]/[state]'"
      );
    });

    it('when param values are provided for route that does not exist, should throw error', async () => {
      const newConfig = JSON.parse(JSON.stringify(config));
      newConfig.paramValues['/old-route/[foo]'] = ['a', 'b', 'c'];
      const fn = () => sitemap.response(newConfig);
      expect(fn()).rejects.toThrow(
        "Sitemap: paramValues were provided for route that no longer exists: '/old-route/[foo]' within your project's 'src/routes/'. Remove this property from paramValues."
      );
    });

    describe('sitemap index', () => {
      it('when URLs > maxPerPage, should return a sitemap index', async () => {
        config.maxPerPage = 9;
        const res = await sitemap.response(config);
        const resultXml = await res.text();
        const expectedSitemapXml = await fs.promises.readFile(
          './src/lib/fixtures/expected-sitemap-index.xml',
          'utf-8'
        );
        expect(resultXml).toEqual(expectedSitemapXml.trim());
      });

      it.only.each([
        ['1', './src/lib/fixtures/expected-sitemap-index-subpage1.xml'],
        ['2', './src/lib/fixtures/expected-sitemap-index-subpage2.xml'],
        // ['3', './src/lib/fixtures/expected-sitemap-index-subpage3.xml'],
      ])(
        'subpage (e.g. sitemap%s.xml) should return a sitemap with expected URL subset',
        async (page, expectedFile) => {
          config.maxPerPage = 9;
          config.page = page;
          const res = await sitemap.response(config);
          const resultXml = await res.text();
          const expectedSitemapXml = await fs.promises.readFile(expectedFile, 'utf-8');
          expect(resultXml).toEqual(expectedSitemapXml.trim());
        }
      );

      it.each([['-3'], ['3.3'], ['invalid']])(
        `when page param is invalid ('%s'), should respond 400`,
        async (page) => {
          config.maxPerPage = 9;
          config.page = page;
          const res = await sitemap.response(config);
          expect(res.status).toEqual(400);
        }
      );

      it('when page param is greater than subpages that exist, should respond 404', async () => {
        config.maxPerPage = 9;
        config.page = '999999';
        const res = await sitemap.response(config);
        expect(res.status).toEqual(404);
      });
    });
  });

  describe('generateBody()', () => {
    const paths = new Set(['/path1', '/path2']);
    const resultXml = sitemap.generateBody('https://example.com', paths);

    it('should generate the expected XML sitemap string', () => {
      const expected = `
<?xml version="1.0" encoding="UTF-8" ?>
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
</urlset>`.trim();

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
      // this projects `/src/routes`, given generatePaths() uses
      // `import.meta.glob()`.

      const excludePatterns = [
        '.*/dashboard.*',
        '(secret-group)',
        '(authenticated)',
        '/optionals/to-exclude',

        // Exclude routes containing `[page=integer]`–e.g. `/blog/2`
        `.*\\[page=integer\\].*`,
      ];

      // Provide data for parameterized routes
      /* eslint-disable perfectionist/sort-objects */
      const paramValues = {
        '/[foo]': ['foo-path-1'],
        // Optional params
        '/optionals/[[optional]]': ['optional-1', 'optional-2'],
        '/optionals/many/[[paramA]]': ['param-a1', 'param-a2'],
        '/optionals/many/[[paramA]]/[[paramB]]': [
          ['param-a1', 'param-b1'],
          ['param-a2', 'param-b2'],
        ],
        // 1D array
        '/blog/[slug]': ['hello-world', 'another-post'],
        // 2D with only 1 element each
        '/blog/tag/[tag]': [['red'], ['blue'], ['green'], ['cyan']],
        // 2D array
        '/campsites/[country]/[state]': [
          ['usa', 'new-york'],
          ['usa', 'california'],
          ['canada', 'toronto'],
        ],
      };

      const resultPaths = sitemap.generatePaths(excludePatterns, paramValues);
      const expectedPaths = [
        '/',
        '/about',
        '/blog',
        '/login',
        '/optionals',
        '/optionals/many',
        '/pricing',
        '/privacy',
        '/signup',
        '/terms',
        '/foo-path-1',
        '/optionals/optional-1',
        '/optionals/optional-2',
        '/optionals/many/param-a1',
        '/optionals/many/param-a2',
        '/optionals/many/param-a1/param-b1',
        '/optionals/many/param-a2/param-b2',
        '/blog/hello-world',
        '/blog/another-post',
        '/blog/tag/red',
        '/blog/tag/blue',
        '/blog/tag/green',
        '/blog/tag/cyan',
        '/campsites/usa/new-york',
        '/campsites/usa/california',
        '/campsites/canada/toronto',
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
        '/src/routes/(marketing)/foo/[[paramA]]/+page.svelte',
        '/src/routes/dashboard/(index)/+page.svelte',
        '/src/routes/dashboard/settings/+page.svelte',
        '/src/routes/(authenticated)/hidden/+page.svelte',
      ];

      const excludePatterns = [
        '^/dashboard.*',
        '(authenticated)',

        // Exclude all routes that contain [page=integer], e.g. `/blog/2`
        `.*\\[page\\=integer\\].*`,
      ];

      const expectedResult = [
        '/',
        '/about',
        '/blog',
        '/blog/[slug]',
        '/blog/tag/[tag]',
        '/do-not-remove-this-dashboard-occurrence',
        '/foo/[[paramA]]',
        '/login',
        '/pricing',
        '/privacy',
        '/signup',
        '/support',
        '/terms',
      ];

      const result = sitemap.filterRoutes(routes, excludePatterns);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('generateParamPaths()', () => {
    let routes = [
      '/',
      '/about',
      '/pricing',
      '/blog',
      '/blog/[slug]',
      '/blog/tag/[tag]',
      '/campsites/[country]/[state]',
      '/optionals/[[optional]]',
    ];
    const paramValues = {
      '/optionals/[[optional]]': ['optional-1', 'optional-2'],

      // 1D array
      '/blog/[slug]': ['hello-world', 'another-post'],
      // 2D with only 1 element each
      '/blog/tag/[tag]': [['red'], ['blue'], ['green']],
      // 2D array
      '/campsites/[country]/[state]': [
        ['usa', 'new-york'],
        ['usa', 'california'],
        ['canada', 'toronto'],
      ],
    };

    it('should build parameterized paths and remove the original tokenized route(s)', () => {
      const expectedRoutes = ['/', '/about', '/pricing', '/blog'];
      const expectedPaths = [
        '/optionals/optional-1',
        '/optionals/optional-2',
        '/blog/hello-world',
        '/blog/another-post',
        '/blog/tag/red',
        '/blog/tag/blue',
        '/blog/tag/green',
        '/campsites/usa/new-york',
        '/campsites/usa/california',
        '/campsites/canada/toronto',
      ];

      let parameterizedPaths;
      [routes, parameterizedPaths] = sitemap.generateParamPaths(routes, paramValues);
      expect(parameterizedPaths).toEqual(expectedPaths);
      expect(routes).toEqual(expectedRoutes);
    });

    it('should return routes unchanged, when no tokenized routes exist & given no paramValues', () => {
      let routes = ['/', '/about', '/pricing', '/blog'];
      const paramValues = {};

      let parameterizedPaths;
      // eslint-disable-next-line prefer-const
      [routes, parameterizedPaths] = sitemap.generateParamPaths(routes, paramValues);
      expect(parameterizedPaths).toEqual([]);
      expect(routes).toEqual(routes);
    });

    it('should throw error, when paramValues contains data for a route that no longer exists', () => {
      let routes = ['/', '/about', '/pricing', '/blog'];

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      let parameterizedPaths;
      const result = () => {
        [routes, parameterizedPaths] = sitemap.generateParamPaths(routes, paramValues);
      };
      expect(result).toThrow(Error);
    });

    it('should throw error, when tokenized routes exist that are not given data via paramValues', () => {
      let routes = ['/', '/about', '/blog', '/products/[product]'];
      const paramValues = {};

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      let parameterizedPaths;
      const result = () => {
        [routes, parameterizedPaths] = sitemap.generateParamPaths(routes, paramValues);
      };
      expect(result).toThrow(Error);
    });
  });

  describe('generateSitemapIndex()', () => {
    it('should generate sitemap index with correct number of pages', () => {
      const origin = 'https://example.com';
      const pages = 3;
      const expectedSitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap1.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap2.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap3.xml</loc>
  </sitemap>
</sitemapindex>`;

      const sitemapIndex = sitemap.generateSitemapIndex(origin, pages);
      expect(sitemapIndex).toEqual(expectedSitemapIndex);
    });
  });

  describe('processRoutesForOptionalParams()', () => {
    it('should process routes with optional parameters correctly', () => {
      const routes = [
        '/foo/[[paramA]]/+page.svelte',
        '/foo/bar/[paramB]/[[paramC]]/[[paramD]]/+page.svelte',
        '/product/[id]/+page.svelte',
        '/other/+page.svelte',
      ];
      const expected = [
        // route 0
        '/foo/+page.svelte',
        '/foo/[[paramA]]/+page.svelte',
        // route 1
        '/foo/bar/[paramB]/+page.svelte',
        '/foo/bar/[paramB]/[[paramC]]/+page.svelte',
        '/foo/bar/[paramB]/[[paramC]]/[[paramD]]/+page.svelte',
        // route 2
        '/product/[id]/+page.svelte',
        // route 3
        '/other/+page.svelte',
      ];

      const result = sitemap.processRoutesForOptionalParams(routes);
      expect(result).toEqual(expected);
    });
  });

  describe('processOptionalParams()', () => {
    const testData = [
      {
        input: '/foo/[[paramA]]',
        expected: ['/foo/+page.svelte', '/foo/[[paramA]]/+page.svelte'],
      },
      {
        input: '/foo/[[paramA]]/[[paramB]]',
        expected: [
          '/foo/+page.svelte',
          '/foo/[[paramA]]/+page.svelte',
          '/foo/[[paramA]]/[[paramB]]/+page.svelte',
        ],
      },
      {
        input: '/foo/bar/[paramB]/[[paramC]]/[[paramD]]',
        expected: [
          '/foo/bar/[paramB]/+page.svelte',
          '/foo/bar/[paramB]/[[paramC]]/+page.svelte',
          '/foo/bar/[paramB]/[[paramC]]/[[paramD]]/+page.svelte',
        ],
      },
      {
        input: '/foo/[[paramA]]/[[paramB]]/[[paramC]]',
        expected: [
          '/foo/+page.svelte',
          '/foo/[[paramA]]/+page.svelte',
          '/foo/[[paramA]]/[[paramB]]/+page.svelte',
          '/foo/[[paramA]]/[[paramB]]/[[paramC]]/+page.svelte',
        ],
      },
    ];

    // Running the tests
    for (const { input, expected } of testData) {
      it(`should create all versions of a route containing >=1 optional param, given: "${input}"`, () => {
        const result = sitemap.processOptionalParams(input);
        expect(result).toEqual(expected);
      });
    }
  });
});
