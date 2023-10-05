import * as sitemap from '$lib/sitemap'; // Import from 'super-sitemap' in your app
import type { RequestHandler } from '@sveltejs/kit';

import * as blog from '$lib/data/blog';
import { error } from '@sveltejs/kit';

// - Use prerender if you only have static routes or the data for your
//   parameterized routes does not change between your builds builds. Otherwise,
//   disabling prerendering will allow your database that generate param values
//   to be executed when a user request to the sitemap does not hit cache.
// - When prerendering is set to true, using `npm run preview` serves an
//   `text/html` content type because it's up to the server to decide what mime
//   type to use. But in production, Cloudflare Pages is smart and automatically
//   uses `application/xml` when serving your prerendered sitemap. Other hosts
//   should as well. https://github.com/sveltejs/kit/issues/9408
export const prerender = true;

export const GET: RequestHandler = async () => {
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
      '^/dashboard.*',

      // Exclude routes containing `[page=integer]`–e.g. `/blog/2`
      `.*\\[page=integer\\].*`
    ],
    origin: 'https://example.com',
    paramValues: {
      '/[foo]': ['foo-path-1'],
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
