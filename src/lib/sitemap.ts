export type ParamValues = Record<string, string[] | string[][] | never>;

// Don't use named types on properties, like ParamValues, because it's more
// helpful for the dev to see these allowed values in their IDE.
export type SitemapConfig = {
  excludePatterns?: string[] | [];
  headers?: Record<string, string>;
  paramValues?: Record<string, string[] | string[][] | never>;
  origin: string;
  additionalPaths?: string[] | [];
  changefreq?: false | 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: false | 0.0 | 0.1 | 0.2 | 0.3 | 0.4 | 0.5 | 0.6 | 0.7 | 0.8 | 0.9 | 1.0;
};

/**
 * Generates an HTTP response containing an XML sitemap.
 *
 * @public
 * @remarks Default headers set 1h CDN cache & no browser cache.
 *
 * @param config - Config object.
 * @param config.origin - Required. Origin URL. E.g. `https://example.com`. No trailing slash
 * @param config.excludePatterns - Optional. Array of regex patterns for paths to exclude.
 * @param config.paramValues - Optional. Object of parameter values. See format in example below.
 * @param config.additionalPaths - Optional. Array of paths to include manually. E.g. `/foo.pdf` in your `static` directory.
 * @param config.headers - Optional. Custom headers. Case insensitive.
 * @returns An HTTP response containing the generated XML sitemap.
 *
 * @example
 *
 * ```js
 * return await sitemap.response({
 *   origin: 'https://example.com',
 *   excludePatterns: [
 *     '^/dashboard.*',
 *     `.*\\[page=integer\\].*`
 *   ],
 *   paramValues: {
 *     '/blog/[slug]': ['hello-world', 'another-post']   // preferred
 *     '/blog/tag/[tag]': [['red'], ['blue'], ['green']] // valid
 *     '/campsites/[country]/[state]': [ // preferred; unlimited params supported
 *       ['usa', 'new-york'],
 *       ['usa', 'california'],
 *       ['canada', 'toronto']
 *     ]
 *   },
 *   additionalPaths: ['/foo.pdf'],
 *   headers: {
 *    'Custom-Header': 'mars'
 *   }
 * });
 * ```
 */
export async function response({
  excludePatterns,
  headers = {},
  paramValues,
  origin,
  additionalPaths = [],
  changefreq = false,
  priority = false
}: SitemapConfig): Promise<Response> {
  // 500. Value will often be from env.origin, which is easily misconfigured.
  if (!origin) {
    throw new Error('Sitemap: `origin` property is required in sitemap config.');
  }

  const paths = generatePaths(excludePatterns, paramValues);
  const body = generateBody(origin, new Set([...paths, ...additionalPaths]), changefreq, priority);

  // Merge keys case-insensitive
  const _headers = {
    'cache-control': 'max-age=0, s-maxage=3600', // 1h CDN cache
    'content-type': 'application/xml',
    ...Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]))
  };

  return new Response(body, { headers: _headers });
}

/**
 * Generates an XML response body based on the provided paths, using sitemap
 * structure from https://kit.svelte.dev/docs/seo#manual-setup-sitemaps.
 *
 * @private
 * @remarks
 * - Based on structure specified by
 *   https://kit.svelte.dev/docs/seo#manual-setup-sitemaps
 * - Google ignores changefreq and priority, so this uses default values for
 *   those to appease dumb bots.
 * - We could consider adding `<lastmod>` with an ISO 8601 datetime, but not
 *   worrying about this for now.
 *   https://developers.google.com/search/blog/2014/10/best-practices-for-xml-sitemaps-rssatom
 *
 * @param origin - The origin URL. E.g. `https://example.com`. No trailing slash
 *                 because "/" is the index page.
 * @param paths - Array of string paths to include in the sitemap. Each should
 *                start with '/'; but if not, it will be added.
 * @returns The generated XML sitemap.
 */

export function generateBody(
  origin: string,
  paths: Set<string>,
  changefreq: SitemapConfig['changefreq'] = false,
  priority: SitemapConfig['priority'] = false
): string {
  const normalizedPaths = Array.from(paths).map((path) => (path[0] !== '/' ? `/${path}` : path));

  return `<?xml version="1.0" encoding="UTF-8" ?>
<urlset
  xmlns="https://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:news="https://www.google.com/schemas/sitemap-news/0.9"
  xmlns:xhtml="https://www.w3.org/1999/xhtml"
  xmlns:mobile="https://www.google.com/schemas/sitemap-mobile/1.0"
  xmlns:image="https://www.google.com/schemas/sitemap-image/1.1"
  xmlns:video="https://www.google.com/schemas/sitemap-video/1.1"
>${normalizedPaths
    .map(
      (path: string) =>
        `
  <url>
    <loc>${origin}${path}</loc>\n` +
        (changefreq ? `    <changefreq>${changefreq}</changefreq>\n` : '') +
        (priority ? `    <priority>${priority}</priority>\n` : '') +
        `  </url>`
    )
    .join('')}
</urlset>`;
}

/**
 * Generates an array of route paths to be included in a sitemap.
 *
 * @public
 *
 * @param excludePatterns - Optional. An array of patterns for routes to be
 *                          excluded.
 * @param paramValues - Optional. An object mapping each parameterized route to
 *                      an array of param values for that route.
 * @returns An array of strings, each representing a path for the sitemap.
 */
export function generatePaths(
  excludePatterns: string[] = [],
  paramValues: ParamValues = {}
): string[] {
  let routes = Object.keys(import.meta.glob('/src/routes/**/+page.svelte'));
  routes = filterRoutes(routes, excludePatterns);

  let parameterizedPaths = [];
  [routes, parameterizedPaths] = buildMultiParamPaths(routes, paramValues);

  return [...routes, ...parameterizedPaths];
}

/**
 * Filters and normalizes an array of route paths.
 *
 * @public
 *
 * @param routes - An array of route strings from Vite's `import.meta.blog`.
 *                 E.g. ['src/routes/blog/[slug]/+page.svelte', ...]
 * @param excludePatterns - An array of regular expression patterns to match
 *                          routes to exclude.
 * @returns A sorted array of cleaned-up route strings.
 *          E.g. ['/blog/[slug]', ...]
 *
 * @remarks
 * - Removes trailing slashes from routes, except for the homepage route. If
 *   SvelteKit specified this option in a config, rather than layouts, we could
 *   read the user's preference, but it doesn't, we use SvelteKit's default no
 *   trailing slash https://kit.svelte.dev/docs/page-options#trailingslash
 */

export function filterRoutes(routes: string[], excludePatterns: string[]): string[] {
  return (
    routes
      // remove `/src/routes` prefix and `+page.svelte suffix`
      .map((x) => x.substring(11, x.length - 12))

      // remove any routes that match an exclude pattern--e.g. `(dashboard)`
      .filter((x) => !excludePatterns.some((pattern) => new RegExp(pattern).test(x)))

      // remove `/(groups)` because decorative only
      .map((x) => x.replaceAll(/\/\(\w+\)/g, ''))

      // remove trailing "/" except from the homepage
      .map((x) => (x !== '/' && x.endsWith('/') ? x.slice(0, -1) : x))

      .sort()
  );
}

/**
 * Builds parameterized paths using paramValues provided (e.g.
 * `/blog/hello-world`) and then removes the respective tokenized route (e.g.
 * `/blog/[slug]`) from the routes array.
 *
 * @public
 *
 * @param routes - An array of route strings, including parameterized routes
 *                 E.g. ['/', '/about', '/blog/[slug]', /blog/tags/[tag]']
 * @param paramValues - An object mapping parameterized routes to a 1D or 2D
 *                      array of their parameter's values. E.g.
 *                      {
 *                        '/blog/[slug]': ['hello-world', 'another-post']
 *                        '/campsites/[country]/[state]': [
 *                          ['usa','miami'],
 *                          ['usa','new-york'],
 *                          ['canada','toronto']
 *                        ]
 *                      }
 *
 * @returns A tuple where the first element is an array of routes and the second
 *          element is an array of generated parameterized paths.
 *
 * @throws Will throw an error if a `paramValues` key doesn't correspond to an
 *         existing route, for visibility to the developer.
 * @throws Will throw an error if a parameterized route does not have data
 *         within paramValues, for visibility to the developer.
 */
export function buildMultiParamPaths(
  routes: string[],
  paramValues: ParamValues
): [string[], string[]] {
  const parameterizedPaths = [];

  for (const route in paramValues) {
    if (!routes.includes(route)) {
      throw new Error(
        `Sitemap: '${route}' was provided as a property in your sitemap's paramValues, but does not exist as a route within your project's 'src/routes/'. Remove this property from paramValues.`
      );
    }

    // First, determine if this is a 1D array, which we allow as a user convenience.
    // If the first item is an array, then it's a 2D array.
    if (Array.isArray(paramValues[route][0])) {
      // 2D array of one or more elements each.
      // - e.g. [['usa','miami'], ['usa','new-york'], ['canada, toronto']]
      // - e.g. [['hello-world'], ['another-post'], ['post3']] (also valid to offer flexibility)
      parameterizedPaths.push(
        // Given all data for this route, loop over and generate a path for each.
        // `paramValues[route]` is all data for all paths for this route.
        ...paramValues[route].map((data) => {
          let i = 0;
          return route.replace(/\[[^\]]+\]/g, () => data[i++] || '');
        })
      );
    } else {
      // 1D array of one or more elements.
      // - e.g. ['hello-world', 'another-post', 'post3']
      // Generate paths using data from paramValues–e.g. `/blog/hello-world`
      parameterizedPaths.push(
        // @ts-expect-error for map, we know this is a 1D array
        ...paramValues[route].map((value: string) => route.replace(/\[.*\]/, value))
      );
    }

    // Remove route containing the token placeholder–e.g. `/blog/[slug]`
    routes.splice(routes.indexOf(route), 1);
  }

  // Throw error if app contains any parameterized routes NOT handled in the
  // sitemap, to alert the developer. Prevents accidental omission of any paths.
  for (const route of routes) {
    const regex = /.*\[[^\]]+\].*/;
    if (regex.test(route)) {
      throw new Error(
        `Sitemap: Parameterized route was not handled: '${route}'\nUpdate your sitemap's excludedPatterns to exclude this route OR add data for this route's param to the paramValues object within your sitemap.`
      );
    }
  }

  return [routes, parameterizedPaths];
}
