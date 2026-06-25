import { createFileRoute } from '@tanstack/react-router';
import { response } from 'super-sitemap/tanstack-start';

import * as blog from '../../lib/data/blog';
import { getRouter } from '../../router';

// Example route to serve /sitemap.xml and paginated sitemap files like /sitemap1.xml.
export const Route = createFileRoute('/(public)/sitemap{-$page}.xml')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        // Example data load for parameterized routes.
        const [slugs, tags] = await Promise.all([blog.getSlugs(), blog.getTags()]);

        return response({
          additionalPaths: ['/foo.pdf'], // e.g. a file in the `public` dir
          excludeRoutePatterns: [
            /^\/dashboard(?:$|\/)/, // `/dashboard` and children
            /\/to-exclude(?:$|\/)/, // `to-exclude` segment
            /\/landing-page-draft$/, // a draft route
            /\/page\/\$page$/, // page routes
          ],
          origin: 'https://example.com',
          page: params.page,
          paramValues: {
            '/{-$locale}/$foo': ['foo-path-1'],
            '/{-$locale}/optionals/{-$optional}': ['optional-1', 'optional-2'],
            '/{-$locale}/optionals/many/{-$paramA}': ['data-a1', 'data-a2'],
            '/{-$locale}/optionals/many/{-$paramA}/foo': ['data-a1', 'data-a2'],
            '/{-$locale}/optionals/many/{-$paramA}/{-$paramB}/foo': [
              ['data-a1', 'data-b1'],
              ['data-a2', 'data-b2'],
            ],
            '/{-$locale}/blog/$slug': slugs,
            '/{-$locale}/blog/tag/$tag': tags,
            '/{-$locale}/campsites/$country/$state': [
              {
                values: ['usa', 'new-york'],
                lastmod: '2025-01-01T00:00:00Z',
                changefreq: 'daily',
                priority: 0.5,
              },
              {
                values: ['usa', 'california'],
                lastmod: '2025-01-05',
                changefreq: 'daily',
                priority: 0.4,
              },
            ],
          },
          defaultPriority: 0.7,
          defaultChangefreq: 'daily',
          sort: 'alpha',
          locales: {
            default: 'en',
            alternates: ['zh'],
          },
          router: getRouter,
        });
      },
    },
  },
});
