import type { RequestHandler } from '@sveltejs/kit';

import * as blog from '$lib/data/blog.js';
import { error } from '@sveltejs/kit';

import * as sitemap from 'super-sitemap/sveltekit';

// Example route to serve /sitemap.xml and paginated sitemap files.
export const GET: RequestHandler = async ({ params }) => {
  // Example data load for parameterized routes.
  let slugs, tags;
  try {
    [slugs, tags] = await Promise.all([blog.getSlugs(), blog.getTags()]);
  } catch (err) {
    throw error(500, 'Could not load paths');
  }

  return await sitemap.response({
    additionalPaths: ['/foo.pdf'], // e.g. a file in the `static` dir
    excludeRoutePatterns: [
      /dashboard/,
      /to-exclude/,
      /^\/\[\[locale\]\]\/landing-page-draft$/,

      /\[page=integer\]/,
    ],
    origin: 'https://example.com',
    page: params.page,

    paramValues: {
      '/[[locale]]/[foo]': ['foo-path-1'],
      '/[[locale]]/optionals/[[optional]]': ['optional-1', 'optional-2'],
      '/[[locale]]/optionals/many/[[paramA]]': ['data-a1', 'data-a2'],
      '/[[locale]]/optionals/many/[[paramA]]/[[paramB]]': [
        ['data-a1', 'data-b1'],
        ['data-a2', 'data-b2'],
      ],
      '/[[locale]]/optionals/many/[[paramA]]/[[paramB]]/foo': [
        ['data-a1', 'data-b1'],
        ['data-a2', 'data-b2'],
      ],
      '/[[locale]]/blog/[slug]': slugs,
      '/[[locale]]/blog/tag/[tag]': tags,
      '/[[locale]]/campsites/[country]/[state]': [
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
  });
};
