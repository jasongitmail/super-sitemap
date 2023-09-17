export type ParamValues = Record<string, string[]> | Record<string, never>;
export type Changefreq = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
export type Priority = 0.0 | 0.1 | 0.2 | 0.3 | 0.4 | 0.5 | 0.6 | 0.7 | 0.8 | 0.9 | 1.0;
export type Config = {
  excludePatterns?: [] | string[];
  headers?: Record<string, string>;
  paramValues?: ParamValues;
  origin: string;
  additionalPaths?: string[];
  changefreq?: false | Changefreq;
  priority?: false | Priority
}

/**
 * Generates an HTTP response containing an XML sitemap.
 *
 * @public
 * @remarks Default headers set 1h CDN cache & no browser cache.
 *
 * @param options - Configuration options.
 * @param options.origin - The origin URL. E.g. `https://example.com`. No
 * trailing slash.
 * @param options.excludePatterns - Optional. An array of regex patterns to
 *                                  exclude from paths.
 * @param options.paramValues - Optional. An object mapping parameters to their
 *                              values.
 * @param options.customHeaders - Optional. Custom headers to override defaults.
 * @param options.additionalPaths - Optional. Array of additional paths to
 *                                  include, such as individual files in the
 *                                  project's static dir.
 * @returns An HTTP response containing the generated XML sitemap.
 */
export async function response({
  excludePatterns,
  headers = {},
  paramValues,
  origin,
  additionalPaths = [],
  changefreq = false,
  priority = false,
}: Config): Promise<Response> {
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

export function generateBody(origin: string, paths: Set<string>, changefreq: Changefreq, priority: Priority): string {
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
      (path: string) => `
  <url>
    <loc>${origin}${path}</loc>\n` +
(changefreq ? `    <changefreq>${changefreq}</changefreq>\n` : '') +
(priority   ? `    <priority>${priority}</priority>\n` : '') +
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
  [routes, parameterizedPaths] = buildParameterizedPaths(routes, paramValues);

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
 * `/blog/hello-world`) and then remove the respective tokenized route
 * (`/blog/[slug]`) from the routes array.
 *
 * @public
 *
 * @param routes - An array of route strings, including parameterized routes
 *                 E.g. ['/', '/about', '/blog/[slug]', /blog/tags/[tag]']
 * @param paramValues - An object mapping parameterized routes to an array of
 *                      their parameter values.
 *
 * @returns A tuple where the first element is an array of routes and the second
 *          element is an array of generated parameterized paths.
 *
 * @throws Will throw an error if a `paramValues` key doesn't correspond to an
 *         existing route, for visibility to the developer.
 * @throws Will throw an error if a parameterized route does not have data
 *         within paramValues, for visibility to the developer.
 */

export function buildParameterizedPaths(
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

    // Generate paths using data from paramValues–e.g. `/blog/hello-world`
    parameterizedPaths.push(...paramValues[route].map((value) => route.replace(/\[.*\]/, value)));

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
