import { getTotalPages, paginatePaths } from './pagination.js';
import { SitemapRouteParamError, generatePathsFromNormalizedRoutes } from './path-generation.js';
import { deduplicatePaths, generateAdditionalPaths, sortPaths } from './paths.js';
import type { NormalizedRoute, PathObj, SitemapConfig } from './types.js';
import { renderSitemapIndexXml, renderSitemapXml } from './xml.js';

const DEFAULT_MAX_PER_PAGE = 50_000;

export type GetHeadersOptions = {
  customHeaders?: Record<string, string>;
};

export type PreparePathsOptions = Pick<
  SitemapConfig,
  | 'additionalPaths'
  | 'defaultChangefreq'
  | 'defaultPriority'
  | 'locales'
  | 'paramValues'
  | 'processPaths'
  | 'sort'
> & {
  /** Normalized routes produced by the adapter, in output order. */
  normalizedRoutes: NormalizedRoute[];
};

export type GetBodyOptions = Pick<SitemapConfig, 'maxPerPage' | 'origin' | 'page'> &
  PreparePathsOptions;

export type ResponseOptions = GetBodyOptions & Pick<SitemapConfig, 'headers'>;

type RenderSitemapResult =
  | { body: string; error: null }
  | { error: 'invalid-page' }
  | { error: 'not-found' };

/**
 * Prepares final public sitemap path objects before rendering or sampling:
 * normalized-route interpolation, additional paths, `processPaths`,
 * deduplication, and optional sorting.
 */
export function preparePaths(options: PreparePathsOptions): PathObj[] {
  validateNoLegacyLangConfig(options);

  const {
    additionalPaths = [],
    defaultChangefreq,
    defaultPriority,
    locales,
    normalizedRoutes,
    paramValues,
    processPaths,
    sort = false,
  } = options;

  let paths = [
    ...generateNormalizedRoutePaths({
      defaultChangefreq,
      defaultPriority,
      locales,
      normalizedRoutes,
      paramValues,
    }),
    ...generateAdditionalPaths({ additionalPaths, defaultChangefreq, defaultPriority }),
  ];

  if (processPaths) {
    paths = processPaths(paths);
  }

  return sortPaths(deduplicatePaths(paths), sort);
}

/**
 * Generates an XML sitemap or sitemap index response body.
 */
export function getBody({
  maxPerPage = DEFAULT_MAX_PER_PAGE,
  origin,
  page,
  ...prepareOptions
}: GetBodyOptions): string {
  validateOrigin(origin);
  validateMaxPerPage(maxPerPage);

  const result = renderSitemap({ maxPerPage, origin, page, paths: preparePaths(prepareOptions) });

  if (result.error === 'invalid-page') return 'Invalid page param';
  if (result.error === 'not-found') return 'Page does not exist';

  return result.body;
}

/**
 * Returns sitemap response headers with custom values merged case-insensitively.
 */
export function getHeaders({ customHeaders = {} }: GetHeadersOptions = {}): Record<string, string> {
  return {
    'cache-control': 'max-age=0, s-maxage=3600',
    'content-type': 'application/xml',
    ...Object.fromEntries(
      Object.entries(customHeaders).map(([key, value]) => [key.toLowerCase(), value])
    ),
  };
}

/**
 * Generates a `Response` containing an XML sitemap, sitemap index, or
 * pagination error status.
 */
export function response({
  headers = {},
  maxPerPage = DEFAULT_MAX_PER_PAGE,
  origin,
  page,
  ...prepareOptions
}: ResponseOptions): Response {
  validateOrigin(origin);
  validateMaxPerPage(maxPerPage);

  const result = renderSitemap({ maxPerPage, origin, page, paths: preparePaths(prepareOptions) });

  if (result.error === 'invalid-page') {
    return new Response('Invalid page param', { status: 400 });
  }
  if (result.error === 'not-found') {
    return new Response('Page does not exist', { status: 404 });
  }

  return new Response(result.body, { headers: getHeaders({ customHeaders: headers }) });
}

/**
 * Renders a sitemap page, a sitemap index when paths exceed one page, or a
 * pagination error code. Keeps the body/status decision in one place for
 * `getBody` and `response`.
 */
function renderSitemap({
  maxPerPage,
  origin,
  page,
  paths,
}: {
  maxPerPage: number;
  origin: string;
  page?: string;
  paths: PathObj[];
}): RenderSitemapResult {
  if (!page) {
    return {
      body:
        paths.length <= maxPerPage
          ? renderSitemapXml(origin, paths)
          : renderSitemapIndexXml(origin, getTotalPages(paths, maxPerPage)),
      error: null,
    };
  }

  const paginatedPaths = paginatePaths({ maxPerPage, page, paths });
  if (paginatedPaths.error !== null) {
    return { error: paginatedPaths.error };
  }

  return { body: renderSitemapXml(origin, paginatedPaths.paths), error: null };
}

function generateNormalizedRoutePaths({
  defaultChangefreq,
  defaultPriority,
  locales,
  normalizedRoutes,
  paramValues,
}: Pick<
  PreparePathsOptions,
  'defaultChangefreq' | 'defaultPriority' | 'locales' | 'normalizedRoutes' | 'paramValues'
>): PathObj[] {
  try {
    return generatePathsFromNormalizedRoutes({
      defaultChangefreq,
      defaultPriority,
      locales,
      normalizedRoutes,
      paramValues,
    }).map(stripUndefinedPathMetadata);
  } catch (error) {
    if (error instanceof SitemapRouteParamError) {
      throw new Error(formatRouteParamErrorMessage(error));
    }

    throw error;
  }
}

function formatRouteParamErrorMessage(error: SitemapRouteParamError): string {
  if (error.code === 'missing-param-values') {
    return `super-sitemap: paramValues not provided for route: '${error.route}'. Update excludeRoutePatterns to exclude this route or add data for this route's params to paramValues.`;
  }

  return `super-sitemap: paramValues were provided for a route that does not exist: '${error.route}'. Remove this property from paramValues or update your route source.`;
}

function validateOrigin(origin: string): void {
  if (!origin) {
    throw new Error('super-sitemap: `origin` property is required in sitemap config.');
  }
}

/**
 * Validates sitemap page size before pagination math can produce invalid page counts.
 */
function validateMaxPerPage(maxPerPage: number): void {
  if (!Number.isInteger(maxPerPage) || maxPerPage < 1 || maxPerPage > DEFAULT_MAX_PER_PAGE) {
    throw new Error('maxPerPage must be an integer between 1 and 50_000.');
  }
}

function validateNoLegacyLangConfig(options: object): void {
  if ('lang' in options) {
    throw new Error('super-sitemap: `lang` was renamed to `locales` in v2.');
  }
}

function stripUndefinedPathMetadata(pathObj: PathObj): PathObj {
  return Object.fromEntries(
    Object.entries(pathObj).filter(([, value]) => value !== undefined)
  ) as PathObj;
}
