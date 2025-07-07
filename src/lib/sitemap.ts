export type Changefreq = 'always' | 'daily' | 'hourly' | 'monthly' | 'never' | 'weekly' | 'yearly';

/* eslint-disable perfectionist/sort-object-types */
export type ParamValue = {
  values: string[];
  lastmod?: string;
  priority?: Priority;
  changefreq?: Changefreq;
};

/* eslint-disable perfectionist/sort-object-types */
export type ParamValues = Record<string, ParamValue[] | never | string[] | string[][]>;

export type Priority = 0.0 | 0.1 | 0.2 | 0.3 | 0.4 | 0.5 | 0.6 | 0.7 | 0.8 | 0.9 | 1.0;

/* eslint-disable perfectionist/sort-object-types */
export type SitemapConfig = {
  additionalPaths?: string[];
  excludeRoutePatterns?: string[];
  headers?: Record<string, string>;
  lang?: {
    default: string;
    alternates: string[];
  };
  maxPerPage?: number;
  origin: string;
  page?: string;

  /**
   * Parameter values for dynamic routes, where the values can be:
   * - `string[]`
   * - `string[][]`
   * - `ParamValueObj[]`
   */
  paramValues?: ParamValues;

  /**
   * Optional. Default changefreq, when not specified within a route's `paramValues` objects.
   * Omitting from sitemap config will omit changefreq from all sitemap entries except
   * those where you set `changefreq` property with a route's `paramValues` objects.
   */
  defaultChangefreq?: Changefreq;

  /**
   * Optional. Default priority, when not specified within a route's `paramValues` objects.
   * Omitting from sitemap config will omit priority from all sitemap entries except
   * those where you set `priority` property with a route's `paramValues` objects.
   */
  defaultPriority?: Priority;

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
  lastmod?: string; // ISO 8601 datetime
  changefreq?: Changefreq;
  priority?: Priority;
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
 * @param config.defaultChangefreq - Optional. Default `changefreq` value to use for all paths. Omit this property to not use a default value.
 * @param config.defaultPriority - Optional. Default `priority` value to use for all paths. Omit this property to not use a default value.
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
 *     ],
 *     '/athlete-rankings/[country]/[state]': [
 *       {
 *         values: ['usa', 'new-york'],
 *         lastmod: '2025-01-01',
 *         changefreq: 'daily',
 *         priority: 0.5,
 *       },
 *       {
 *         values: ['usa', 'california'],
 *         lastmod: '2025-01-01',
 *         changefreq: 'daily',
 *         priority: 0.5,
 *       },
 *     ],
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
  defaultChangefreq,
  defaultPriority,
  excludeRoutePatterns,
  headers = {},
  lang,
  maxPerPage = 50_000,
  origin,
  page,
  paramValues,
  processPaths,
  sort = false,
}: SitemapConfig): Promise<Response> {
  // Cause a 500 error for visibility
  if (!origin) {
    throw new Error('Sitemap: `origin` property is required in sitemap config.');
  }

  let paths = [
    ...generatePaths({
      defaultChangefreq,
      defaultPriority,
      excludeRoutePatterns,
      lang,
      paramValues,
    }),
    ...generateAdditionalPaths({
      additionalPaths,
      defaultChangefreq,
      defaultPriority,
    }),
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
      body = generateBody(origin, paths);
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
    body = generateBody(origin, pathsOnThisPage);
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
 * @param pathObjs - Array of path objects to include in the sitemap. Each path within it should
 *                 start with a '/'; but if not, it will be added.
 * @returns The generated XML sitemap.
 */
export function generateBody(origin: string, pathObjs: PathObj[]): string {
  const urlElements = pathObjs
    .map((pathObj) => {
      const { alternates, changefreq, lastmod, path, priority } = pathObj;

      let url = '\n  <url>\n';
      url += `    <loc>${origin}${path}</loc>\n`;
      url += lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : '';
      url += changefreq ? `    <changefreq>${changefreq}</changefreq>\n` : '';
      url += priority ? `    <priority>${priority}</priority>\n` : '';

      if (alternates) {
        url += alternates
          .map(
            ({ lang, path }) =>
              `    <xhtml:link rel="alternate" hreflang="${lang}" href="${origin}${path}" />\n`
          )
          .join('');
      }

      url += '  </url>';

      return url;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" ?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
>${urlElements}
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
export function generatePaths({
  defaultChangefreq,
  defaultPriority,
  excludeRoutePatterns = [],
  lang,
  paramValues = {},
}: {
  excludeRoutePatterns?: string[];
  paramValues?: ParamValues;
  lang?: LangConfig;
  defaultChangefreq: SitemapConfig['defaultChangefreq'];
  defaultPriority: SitemapConfig['defaultPriority'];
}): PathObj[] {
  // Match +page.svelte, +page@.svelte, +page@foo.svelte, +page@[id].svelte, and +page@(id).svelte
  // - See: https://kit.svelte.dev/docs/advanced-routing#advanced-layouts-breaking-out-of-layouts
  // - The `.md` and `.svx` extensions are to support MDSveX, which is a common
  //   markdown preprocessor for SvelteKit.
  const svelteRoutes = Object.keys(import.meta.glob('/src/routes/**/+page*.svelte'));
  const mdRoutes = Object.keys(import.meta.glob('/src/routes/**/+page*.md'));
  const svxRoutes = Object.keys(import.meta.glob('/src/routes/**/+page*.svx'));
  const allRoutes = [...svelteRoutes, ...mdRoutes, ...svxRoutes];

  // Validation: if dev has one or more routes that contain a lang parameter,
  // optional or required, require that they have defined the `lang.default` and
  // `lang.alternates` in their config or throw an error to cause a 500 error
  // for visibility.
  let routesContainLangParam = false;
  for (const route of allRoutes) {
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
  const filteredRoutes = filterRoutes(allRoutes, excludeRoutePatterns);
  const processedRoutes = processRoutesForOptionalParams(filteredRoutes);

  const { pathsWithLang, pathsWithoutLang } = generatePathsWithParamValues(
    processedRoutes,
    paramValues,
    defaultChangefreq,
    defaultPriority
  );

  const pathsWithLangAlternates = processPathsWithLang(pathsWithLang, lang);

  return [...pathsWithoutLang, ...pathsWithLangAlternates];
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
 *                        ],
 *                        '/athlete-rankings/[country]/[state]':[
 *                          {
 *                            params: ['usa', 'new-york'],
 *                            lastmod: '2024-01-01',
 *                            changefreq: 'daily',
 *                            priority: 0.5,
 *                          },
 *                          {
 *                            params: ['usa', 'california'],
 *                            lastmod: '2024-01-01',
 *                            changefreq: 'daily',
 *                            priority: 0.5,
 *                          },
 *                        ]
 *                      }
 *
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
  paramValues: ParamValues,
  defaultChangefreq: SitemapConfig['defaultChangefreq'],
  defaultPriority: SitemapConfig['defaultPriority']
): { pathsWithLang: PathObj[]; pathsWithoutLang: PathObj[] } {
  // Throw if paramValues contains keys that don't exist within src/routes/.
  for (const paramValueKey in paramValues) {
    if (!routes.includes(paramValueKey)) {
      throw new Error(
        `Sitemap: paramValues were provided for a route that does not exist within src/routes/: '${paramValueKey}'. Remove this property from your paramValues.`
      );
    }
  }

  // `changefreq`, `lastmod`, & `priority` are intentionally left with undefined values (for
  // consistency of property name within the `processPaths() callback, if used) when the dev does
  // not specify them either in pathObj or as defaults in the sitemap config.
  const defaults = {
    changefreq: defaultChangefreq,
    lastmod: undefined,
    priority: defaultPriority,
  };

  let pathsWithLang: PathObj[] = [];
  let pathsWithoutLang: PathObj[] = [];

  // Outside loop for performance
  const PARAM_TOKEN_REGEX = /(\[\[.+?\]\]|\[.+?\])/g;

  for (const paramValuesKey in paramValues) {
    const hasLang = langRegex.exec(paramValuesKey);
    const routeSansLang = paramValuesKey.replace(langRegex, '');
    const paramValue = paramValues[paramValuesKey];

    let pathObjs: PathObj[] = [];

    // Handle when paramValue contains ParamValueObj[]
    if (typeof paramValue[0] === 'object' && !Array.isArray(paramValue[0])) {
      const objArray = paramValue as ParamValue[];

      for (const item of objArray) {
        let i = 0;
        pathObjs.push({
          changefreq: item.changefreq ?? defaults.changefreq,
          lastmod: item.lastmod,
          path: routeSansLang.replace(PARAM_TOKEN_REGEX, () => item.values[i++] || ''),
          priority: item.priority ?? defaults.priority,
        });
      }
    } else if (Array.isArray(paramValue[0])) {
      // Handle when paramValue contains a 2D array of strings (e.g. [['usa', 'new-york'], ['usa',
      // 'california']])
      // - `replace()` replaces every [[foo]] or [foo] with a value from the array.
      const array2D = paramValue as string[][];
      pathObjs = array2D.map((data) => {
        let i = 0;
        return {
          ...defaults,
          path: routeSansLang.replace(PARAM_TOKEN_REGEX, () => data[i++] || ''),
        };
      });
    } else {
      // Handle 1D array of strings (e.g. ['hello-world', 'another-post', 'foo-post']) to generate
      // paths using these param values.
      const array1D = paramValue as string[];
      pathObjs = array1D.map((paramValue) => ({
        ...defaults,
        path: routeSansLang.replace(/\[.*\]/, paramValue),
      }));
    }

    // Process path objects to add lang onto each path, when applicable.
    if (hasLang) {
      const lang = hasLang?.[0];
      for (const pathObj of pathObjs) {
        pathsWithLang.push({
          ...pathObj,
          path: pathObj.path.slice(0, hasLang?.index) + lang + pathObj.path.slice(hasLang?.index),
        });
      }
    } else {
      pathsWithoutLang.push(...pathObjs);
    }

    // Remove this from routes
    routes.splice(routes.indexOf(paramValuesKey), 1);
  }

  // Handle "static" routes (i.e. /foo, /[[lang]]/bar, etc). These will not have any parameters
  // other than exactly `[[lang]]`.
  const staticWithLang: PathObj[] = [];
  const staticWithoutLang: PathObj[] = [];
  for (const route of routes) {
    const hasLang = route.match(langRegex);
    if (hasLang) {
      staticWithLang.push({ ...defaults, path: route });
    } else {
      staticWithoutLang.push({ ...defaults, path: route });
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
        `Sitemap: paramValues not provided for: '${route}'\nUpdate your sitemap's excludeRoutePatterns to exclude this route OR add data for this route's param(s) to the paramValues object of your sitemap config.`
      );
    }
  }

  return { pathsWithLang, pathsWithoutLang };
}

/**
 * Given an array of all routes, return a new array of routes that includes all versions of each
 * route that contains one or more optional params _other than_ `[[lang]]`.
 *
 * @private
 */
export function processRoutesForOptionalParams(routes: string[]): string[] {
  const processedRoutes = routes.flatMap((route) => {
    const routeWithoutLangIfAny = route.replace(langRegex, '');
    return /\[\[.*\]\]/.test(routeWithoutLangIfAny) ? processOptionalParams(route) : route;
  });

  // Ensure no duplicates exist after processing
  return Array.from(new Set(processedRoutes));
}

/**
 * Processes a route containing >=1 optional parameters (i.e. those with double square brackets) to
 * generate all possible versions of this route that SvelteKit considers valid.
 *
 * @private
 * @param route - Route to process. E.g. `/foo/[[paramA]]`
 * @returns An array of routes. E.g. [`/foo`, `/foo/[[paramA]]`]
 */
export function processOptionalParams(originalRoute: string): string[] {
  // Remove lang to simplify
  const hasLang = langRegex.exec(originalRoute);
  const route = hasLang ? originalRoute.replace(langRegex, '') : originalRoute;

  let results: string[] = [];

  // Get path up to _before_ the first optional param; use `i-1` to exclude
  // trailing slash after this. This is our first result.
  results.push(route.slice(0, route.indexOf('[[') - 1));

  // Extract the portion of the route starting at the first optional parameter
  const remaining = route.slice(route.indexOf('[['));

  // Split, then filter to remove empty items.
  const segments = remaining.split('/').filter(Boolean);

  let j = 1;
  for (const segment of segments) {
    // Start a new potential result
    if (!results[j]) results[j] = results[j - 1];

    results[j] = `${results[j]}/${segment}`;

    if (segment.startsWith('[[')) {
      j++;
    }
  }

  // Re-add lang to all results.
  if (hasLang) {
    const lang = hasLang?.[0];
    results = results.map(
      (result) => `${result.slice(0, hasLang?.index)}${lang}${result.slice(hasLang?.index)}`
    );
  }

  // When the first path segment is an optional parameter (except for [[lang]]), the first result
  // will be an empty string. We set this to '/' b/c the root path is one of the valid paths
  // combinations in such a scenario.
  if (!results[0].length) results[0] = '/';

  return results;
}

/**
 * Processes path objects that contain `[[lang]]` or `[lang]` to 1.) generate one PathObj for each
 * language in the lang config, and 2.) to add an `alternates` property to each such PathObj.
 *
 * @private
 */
export function processPathsWithLang(pathObjs: PathObj[], langConfig: LangConfig): PathObj[] {
  if (!pathObjs.length) return [];

  const processedPathObjs = [];

  for (const pathObj of pathObjs) {
    const path = pathObj.path;
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
      ? path.replace(langRegex, `/${langConfig.default}`)
      : path.replace(langRegex, '') || '/';

    // Add the default path (e.g. '/about', or `/es/about` when lang is required).
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

    // Generate a PathObj for each variation.
    const pathObjs = [];
    for (const x of variations) {
      pathObjs.push({
        ...pathObj, // keep original pathObj properties
        alternates: variations,
        path: x.path,
      });
    }

    processedPathObjs.push(...pathObjs);
  }

  return processedPathObjs;
}

/**
 * Removes duplicate paths from an array of PathObj, keeping the last occurrence of any duplicates.
 *
 * - Duplicate pathObjs could occur due to a developer using additionalPaths or processPaths() and
 *   not properly excluding a pre-existing path.
 *
 * @private
 */
export function deduplicatePaths(pathObjs: PathObj[]): PathObj[] {
  const uniquePaths = new Map<string, PathObj>();

  for (const pathObj of pathObjs) {
    uniquePaths.set(pathObj.path, pathObj);
  }

  return Array.from(uniquePaths.values());
}

/**
 * Converts the user-provided `additionalPaths` into `PathObj[]` type, ensuring each path starts
 * with a forward slash and each PathObj contains default changefreq and priority.
 *
 * - `additionalPaths` are never translated based on the lang config because they could be something
 *   like a PDF within the user's static dir.
 *
 * @private
 */
export function generateAdditionalPaths({
  additionalPaths,
  defaultChangefreq,
  defaultPriority,
}: {
  additionalPaths: string[];
  defaultChangefreq: SitemapConfig['defaultChangefreq'];
  defaultPriority: SitemapConfig['defaultPriority'];
}): PathObj[] {
  const defaults = {
    changefreq: defaultChangefreq,
    lastmod: undefined,
    priority: defaultPriority,
  };

  return additionalPaths.map((path) => ({
    ...defaults,
    path: path.startsWith('/') ? path : `/${path}`,
  }));
}
