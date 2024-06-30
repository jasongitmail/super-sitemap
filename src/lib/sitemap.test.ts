import { XMLValidator } from 'fast-xml-parser';
import fs from 'fs';
import { describe, expect, it } from 'vitest';

import type { LangConfig } from './sitemap.js';
import type { SitemapConfig } from './sitemap.js';

import * as sitemap from './sitemap.js';

describe('sitemap.ts', () => {
  describe('response()', async () => {
    const config: SitemapConfig = {
      additionalPaths: ['/foo.pdf'],
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
        '/[[lang]]/[foo]': ['foo-path-1'],
        // Optional params
        '/[[lang]]/optionals/[[optional]]': ['optional-1', 'optional-2'],
        '/[[lang]]/optionals/many/[[paramA]]': ['data-a1', 'data-a2'],
        '/[[lang]]/optionals/many/[[paramA]]/[[paramB]]': [
          ['data-a1', 'data-b1'],
          ['data-a2', 'data-b2'],
        ],
        '/[[lang]]/optionals/many/[[paramA]]/[[paramB]]/foo': [
          ['data-a1', 'data-b1'],
          ['data-a2', 'data-b2'],
        ],
        // 1D array
        '/[[lang]]/blog/[slug]': ['hello-world', 'another-post', 'awesome-post'],
        // 2D with only 1 element each
        // '/[[lang]]/blog/tag/[tag]': [['red'], ['blue'], ['green'], ['cyan']],
        '/[[lang]]/blog/tag/[tag]': [['red'], ['blue']],
        // 2D array
        '/[[lang]]/campsites/[country]/[state]': [
          ['usa', 'new-york'],
          ['usa', 'california'],
          ['canada', 'toronto'],
        ],
      },
      priority: 0.7,
      sort: 'alpha', // helps predictability of test data
      lang: {
        default: 'en',
        alternates: ['zh'],
      },
    };

    it('when URLs <= maxPerPage (50_000 50_000), should return a sitemap', async () => {
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

    it.todo(
      'when param values are not provided for a parameterized route, should throw error',
      async () => {
        const newConfig = JSON.parse(JSON.stringify(config));
        delete newConfig.paramValues['/campsites/[country]/[state]'];
        const fn = () => sitemap.response(newConfig);
        expect(fn()).rejects.toThrow(
          "Sitemap: paramValues not provided for: '/campsites/[country]/[state]'"
        );
      }
    );

    it('when param values are provided for route that does not exist, should throw error', async () => {
      const newConfig = JSON.parse(JSON.stringify(config));
      newConfig.paramValues['/old-route/[foo]'] = ['a', 'b', 'c'];
      const fn = () => sitemap.response(newConfig);
      await expect(fn()).rejects.toThrow(
        "Sitemap: paramValues were provided for a route that does not exists within src/routes/: '/old-route/[foo]'. Remove this property from your paramValues."
      );
    });

    describe('sitemap index', () => {
      it('when URLs > maxPerPage, should return a sitemap index', async () => {
        config.maxPerPage = 20;
        const res = await sitemap.response(config);
        const resultXml = await res.text();
        const expectedSitemapXml = await fs.promises.readFile(
          './src/lib/fixtures/expected-sitemap-index.xml',
          'utf-8'
        );
        expect(resultXml).toEqual(expectedSitemapXml.trim());
      });

      it.each([
        ['1', './src/lib/fixtures/expected-sitemap-index-subpage1.xml'],
        ['2', './src/lib/fixtures/expected-sitemap-index-subpage2.xml'],
        ['3', './src/lib/fixtures/expected-sitemap-index-subpage3.xml'],
      ])(
        'subpage (e.g. sitemap%s.xml) should return a sitemap with expected URL subset',
        async (page, expectedFile) => {
          config.maxPerPage = 20;
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
          config.maxPerPage = 20;
          config.page = page;
          const res = await sitemap.response(config);
          expect(res.status).toEqual(400);
        }
      );

      it('when page param is greater than subpages that exist, should respond 404', async () => {
        config.maxPerPage = 20;
        config.page = '999999';
        const res = await sitemap.response(config);
        expect(res.status).toEqual(404);
      });
    });
  });

  describe('generateBody()', () => {
    const paths = new Set([
      { path: '/path1' },
      { path: '/path2' },
      // Note: in reality, an entry would already exist for /about, /es/about,
      // /de/about, which would generate a url loc for each of these.
      {
        path: '/about',
        alternates: [
          { lang: 'en', path: '/about' },
          { lang: 'de', path: '/de/about' },
          { lang: 'es', path: '/es/about' },
        ],
      },
    ]);
    const resultXml = sitemap.generateBody('https://example.com', paths, 'weekly', 0.3);

    it('should generate the expected XML sitemap string', () => {
      const expected = `
<?xml version="1.0" encoding="UTF-8" ?>
<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/path1</loc>
    <changefreq>weekly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://example.com/path2</loc>
    <changefreq>weekly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://example.com/about</loc>
    <changefreq>weekly</changefreq>
    <priority>0.3</priority>
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/about" />
    <xhtml:link rel="alternate" hreflang="de" href="https://example.com/de/about" />
    <xhtml:link rel="alternate" hreflang="es" href="https://example.com/es/about" />
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
    it('should throw error if one or more routes contains [[lang]], but lang config not provided', async () => {
      // This test creates a sitemap based off the actual routes found within
      // this projects `/src/routes`, given generatePaths() uses
      // `import.meta.glob()`.
      const excludePatterns: string[] = [];
      const paramValues = {};
      const fn = () => {
        sitemap.generatePaths(excludePatterns, paramValues);
      };
      expect(fn).toThrowError();
    });

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
        '/[[lang]]/[foo]': ['foo-path-1'],
        // Optional params
        '/[[lang]]/optionals/[[optional]]': ['optional-1', 'optional-2'],
        '/[[lang]]/optionals/many/[[paramA]]': ['param-a1', 'param-a2'],
        '/[[lang]]/optionals/many/[[paramA]]/[[paramB]]': [
          ['param-a1', 'param-b1'],
          ['param-a2', 'param-b2'],
        ],
        '/[[lang]]/optionals/many/[[paramA]]/[[paramB]]/foo': [
          ['param-a1', 'param-b1'],
          ['param-a2', 'param-b2'],
        ],
        // 1D array
        '/[[lang]]/blog/[slug]': ['hello-world', 'another-post'],
        // 2D with only 1 element each
        '/[[lang]]/blog/tag/[tag]': [['red'], ['blue']],
        // 2D array
        '/[[lang]]/campsites/[country]/[state]': [
          ['usa', 'new-york'],
          ['usa', 'california'],
          ['canada', 'toronto'],
        ],
      };

      const langConfig: LangConfig = {
        default: 'en',
        alternates: ['zh'],
      };
      const resultPaths = sitemap.generatePaths(excludePatterns, paramValues, langConfig);
      const expectedPaths = [
        // prettier-ignore
        {
          alternates: [
            { lang: 'en', path: '/' },
            { lang: 'zh', path: '/zh' },
          ],
          path: '/',
        },
        {
          alternates: [
            { lang: 'en', path: '/' },
            { lang: 'zh', path: '/zh' },
          ],
          path: '/zh',
        },
        {
          alternates: [
            { lang: 'en', path: '/about' },
            { lang: 'zh', path: '/zh/about' },
          ],
          path: '/about',
        },
        {
          alternates: [
            { lang: 'en', path: '/about' },
            { lang: 'zh', path: '/zh/about' },
          ],
          path: '/zh/about',
        },
        {
          alternates: [
            { lang: 'en', path: '/blog' },
            { lang: 'zh', path: '/zh/blog' },
          ],
          path: '/blog',
        },
        {
          alternates: [
            { lang: 'en', path: '/blog' },
            { lang: 'zh', path: '/zh/blog' },
          ],
          path: '/zh/blog',
        },
        {
          alternates: [
            { lang: 'en', path: '/login' },
            { lang: 'zh', path: '/zh/login' },
          ],
          path: '/login',
        },
        {
          alternates: [
            { lang: 'en', path: '/login' },
            { lang: 'zh', path: '/zh/login' },
          ],
          path: '/zh/login',
        },
        {
          alternates: [
            { lang: 'en', path: '/optionals' },
            { lang: 'zh', path: '/zh/optionals' },
          ],
          path: '/optionals',
        },
        {
          alternates: [
            { lang: 'en', path: '/optionals' },
            { lang: 'zh', path: '/zh/optionals' },
          ],
          path: '/zh/optionals',
        },
        {
          alternates: [
            { lang: 'en', path: '/optionals/many' },
            { lang: 'zh', path: '/zh/optionals/many' },
          ],
          path: '/optionals/many',
        },
        {
          alternates: [
            { lang: 'en', path: '/optionals/many' },
            { lang: 'zh', path: '/zh/optionals/many' },
          ],
          path: '/zh/optionals/many',
        },
        {
          alternates: [
            { lang: 'en', path: '/pricing' },
            { lang: 'zh', path: '/zh/pricing' },
          ],
          path: '/pricing',
        },
        {
          alternates: [
            { lang: 'en', path: '/pricing' },
            { lang: 'zh', path: '/zh/pricing' },
          ],
          path: '/zh/pricing',
        },
        {
          alternates: [
            { lang: 'en', path: '/privacy' },
            { lang: 'zh', path: '/zh/privacy' },
          ],
          path: '/privacy',
        },
        {
          alternates: [
            { lang: 'en', path: '/privacy' },
            { lang: 'zh', path: '/zh/privacy' },
          ],
          path: '/zh/privacy',
        },
        {
          alternates: [
            { lang: 'en', path: '/signup' },
            { lang: 'zh', path: '/zh/signup' },
          ],
          path: '/signup',
        },
        {
          alternates: [
            { lang: 'en', path: '/signup' },
            { lang: 'zh', path: '/zh/signup' },
          ],
          path: '/zh/signup',
        },
        {
          alternates: [
            { lang: 'en', path: '/terms' },
            { lang: 'zh', path: '/zh/terms' },
          ],
          path: '/terms',
        },
        {
          alternates: [
            { lang: 'en', path: '/terms' },
            { lang: 'zh', path: '/zh/terms' },
          ],
          path: '/zh/terms',
        },
        {
          alternates: [
            { lang: 'en', path: '/foo-path-1' },
            { lang: 'zh', path: '/zh/foo-path-1' },
          ],
          path: '/foo-path-1',
        },
        {
          alternates: [
            { lang: 'en', path: '/foo-path-1' },
            { lang: 'zh', path: '/zh/foo-path-1' },
          ],
          path: '/zh/foo-path-1',
        },
        {
          alternates: [
            { lang: 'en', path: '/optionals/optional-1' },
            { lang: 'zh', path: '/zh/optionals/optional-1' },
          ],
          path: '/optionals/optional-1',
        },
        {
          alternates: [
            { lang: 'en', path: '/optionals/optional-1' },
            { lang: 'zh', path: '/zh/optionals/optional-1' },
          ],
          path: '/zh/optionals/optional-1',
        },
        {
          alternates: [
            { lang: 'en', path: '/optionals/optional-2' },
            { lang: 'zh', path: '/zh/optionals/optional-2' },
          ],
          path: '/optionals/optional-2',
        },
        {
          alternates: [
            { lang: 'en', path: '/optionals/optional-2' },
            { lang: 'zh', path: '/zh/optionals/optional-2' },
          ],
          path: '/zh/optionals/optional-2',
        },
        {
          alternates: [
            { lang: 'en', path: '/optionals/many/param-a1' },
            { lang: 'zh', path: '/zh/optionals/many/param-a1' },
          ],
          path: '/optionals/many/param-a1',
        },
        {
          alternates: [
            { lang: 'en', path: '/optionals/many/param-a1' },
            { lang: 'zh', path: '/zh/optionals/many/param-a1' },
          ],
          path: '/zh/optionals/many/param-a1',
        },
        {
          alternates: [
            { lang: 'en', path: '/optionals/many/param-a2' },
            { lang: 'zh', path: '/zh/optionals/many/param-a2' },
          ],
          path: '/optionals/many/param-a2',
        },
        {
          alternates: [
            { lang: 'en', path: '/optionals/many/param-a2' },
            { lang: 'zh', path: '/zh/optionals/many/param-a2' },
          ],
          path: '/zh/optionals/many/param-a2',
        },
        {
          alternates: [
            { lang: 'en', path: '/optionals/many/param-a1/param-b1' },
            { lang: 'zh', path: '/zh/optionals/many/param-a1/param-b1' },
          ],
          path: '/optionals/many/param-a1/param-b1',
        },
        {
          alternates: [
            { lang: 'en', path: '/optionals/many/param-a1/param-b1' },
            { lang: 'zh', path: '/zh/optionals/many/param-a1/param-b1' },
          ],
          path: '/zh/optionals/many/param-a1/param-b1',
        },
        {
          alternates: [
            { lang: 'en', path: '/optionals/many/param-a2/param-b2' },
            { lang: 'zh', path: '/zh/optionals/many/param-a2/param-b2' },
          ],
          path: '/optionals/many/param-a2/param-b2',
        },
        {
          alternates: [
            { lang: 'en', path: '/optionals/many/param-a2/param-b2' },
            { lang: 'zh', path: '/zh/optionals/many/param-a2/param-b2' },
          ],
          path: '/zh/optionals/many/param-a2/param-b2',
        },
        {
          alternates: [
            { lang: 'en', path: '/optionals/many/param-a1/param-b1/foo' },
            { lang: 'zh', path: '/zh/optionals/many/param-a1/param-b1/foo' },
          ],
          path: '/optionals/many/param-a1/param-b1/foo',
        },
        {
          alternates: [
            { lang: 'en', path: '/optionals/many/param-a1/param-b1/foo' },
            { lang: 'zh', path: '/zh/optionals/many/param-a1/param-b1/foo' },
          ],
          path: '/zh/optionals/many/param-a1/param-b1/foo',
        },
        {
          alternates: [
            { lang: 'en', path: '/optionals/many/param-a2/param-b2/foo' },
            { lang: 'zh', path: '/zh/optionals/many/param-a2/param-b2/foo' },
          ],
          path: '/optionals/many/param-a2/param-b2/foo',
        },
        {
          alternates: [
            { lang: 'en', path: '/optionals/many/param-a2/param-b2/foo' },
            { lang: 'zh', path: '/zh/optionals/many/param-a2/param-b2/foo' },
          ],
          path: '/zh/optionals/many/param-a2/param-b2/foo',
        },
        {
          alternates: [
            { lang: 'en', path: '/blog/hello-world' },
            { lang: 'zh', path: '/zh/blog/hello-world' },
          ],
          path: '/blog/hello-world',
        },
        {
          alternates: [
            { lang: 'en', path: '/blog/hello-world' },
            { lang: 'zh', path: '/zh/blog/hello-world' },
          ],
          path: '/zh/blog/hello-world',
        },
        {
          alternates: [
            { lang: 'en', path: '/blog/another-post' },
            { lang: 'zh', path: '/zh/blog/another-post' },
          ],
          path: '/blog/another-post',
        },
        {
          alternates: [
            { lang: 'en', path: '/blog/another-post' },
            { lang: 'zh', path: '/zh/blog/another-post' },
          ],
          path: '/zh/blog/another-post',
        },
        {
          alternates: [
            { lang: 'en', path: '/blog/tag/red' },
            { lang: 'zh', path: '/zh/blog/tag/red' },
          ],
          path: '/blog/tag/red',
        },
        {
          alternates: [
            { lang: 'en', path: '/blog/tag/red' },
            { lang: 'zh', path: '/zh/blog/tag/red' },
          ],
          path: '/zh/blog/tag/red',
        },
        {
          alternates: [
            { lang: 'en', path: '/blog/tag/blue' },
            { lang: 'zh', path: '/zh/blog/tag/blue' },
          ],
          path: '/blog/tag/blue',
        },
        {
          alternates: [
            { lang: 'en', path: '/blog/tag/blue' },
            { lang: 'zh', path: '/zh/blog/tag/blue' },
          ],
          path: '/zh/blog/tag/blue',
        },
        {
          alternates: [
            { lang: 'en', path: '/campsites/usa/new-york' },
            { lang: 'zh', path: '/zh/campsites/usa/new-york' },
          ],
          path: '/campsites/usa/new-york',
        },
        {
          alternates: [
            { lang: 'en', path: '/campsites/usa/new-york' },
            { lang: 'zh', path: '/zh/campsites/usa/new-york' },
          ],
          path: '/zh/campsites/usa/new-york',
        },
        {
          alternates: [
            { lang: 'en', path: '/campsites/usa/california' },
            { lang: 'zh', path: '/zh/campsites/usa/california' },
          ],
          path: '/campsites/usa/california',
        },
        {
          alternates: [
            { lang: 'en', path: '/campsites/usa/california' },
            { lang: 'zh', path: '/zh/campsites/usa/california' },
          ],
          path: '/zh/campsites/usa/california',
        },
        {
          alternates: [
            { lang: 'en', path: '/campsites/canada/toronto' },
            { lang: 'zh', path: '/zh/campsites/canada/toronto' },
          ],
          path: '/campsites/canada/toronto',
        },
        {
          alternates: [
            { lang: 'en', path: '/campsites/canada/toronto' },
            { lang: 'zh', path: '/zh/campsites/canada/toronto' },
          ],
          path: '/zh/campsites/canada/toronto',
        },
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
        '/src/routes/(marketing)/terms/+page@.svelte',
        '/src/routes/(marketing)/foo/[[paramA]]/+page.svelte',
        '/src/routes/dashboard/(index)/+page.svelte',
        '/src/routes/dashboard/settings/+page.svelte',
        '/src/routes/(authenticated)/hidden/+page.svelte',
        '/src/routes/(test-non-aplhanumeric-group-name)/test-group/+page.svelte',
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
        '/test-group',
      ];

      const result = sitemap.filterRoutes(routes, excludePatterns);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('generateParamPaths()', () => {
    const routes = [
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
      const expectedPathsWithoutLang = [
        '/',
        '/about',
        '/pricing',
        '/blog',
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

      const { pathsWithLang, pathsWithoutLang } = sitemap.generatePathsWithParamValues(
        routes,
        paramValues
      );
      expect(pathsWithoutLang).toEqual(expectedPathsWithoutLang);
      expect(pathsWithLang).toEqual([]);
      // expect(routes).toEqual(expectedRoutes);
    });

    it('should return routes unchanged, when no tokenized routes exist & given no paramValues', () => {
      const routes = ['/', '/about', '/pricing', '/blog'];
      const paramValues = {};

      const { pathsWithLang, pathsWithoutLang } = sitemap.generatePathsWithParamValues(
        routes,
        paramValues
      );
      expect(pathsWithLang).toEqual([]);
      expect(pathsWithoutLang).toEqual(routes);
    });

    it('should throw error, when paramValues contains data for a route that no longer exists', () => {
      const routes = ['/', '/about', '/pricing', '/blog'];

      const result = () => {
        sitemap.generatePathsWithParamValues(routes, paramValues);
      };
      expect(result).toThrow(Error);
    });

    it('should throw error, when tokenized routes exist that are not given data via paramValues', () => {
      const routes = ['/', '/about', '/blog', '/products/[product]'];
      const paramValues = {};

      const result = () => {
        sitemap.generatePathsWithParamValues(routes, paramValues);
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
        '/foo/[[paramA]]',
        '/foo/bar/[paramB]/[[paramC]]/[[paramD]]',
        '/product/[id]',
        '/other',
      ];
      const expected = [
        // route 0
        '/foo',
        '/foo/[[paramA]]',
        // route 1
        '/foo/bar/[paramB]',
        '/foo/bar/[paramB]/[[paramC]]',
        '/foo/bar/[paramB]/[[paramC]]/[[paramD]]',
        // route 2
        '/product/[id]',
        // route 3
        '/other',
      ];

      const result = sitemap.processRoutesForOptionalParams(routes);
      expect(result).toEqual(expected);
    });

    it('when /[[lang]] exists, should process routes with optional parameters correctly', () => {
      const routes = [
        '/[[lang]]',
        '/[[lang]]/foo/[[paramA]]',
        '/[[lang]]/foo/bar/[paramB]/[[paramC]]/[[paramD]]',
        '/[[lang]]/product/[id]',
        '/[[lang]]/other',
      ];
      const expected = [
        '/[[lang]]',
        // route 0
        '/[[lang]]/foo',
        '/[[lang]]/foo/[[paramA]]',
        // route 1
        '/[[lang]]/foo/bar/[paramB]',
        '/[[lang]]/foo/bar/[paramB]/[[paramC]]',
        '/[[lang]]/foo/bar/[paramB]/[[paramC]]/[[paramD]]',
        // route 2
        '/[[lang]]/product/[id]',
        // route 3
        '/[[lang]]/other',
      ];

      const result = sitemap.processRoutesForOptionalParams(routes);
      expect(result).toEqual(expected);
    });

    it('when /[lang] exists, should process routes with optional parameters correctly', () => {
      const routes = [
        '/[lang=lang]',
        '/[lang]/foo/[[paramA]]',
        '/[lang]/foo/bar/[paramB]/[[paramC]]/[[paramD]]',
        '/[lang]/product/[id]',
        '/[lang]/other',
      ];
      const expected = [
        '/[lang=lang]',
        // route 0
        '/[lang]/foo',
        '/[lang]/foo/[[paramA]]',
        // route 1
        '/[lang]/foo/bar/[paramB]',
        '/[lang]/foo/bar/[paramB]/[[paramC]]',
        '/[lang]/foo/bar/[paramB]/[[paramC]]/[[paramD]]',
        // route 2
        '/[lang]/product/[id]',
        // route 3
        '/[lang]/other',
      ];

      const result = sitemap.processRoutesForOptionalParams(routes);
      expect(result).toEqual(expected);
    });
  });

  describe('processOptionalParams()', () => {
    const testData = [
      {
        input: '/[[lang]]/products/other/[[optional]]/[[optionalB]]/more',
        expected: [
          '/[[lang]]/products/other',
          '/[[lang]]/products/other/[[optional]]',
          '/[[lang]]/products/other/[[optional]]/[[optionalB]]',
          '/[[lang]]/products/other/[[optional]]/[[optionalB]]/more',
        ],
      },
      {
        input: '/foo/[[paramA]]',
        expected: ['/foo', '/foo/[[paramA]]'],
      },
      {
        input: '/foo/[[paramA]]/[[paramB]]',
        expected: ['/foo', '/foo/[[paramA]]', '/foo/[[paramA]]/[[paramB]]'],
      },
      {
        input: '/foo/bar/[paramB]/[[paramC]]/[[paramD]]',
        expected: [
          '/foo/bar/[paramB]',
          '/foo/bar/[paramB]/[[paramC]]',
          '/foo/bar/[paramB]/[[paramC]]/[[paramD]]',
        ],
      },
      {
        input: '/foo/[[paramA]]/[[paramB]]/[[paramC]]',
        expected: [
          '/foo',
          '/foo/[[paramA]]',
          '/foo/[[paramA]]/[[paramB]]',
          '/foo/[[paramA]]/[[paramB]]/[[paramC]]',
        ],
      },
      {
        input: '/[[bar]]',
        expected: ['/', '/[[bar]]'],
      },
      {
        input: '/[[lang]]',
        expected: ['/[[lang]]'],
      },
      // Special case b/c first param is [[lang]], followed by an optional param
      {
        input: '/[[lang]]/[[bar]]',
        expected: ['/[[lang]]', '/[[lang]]/[[bar]]'],
      },
      {
        input: '/[[lang]]/[foo]/[[bar]]',
        expected: ['/[[lang]]/[foo]', '/[[lang]]/[foo]/[[bar]]'],
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

  describe('generatePathsWithlang()', () => {
    const paths = ['/[[lang]]', '/[[lang]]/about', '/[[lang]]/foo/something'];
    const langConfig: LangConfig = {
      default: 'en',
      alternates: ['de', 'es'],
    };

    it('should return expected objects for all paths', () => {
      const result = sitemap.generatePathsWithLang(paths, langConfig);
      const expectedRootAlternates = [
        { lang: 'en', path: '/' },
        { lang: 'de', path: '/de' },
        { lang: 'es', path: '/es' },
      ];
      const expectedAboutAlternates = [
        { lang: 'en', path: '/about' },
        { lang: 'de', path: '/de/about' },
        { lang: 'es', path: '/es/about' },
      ];
      const expectedFooAlternates = [
        { lang: 'en', path: '/foo/something' },
        { lang: 'de', path: '/de/foo/something' },
        { lang: 'es', path: '/es/foo/something' },
      ];
      const expected = [
        {
          path: '/',
          alternates: expectedRootAlternates,
        },
        {
          path: '/de',
          alternates: expectedRootAlternates,
        },
        {
          path: '/es',
          alternates: expectedRootAlternates,
        },
        {
          path: '/about',
          alternates: expectedAboutAlternates,
        },
        {
          path: '/de/about',
          alternates: expectedAboutAlternates,
        },
        {
          path: '/es/about',
          alternates: expectedAboutAlternates,
        },
        {
          path: '/foo/something',
          alternates: expectedFooAlternates,
        },
        {
          path: '/de/foo/something',
          alternates: expectedFooAlternates,
        },
        {
          path: '/es/foo/something',
          alternates: expectedFooAlternates,
        },
      ];
      expect(result).toEqual(expected);
    });
  });

  describe('generatePathsWithRequiredlang()', () => {
    const paths = ['/[lang]', '/[lang]/about', '/[lang]/foo/something'];
    const langConfig: LangConfig = {
      default: 'en',
      alternates: ['de', 'es'],
    };

    it('should return expected objects for all paths', () => {
      const result = sitemap.generatePathsWithLang(paths, langConfig);
      const expectedRootAlternates = [
        { lang: 'en', path: '/en' },
        { lang: 'de', path: '/de' },
        { lang: 'es', path: '/es' },
      ];
      const expectedAboutAlternates = [
        { lang: 'en', path: '/en/about' },
        { lang: 'de', path: '/de/about' },
        { lang: 'es', path: '/es/about' },
      ];
      const expectedFooAlternates = [
        { lang: 'en', path: '/en/foo/something' },
        { lang: 'de', path: '/de/foo/something' },
        { lang: 'es', path: '/es/foo/something' },
      ];
      const expected = [
        {
          path: '/en',
          alternates: expectedRootAlternates,
        },
        {
          path: '/de',
          alternates: expectedRootAlternates,
        },
        {
          path: '/es',
          alternates: expectedRootAlternates,
        },
        {
          path: '/en/about',
          alternates: expectedAboutAlternates,
        },
        {
          path: '/de/about',
          alternates: expectedAboutAlternates,
        },
        {
          path: '/es/about',
          alternates: expectedAboutAlternates,
        },
        {
          path: '/en/foo/something',
          alternates: expectedFooAlternates,
        },
        {
          path: '/de/foo/something',
          alternates: expectedFooAlternates,
        },
        {
          path: '/es/foo/something',
          alternates: expectedFooAlternates,
        },
      ];
      console.log(result)
      expect(result).toEqual(expected);
    });
  });
});
