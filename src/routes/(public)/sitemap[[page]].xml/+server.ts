import * as sitemap from '$lib/sitemap'; // Import from 'super-sitemap' in your app
import type { RequestHandler } from '@sveltejs/kit';

import * as blog from '$lib/data/blog';
import { error } from '@sveltejs/kit';

// - Use prerender if you only have static routes or the data for your
//   parameterized routes does not change between your builds builds. Otherwise,
//   disabling prerendering will allow your database that generate param values
//   to be executed when a user request to the sitemap does not hit cache.
// export const prerender = true;

export const GET: RequestHandler = async ({ params }) => {
  // Get data for parameterized routes
  let slugs, tags;
  try {
    [slugs, tags] = await Promise.all([blog.getSlugs(), blog.getTags()]);
  } catch (err) {
    throw error(500, 'Could not load paths');
  }

  return await sitemap.response({
    additionalPaths: ['/foo.pdf'], // e.g. file in `static` dir
    excludePatterns: [
      '.*/dashboard.*',
      '.*/to-exclude/\\[\\[optional\\]\\]',
      '.*(secret-group).*',

      // Exclude routes containing `[page=integer]`–e.g. `/blog/2`
      `.*\\[page=integer\\].*`
    ],
    maxPerPage: 6,
    origin: 'https://example.com',
    page: params.page,

    /* eslint-disable perfectionist/sort-objects */
    paramValues: {
      '/[foo]': ['foo-path-1'],
      '/optionals/[[optional]]': ['optional-1', 'optional-2'],
      '/blog/[slug]': slugs,
      '/blog/tag/[tag]': tags,
      '/campsites/[country]/[state]': [
        ['usa', 'new-york'],
        ['usa', 'california'],
        ['canada', 'toronto']
      ]
    }
  });
};
