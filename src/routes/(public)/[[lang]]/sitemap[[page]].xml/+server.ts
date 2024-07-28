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
    additionalPaths: ['/foo.pdf'], // e.g. a file in the `static` dir
    excludePatterns: [
      '/dashboard.*',
      '/to-exclude',
      '(secret-group)',

      // Exclude routes containing `[page=integer]`–e.g. `/blog/2`
      `.*\\[page=integer\\].*`,
    ],
    // maxPerPage: 20,
    origin: 'https://example.com',
    page: params.page,

    /* eslint-disable perfectionist/sort-objects */
    paramValues: {
      '/[[lang]]/[foo]': ['foo-path-1'],
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
      '/[[lang]]/blog/[slug]': slugs,
      '/[[lang]]/blog/tag/[tag]': tags,
      '/[[lang]]/campsites/[country]/[state]': [
        ['usa', 'new-york'],
        ['usa', 'california'],
        ['canada', 'toronto'],
      ],
    },

    priority: 0.7,
    changefreq: 'daily',
    sort: 'alpha', // helps predictability of test data
    lang: {
      default: 'en',
      alternates: ['zh'],
    },
    processPaths: (paths: sitemap.PathObj[]) => {
      // Add trailing slashes. (In reality, using no trailing slash is
      // preferrable b/c it provides consistency among all possible paths, even
      // items like `/foo.pdf`; this is merely intended to test the
      // `processPaths()` callback.)
      return paths.map(({ path, alternates, ...rest }) => {
        const rtrn = { path: `${path}/`, ...rest };

        if (alternates) {
          rtrn.alternates = alternates.map((alternate: sitemap.Alternate) => ({
            ...alternate,
            path: `${alternate.path}/`,
          }));
        }

        return rtrn;
      });
    },
  });
};
