import type {
  LangConfig,
  ParamValue,
  ParamValues,
  PathObj,
  SitemapConfig,
} from '../core/internal/types.js';

import {
  expandSvelteKitOptionalRoute,
  expandSvelteKitOptionalRoutes,
} from '../adapters/sveltekit/internal/optional-routes.js';
import {
  createSvelteKitRouteTemplates,
  filterSvelteKitRoutes,
  orderSvelteKitTemplatesForCompatibility,
} from '../adapters/sveltekit/internal/routes.js';
import { getTotalPages, paginatePaths } from '../core/internal/pagination.js';
import { deduplicatePaths, generateAdditionalPaths, sortPaths } from '../core/internal/paths.js';
import { generatePathsFromRouteTemplates } from '../core/internal/route-templates.js';
import { renderSitemapIndexXml, renderSitemapXml } from '../core/internal/xml.js';

export type {
  Alternate,
  Changefreq,
  LangConfig,
  ParamValue,
  ParamValues,
  PathObj,
  Priority,
  SitemapConfig,
} from '../core/internal/types.js';

export {
  deduplicatePaths,
  generateAdditionalPaths,
  renderSitemapIndexXml as generateSitemapIndex,
  renderSitemapXml as generateBody,
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

  paths = sortPaths(deduplicatePaths(paths), sort);

  const totalPages = getTotalPages(paths, maxPerPage);

  let body: string;
  if (!page) {
    // User is visiting `/sitemap.xml` or `/sitemap[[page]].xml` without page.
    if (paths.length <= maxPerPage) {
      body = renderSitemapXml(origin, paths);
    } else {
      body = renderSitemapIndexXml(origin, totalPages);
    }
  } else {
    // User is visiting a sitemap index's subpage–e.g. `sitemap[[page]].xml`.

    const paginatedPaths = paginatePaths({ maxPerPage, page, paths });
    if (paginatedPaths.kind === 'invalid-page') {
      return new Response('Invalid page param', { status: 400 });
    }
    if (paginatedPaths.kind === 'not-found') {
      return new Response('Page does not exist', { status: 404 });
    }

    body = renderSitemapXml(origin, paginatedPaths.paths);
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
 * Generates an array of paths, based on `src/routes`, to be included in a
 * sitemap.
 *
 * @public
 *
 * @param excludeRoutePatterns - Optional. An array of patterns for routes to be excluded.
 * @param lang - Optional. The language configuration.
 * @param paramValues - Optional. An object mapping each parameterized route to
 *                      an array of param values for that route.
 * @returns An array of strings, each representing a path for the sitemap.
 */
export function generatePaths({
  defaultChangefreq,
  defaultPriority,
  excludeRoutePatterns = [],
  lang = { alternates: [], default: 'en' },
  paramValues = {},
}: {
  defaultChangefreq: SitemapConfig['defaultChangefreq'];
  defaultPriority: SitemapConfig['defaultPriority'];
  excludeRoutePatterns?: string[];
  lang?: LangConfig;
  paramValues?: ParamValues;
}): PathObj[] {
  const templates = orderSvelteKitTemplatesForCompatibility({
    paramValues,
    templates: createSvelteKitRouteTemplates({ excludeRoutePatterns, lang }),
  });

  try {
    return generatePathsFromRouteTemplates({
      defaultChangefreq,
      defaultPriority,
      lang,
      paramValues,
      templates,
    }).map(stripUndefinedPathMetadata);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('Core: paramValues not provided for route: ')) {
        const route = error.message.match(/'(.+)'/)?.[1] ?? '';
        throw new Error(
          `Sitemap: paramValues not provided for: '${route}'\nUpdate your sitemap's excludeRoutePatterns to exclude this route OR add data for this route's param(s) to the paramValues object of your sitemap config.`
        );
      }

      if (
        error.message.startsWith(
          'Core: paramValues were provided for a route that does not exist: '
        )
      ) {
        const route = error.message.match(/'(.+)'/)?.[1] ?? '';
        throw new Error(
          `Sitemap: paramValues were provided for a route that does not exist within src/routes/: '${route}'. Remove this property from your paramValues.`
        );
      }
    }

    throw error;
  }
}

function stripUndefinedPathMetadata(pathObj: PathObj): PathObj {
  return Object.fromEntries(
    Object.entries(pathObj).filter(([, value]) => value !== undefined)
  ) as PathObj;
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
  return filterSvelteKitRoutes(routes, excludeRoutePatterns);
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
      const langPaths: PathObj[] = [];
      for (const pathObj of pathObjs) {
        langPaths.push({
          ...pathObj,
          path: pathObj.path.slice(0, hasLang?.index) + lang + pathObj.path.slice(hasLang?.index),
        });
      }
      pathsWithLang = pathsWithLang.concat(langPaths);
    } else {
      pathsWithoutLang = pathsWithoutLang.concat(pathObjs);
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
  pathsWithLang = staticWithLang.concat(pathsWithLang);
  pathsWithoutLang = staticWithoutLang.concat(pathsWithoutLang);

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
  return expandSvelteKitOptionalRoutes(routes);
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
  return expandSvelteKitOptionalRoute(originalRoute);
}

/**
 * Processes path objects that contain `[[lang]]` or `[lang]` to 1.) generate one PathObj for each
 * language in the lang config, and 2.) to add an `alternates` property to each such PathObj.
 *
 * @private
 */
export function processPathsWithLang(pathObjs: PathObj[], langConfig: LangConfig): PathObj[] {
  if (!pathObjs.length) return [];

  let processedPathObjs: PathObj[] = [];

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

    processedPathObjs = processedPathObjs.concat(pathObjs);
  }

  return processedPathObjs;
}
