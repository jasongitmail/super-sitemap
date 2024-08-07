export type ParamValues = Record<string, never | string[] | string[][]>;

// Don't use named types on properties, like ParamValues, because it's more
// helpful for the dev to see these allowed values in their IDE.
/* eslint-disable perfectionist/sort-object-types */
export type SitemapConfig = {
  additionalPaths?: [] | string[];
  changefreq?: 'always' | 'daily' | 'hourly' | 'monthly' | 'never' | 'weekly' | 'yearly' | false;
  excludeRoutePatterns?: [] | string[];
  headers?: Record<string, string>;
  lang?: {
    default: string;
    alternates: string[];
  };
  maxPerPage?: number;
  origin: string;
  page?: string;
  paramValues?: Record<string, never | string[] | string[][]>;
  priority?: 0.0 | 0.1 | 0.2 | 0.3 | 0.4 | 0.5 | 0.6 | 0.7 | 0.8 | 0.9 | 1.0 | false;
  processPaths?: (paths: PathObj[]) => PathObj[];
  sort?: 'alpha' | false;
};

export type LangConfig = {
  default: string;
  alternates: string[];
};

export type Alternate = {
  lang: string;
  path: string;
};

export type PathObj = {
  path: string;
  alternates?: Alternate[];
};

const langRegex = /\/?\[(\[lang(=[a-z]+)?\]|lang(=[a-z]+)?)\]/;
const langRegexNoPath = /\[(\[lang(=[a-z]+)?\]|lang(=[a-z]+)?)\]/;

/**
 * Generates an HTTP response containing an XML sitemap.
 *
 * @public
 * @remarks Default headers set 1h CDN cache & no browser cache.
 *
 * @param config - Config object.
 * @param config.origin - Required. Origin URL. E.g. `https://example.com`. No trailing slash
 * @param config.excludeRoutePatterns - Optional. Array of regex patterns for routes to exclude.
 * @param config.paramValues - Optional. Object of parameter values. See format in example below.
 * @param config.additionalPaths - Optional. Array of paths to include manually. E.g. `/foo.pdf` in your `static` directory.
 * @param config.headers - Optional. Custom headers. Case insensitive.
 * @param config.changefreq - Optional. `changefreq` value to use for all paths. Default is `false` to exclude this property from each sitemap entry.
 * @param config.priority - Optional. `priority` value to use for all paths. Default is `false` to exclude this property from each sitemap entry.
 * @param config.processPaths - Optional. Callback function to arbitrarily process path objects.
 * @param config.sort - Optional. Default is `false` and groups paths as static paths (sorted), dynamic paths (unsorted), and then additional paths (unsorted). `alpha` sorts all paths alphabetically.
 * @param config.maxPerPage - Optional. Default is `50_000`, as specified in https://www.sitemaps.org/protocol.html If you have more than this, a sitemap index will be created automatically.
 * @param config.page - Optional, but when using a route like `sitemap[[page]].xml to support automatic sitemap indexes. The `page` URL param.
 * @returns An HTTP response containing the generated XML sitemap.
 *
 * @example
 *
 * ```js
 * return await sitemap.response({
 *   origin: 'https://example.com',
 *   excludeRoutePatterns: [
 *     '^/dashboard.*',
 *     `.*\\[page=integer\\].*`
 *   ],
 *   paramValues: {
 *     '/blog/[slug]': ['hello-world', 'another-post']
 *     '/campsites/[country]/[state]': [
 *       ['usa', 'new-york'],
 *       ['usa', 'california'],
 *       ['canada', 'toronto']
 *     ]
 *   },
 *   additionalPaths: ['/foo.pdf'],
 *   headers: {
 *    'Custom-Header': 'blazing-fast'
 *   },
 *   changefreq: 'daily',
 *   priority: 0.7,
 *   sort: 'alpha'
 * });
 * ```
 */
export async function response({
  additionalPaths = [],
  changefreq = false,
  excludeRoutePatterns,
  headers = {},
  lang,
  maxPerPage = 50_000,
  origin,
  page,
  paramValues,
  priority = false,
  processPaths,
  sort = false,
}: SitemapConfig): Promise<Response> {
  // Cause a 500 error for visibility
  if (!origin) {
    throw new Error('Sitemap: `origin` property is required in sitemap config.');
  }

  let paths = [
    ...generatePaths(excludeRoutePatterns, paramValues, lang),
    ...normalizeAdditionalPaths(additionalPaths),
  ];

  if (processPaths) {
    paths = processPaths(paths);
  }

  paths = deduplicatePaths(paths);

  if (sort === 'alpha') {
    paths.sort((a, b) => a.path.localeCompare(b.path));
  }

  const totalPages = Math.ceil(paths.length / maxPerPage);

  let body: string;
  if (!page) {
    // User is visiting `/sitemap.xml` or `/sitemap[[page]].xml` without page.
    if (paths.length <= maxPerPage) {
      body = generateBody(origin, paths, changefreq, priority);
    } else {
      body = generateSitemapIndex(origin, totalPages);
    }
  } else {
    // User is visiting a sitemap index's subpage–e.g. `sitemap[[page]].xml`.

    // Ensure `page` param is numeric. We do it this way to avoid needing to
    // instruct devs to create a route matcher, to ease set up for best DX.
    if (!/^[1-9]\d*$/.test(page)) {
      return new Response('Invalid page param', { status: 400 });
    }

    const pageInt = Number(page);
    if (pageInt > totalPages) {
      return new Response('Page does not exist', { status: 404 });
    }

    const pathsOnThisPage = paths.slice((pageInt - 1) * maxPerPage, pageInt * maxPerPage);
    body = generateBody(origin, pathsOnThisPage, changefreq, priority);
  }

  // Merge keys case-insensitive; custom headers take precedence over defaults.
  const newHeaders = {
    'cache-control': 'max-age=0, s-maxage=3600', // 1h CDN cache
    'content-type': 'application/xml',
    ...Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
    ),
  };

  return new Response(body, { headers: newHeaders });
}

/**
 * Generates an XML response body based on the provided paths, using sitemap
 * structure from https://kit.svelte.dev/docs/seo#manual-setup-sitemaps.
 *
 * @private
 * @remarks
 * - Based on https://kit.svelte.dev/docs/seo#manual-setup-sitemaps
 * - Google ignores changefreq and priority, but we support these optionally.
 * - TODO We could consider adding `<lastmod>` with an ISO 8601 datetime, but
 *   not worrying about this for now.
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
  paths: PathObj[],
  changefreq: SitemapConfig['changefreq'] = false,
  priority: SitemapConfig['priority'] = false
): string {
  return `<?xml version="1.0" encoding="UTF-8" ?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
>${paths
    .map(
      ({ alternates, path }) =>
        `
  <url>
    <loc>${origin}${path}</loc>\n` +
        (changefreq ? `    <changefreq>${changefreq}</changefreq>\n` : '') +
        (priority ? `    <priority>${priority}</priority>\n` : '') +
        (!alternates
          ? ''
          : alternates
              .map(
                ({ lang, path }) =>
                  `    <xhtml:link rel="alternate" hreflang="${lang}" href="${origin}${path}" />`
              )
              .join('\n') + '\n') +
        `  </url>`
    )
    .join('')}
</urlset>`;
}

/**
 * Generates a sitemap index XML string.
 *
 * @private
 * @param origin - The origin URL. E.g. `https://example.com`. No trailing slash.
 * @param pages - The number of sitemap pages to include in the index.
 * @returns The generated XML sitemap index.
 */
export function generateSitemapIndex(origin: string, pages: number): string {
  let str = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  for (let i = 1; i <= pages; i++) {
    str += `
  <sitemap>
    <loc>${origin}/sitemap${i}.xml</loc>
  </sitemap>`;
  }
  str += `
</sitemapindex>`;

  return str;
}

/**
 * Generates an array of paths, based on `src/routes`, to be included in a
 * sitemap.
 *
 * @public
 *
 * @param excludeRoutePatterns - Optional. An array of patterns for routes to be excluded.
 * @param paramValues - Optional. An object mapping each parameterized route to
 *                      an array of param values for that route.
 * @param lang - Optional. The language configuration.
 * @returns An array of strings, each representing a path for the sitemap.
 */
export function generatePaths(
  excludeRoutePatterns: string[] = [],
  paramValues: ParamValues = {},
  lang: LangConfig = { alternates: [], default: '' }
): PathObj[] {
  // Match +page.svelte, +page@.svelte, +page@foo.svelte, +page@[id].svelte, and +page@(id).svelte
  // - See: https://kit.svelte.dev/docs/advanced-routing#advanced-layouts-breaking-out-of-layouts
  // - The `.md` and `.svx` extensions are to support MDSveX, which is a common
  //   markdown preprocessor for SvelteKit.
  const svelteRoutes = Object.keys(import.meta.glob('/src/routes/**/+page*.svelte'));
  const mdRoutes = Object.keys(import.meta.glob('/src/routes/**/+page*.md'));
  const svxRoutes = Object.keys(import.meta.glob('/src/routes/**/+page*.svx'));
  let routes = [...svelteRoutes, ...mdRoutes, ...svxRoutes];

  // Validation: if dev has one or more routes that contain a lang parameter,
  // optional or required, require that they have defined the `lang.default` and
  // `lang.alternates` in their config or throw an error to cause a 500 error
  // for visibility.
  let routesContainLangParam = false;

  for (const route of routes) {
    if (route.match(langRegex)?.length) {
      routesContainLangParam = true;
      break;
    }
  }
  if (routesContainLangParam && (!lang?.default || !lang?.alternates.length)) {
    throw Error(
      'Must specify `lang` property within the sitemap config because one or more routes contain [[lang]].'
    );
  }

  // Notice this means devs MUST include `[[lang]]/` within any route strings
  // used within `excludeRoutePatterns` if that's part of their route.
  routes = filterRoutes(routes, excludeRoutePatterns);

  routes = processRoutesForOptionalParams(routes);

  const { pathsWithLang, pathsWithoutLang } = generatePathsWithParamValues(routes, paramValues);

  return [
    ...pathsWithoutLang.map((path) => ({ path } as PathObj)),
    ...(pathsWithLang.length ? generatePathsWithLang(pathsWithLang, lang) : []),
  ];
}

/**
 * Filters and normalizes an array of route paths.
 *
 * @public
 *
 * @param routes - An array of route strings from Vite's `import.meta.blog`.
 *                 E.g. ['src/routes/blog/[slug]/+page.svelte', ...]
 * @param excludeRoutePatterns - An array of regular expression patterns to match
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
export function filterRoutes(routes: string[], excludeRoutePatterns: string[]): string[] {
  return (
    routes
      // Remove `/src/routes` prefix, `+page.svelte suffix` or any variation
      // like `+page@.svelte`, and trailing slash except on homepage. Trailing
      // slash must be removed before excludeRoutePatterns so `$` termination of a
      // regex pattern will work as expected.
      .map((x) => {
        // Don't trim initial '/' yet, b/c a developer's excludeRoutePatterns may start with it.
        x = x.substring(11);
        x = x.replace(/\/\+page.*\.(svelte|md|svx)$/, '');
        return !x ? '/' : x;
      })

      // Remove any routes that match an exclude pattern
      .filter((x) => !excludeRoutePatterns.some((pattern) => new RegExp(pattern).test(x)))

      // Remove initial `/` now and any `/(groups)`, because decorative only.
      // Must follow excludeRoutePatterns. Ensure index page is '/' in case it was
      // part of a group. The pattern to match the group is from
      // https://github.com/sveltejs/kit/blob/99cddbfdb2332111d348043476462f5356a23660/packages/kit/src/utils/routing.js#L119
      .map((x) => {
        x = x.replaceAll(/\/\([^)]+\)/g, '');
        return !x ? '/' : x;
      })

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
export function generatePathsWithParamValues(
  routes: string[],
  paramValues: ParamValues
): { pathsWithLang: string[]; pathsWithoutLang: string[] } {
  // check for superfluous paramValues
  for (const paramValueKey in paramValues) {
    if (!routes.includes(paramValueKey)) {
      throw new Error(
        `Sitemap: paramValues were provided for a route that does not exists within src/routes/: '${paramValueKey}'. Remove this property from your paramValues.`
      );
    }
  }

  let pathsWithLang = [];
  let pathsWithoutLang = [];

  for (const paramValuesKey in paramValues) {
    const hasLang = langRegex.exec(paramValuesKey);
    const routeSansLang = paramValuesKey.replace(langRegex, '');

    const paths = [];

    if (Array.isArray(paramValues[paramValuesKey][0])) {
      // First, determine if this is a 1D array, which we allow as a user convenience.
      // If the first item is an array, then it's a 2D array.
      // 2D array of one or more elements each.
      // - e.g. [['usa','miami'], ['usa','new-york'], ['canada, toronto']]
      // - e.g. [['hello-world'], ['another-post'], ['post3']] (also valid to offer flexibility)
      paths.push(
        // Given all data for this route, loop over and generate a path for each.
        // `paramValues[route]` is all data for all paths for this route.
        ...paramValues[paramValuesKey].map((data) => {
          let i = 0;
          // Replace every [[foo]] or [foo] with a value from the array.
          return routeSansLang.replace(/(\[\[.+?\]\]|\[.+?\])/g, () => data[i++] || '');
        })
      );
    } else {
      // 1D array of one or more elements.
      // - e.g. ['hello-world', 'another-post', 'post3']
      // Generate paths using data from paramValues–e.g. `/blog/hello-world`
      paths.push(
        // @ts-expect-error for map, we know this is a 1D array
        ...paramValues[paramValuesKey].map((value: string) =>
          routeSansLang.replace(/\[.*\]/, value)
        )
      );
    }

    if (hasLang) {
      const lang = hasLang?.[0];
      pathsWithLang.push(
        ...paths.map((path) => path.slice(0, hasLang?.index) + lang + path.slice(hasLang?.index))
      );
    } else {
      pathsWithoutLang.push(...paths);
    }

    // Remove this from routes
    routes.splice(routes.indexOf(paramValuesKey), 1);
  }

  // Handle "static" routes (i.e. /foo, /[[lang]]/bar, etc). Will not have any
  // parameters other than exactly [[lang]].
  const staticWithLang = [];
  const staticWithoutLang = [];
  for (const route of routes) {
    const hasLang = route.match(langRegex);
    if (hasLang) {
      // "or" needed because otherwise root becomes empty string
      staticWithLang.push(route);
    } else {
      staticWithoutLang.push(route);
    }
  }

  // This just keeps static paths first, which I prefer.
  pathsWithLang = [...staticWithLang, ...pathsWithLang];
  pathsWithoutLang = [...staticWithoutLang, ...pathsWithoutLang];

  // Check for missing paramValues.
  // Throw error if app contains any parameterized routes NOT handled in the
  // sitemap, to alert the developer. Prevents accidental omission of any paths.
  for (const route of routes) {
    // Check whether any instance of [foo] or [[foo]] exists
    const regex = /.*(\[\[.+\]\]|\[.+\]).*/;
    const routeSansLang = route.replace(langRegex, '') || '/';
    if (regex.test(routeSansLang)) {
      throw new Error(
        `Sitemap: paramValues not provided for: '${route}'\nUpdate your sitemap's excludedRoutePatterns to exclude this route OR add data for this route's param(s) to the paramValues object of your sitemap config.`
      );
    }
  }

  return { pathsWithLang, pathsWithoutLang };
}

/**
 * Given all routes, return a new array of routes that includes all versions of
 * any route that contains one or more optional params. Only process routes that
 * contain an optional param _other than_ `[[lang]]`.
 *
 * @private
 * @param routes - Array of routes to process.
 * @returns Array of routes containing all version for those with optional
 * params.
 */
export function processRoutesForOptionalParams(routes: string[]): string[] {
  routes = routes.flatMap((route) => {
    const routeWithoutLangIfAny = route.replace(langRegex, '');
    return /\[\[.*\]\]/.test(routeWithoutLangIfAny) ? processOptionalParams(route) : route;
  });

  // Ensure no duplicates exist after processing
  return Array.from(new Set(routes));
}

/**
 * Processes a route containing >=1 optional parameters, represented by double
 * square brackets. It generates all possible versions of this route that
 * SvelteKit considers valid. Notice we add `+/page.svelte`, that is so these
 * routes have a consistent pattern as others so that `filterRoutes()` will
 * apply consistently when called later.
 *
 * @private
 * @param route - Route to process. E.g. `/foo/[[paramA]]`
 * @returns An array of routes. E.g. [`/foo`, `/foo/[[paramA]]`]
 */
export function processOptionalParams(route: string): string[] {
  // Remove lang to simplify
  const hasLang = langRegex.exec(route);

  if (hasLang) {
    route = route.replace(langRegex, '');
  }

  let results: string[] = [];

  // Get path up _before_ the first optional param; use `i-1` to exclude
  // trailing slash after this. This is our first result.
  results.push(route.slice(0, route.indexOf('[[') - 1));

  // Get remainder of the string without the first result.
  const remaining = route.slice(route.indexOf('[['));

  // Split and filter to remove first empty item because str will start with a '/'.
  const segments = remaining.split('/').filter(Boolean);

  let j = 1;
  for (const segment of segments) {
    // start a new potential result
    if (!results[j]) results[j] = results[j - 1];

    results[j] += '/' + segment;

    if (segment.startsWith('[[')) {
      j++;
    }
  }

  // Re-add lang to all results.
  if (hasLang) {
    const lang = hasLang?.[0];
    results = results.map(
      (result) => result.slice(0, hasLang?.index) + lang + result.slice(hasLang?.index)
    );
  }

  // If first segment is optional param other than `/[[lang]]` (e.g. /[[foo]])),
  // ensure we have '/' as the first result. Otherwise it'll be empty.
  if (!results[0].length) results[0] = '/';

  return results;
}

/**
 * Generate path objects with language variations.
 * @param paths - An array of paths.
 * @param langConfig - The language configuration.
 * @returns An array of path objects.
 */
export function generatePathsWithLang(paths: string[], langConfig: LangConfig): PathObj[] {
  const allPathObjs = [];

  for (const path of paths) {
    // The Sitemap standard specifies for hreflang elements to include 1.) the
    // current path itself, and 2.) all of its alternates. So all versions of
    // this path will be given the same "variations" array that will be used to
    // build hreflang items for the path.
    // https://developers.google.com/search/blog/2012/05/multilingual-and-multinational-site

    // - If the lang param is required (i.e. `[lang]`), all variations of this
    //   path must include the lang param within the path.
    // - If the lang param is optional (i.e. `[[lang]]`), the default lang will
    //   not contain the language in the path but all other variations will.
    const hasLangRequired = /\/?\[lang(=[a-z]+)?\](?!\])/.exec(path);
    const _path = hasLangRequired
      ? path.replace(langRegex, '/' + langConfig.default)
      : path.replace(langRegex, '') || '/';

    // Add the default path (e.g. '/about', or `/es/about` if lang is required).
    const variations = [
      {
        lang: langConfig.default,
        path: _path,
      },
    ];

    // Add alternate paths (e.g. '/de/about', etc.)
    for (const lang of langConfig.alternates) {
      variations.push({
        lang,
        path: path.replace(langRegexNoPath, lang),
      });
    }

    // Generate all path objects. I.e. an array containing 1.) default path +
    // the alternates array, 2.) every other path variation + the alternates
    // array.
    const pathObjs = [];
    for (const x of variations) {
      pathObjs.push({
        alternates: variations,
        path: x.path,
      });
    }

    allPathObjs.push(...pathObjs);
  }

  return allPathObjs;
}

/**
 * Removes duplicate paths from an array of PathObj, keeping the last occurrence
 * of any duplicates.
 *
 * Duplicate pathObjs could occur due to a developer using additionalPaths or
 * processPaths() and not properly excluding a pre-existing path.
 *
 * @param pathObjs - An array of PathObj to deduplicate.
 * @returns A new array of PathObj with duplicates removed, retaining the last
 * occurrence of any duplicates.
 */
export function deduplicatePaths(pathObjs: PathObj[]): PathObj[] {
  const uniquePaths = new Map<string, PathObj>();

  for (const pathObj of pathObjs) {
    uniquePaths.set(pathObj.path, pathObj);
  }

  return Array.from(uniquePaths.values());
}

/**
 * Normalizes the user-provided `additionalPaths` to ensure each starts with a
 * forward slash and then returns a `PathObj[]` type.
 *
 * Note: `additionalPaths` are never translated based on the lang config because
 * they could be something like a PDF within the user's static dir.
 *
 * @param additionalPaths - An array of string paths to be normalized
 * @returns An array of PathObj
 */
export function normalizeAdditionalPaths(additionalPaths: string[]): PathObj[] {
  return additionalPaths.map((path) => ({
    path: path.startsWith('/') ? path : `/${path}`,
  }));
}
