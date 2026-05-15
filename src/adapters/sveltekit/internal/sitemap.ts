import type { PathObj } from '../../../core/internal/types.js';
import type { GetSvelteKitHeadersOptions, SitemapConfig } from './types.js';

import { getTotalPages, paginatePaths } from '../../../core/internal/pagination.js';
import { generatePathsFromRouteTemplates } from '../../../core/internal/path-generation.js';
import {
  deduplicatePaths,
  generateAdditionalPaths,
  sortPaths,
} from '../../../core/internal/paths.js';
import { renderSitemapIndexXml, renderSitemapXml } from '../../../core/internal/xml.js';
import {
  createSvelteKitRouteTemplates,
  orderSvelteKitTemplatesForCompatibility,
} from './routes.js';

/**
 * Generates an XML sitemap or sitemap index response body from SvelteKit route files.
 */
export function getBody({ maxPerPage = 50_000, origin, page, ...config }: SitemapConfig): string {
  if (!origin) {
    throw new Error('SvelteKit sitemap: `origin` property is required in sitemap config.');
  }

  const paths = prepareSvelteKitSitemapPaths(config);
  const totalPages = getTotalPages(paths, maxPerPage);

  if (!page) {
    if (paths.length <= maxPerPage) {
      return renderSitemapXml(origin, paths);
    }

    return renderSitemapIndexXml(origin, totalPages);
  }

  const paginatedPaths = paginatePaths({ maxPerPage, page, paths });
  if (paginatedPaths.kind === 'invalid-page') {
    return 'Invalid page param';
  }
  if (paginatedPaths.kind === 'not-found') {
    return 'Page does not exist';
  }

  return renderSitemapXml(origin, paginatedPaths.paths);
}

/**
 * Returns sitemap response headers with custom values merged case-insensitively.
 */
export function getHeaders({ customHeaders = {} }: GetSvelteKitHeadersOptions = {}): Record<
  string,
  string
> {
  return {
    'cache-control': 'max-age=0, s-maxage=3600',
    'content-type': 'application/xml',
    ...Object.fromEntries(
      Object.entries(customHeaders).map(([key, value]) => [key.toLowerCase(), value])
    ),
  };
}

/**
 * Generates sitemap path objects from SvelteKit route files and parameter values.
 */
export function generateSvelteKitPaths({
  defaultChangefreq,
  defaultPriority,
  excludeRoutePatterns,
  lang = { alternates: [], default: 'en' },
  paramValues = {},
  routeFiles,
}: Pick<
  SitemapConfig,
  | 'defaultChangefreq'
  | 'defaultPriority'
  | 'excludeRoutePatterns'
  | 'lang'
  | 'paramValues'
  | 'routeFiles'
>): PathObj[] {
  const templates = orderSvelteKitTemplatesForCompatibility({
    paramValues,
    templates: createSvelteKitRouteTemplates({ excludeRoutePatterns, lang, routeFiles }),
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
          `SvelteKit sitemap: paramValues not provided for route: '${route}'. Update excludeRoutePatterns to exclude this route or add data for this route's params to paramValues.`
        );
      }

      if (
        error.message.startsWith(
          'Core: paramValues were provided for a route that does not exist: '
        )
      ) {
        const route = error.message.match(/'(.+)'/)?.[1] ?? '';
        throw new Error(
          `SvelteKit sitemap: paramValues were provided for a route that does not exist: '${route}'. Remove this property from paramValues or update your SvelteKit route source.`
        );
      }
    }

    throw error;
  }
}

/**
 * Generates a SvelteKit `Response` containing an XML sitemap.
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
  routeFiles,
  sort = false,
}: SitemapConfig): Promise<Response> {
  if (!origin) {
    throw new Error('SvelteKit sitemap: `origin` property is required in sitemap config.');
  }

  const paths = prepareSvelteKitSitemapPaths({
    additionalPaths,
    defaultChangefreq,
    defaultPriority,
    excludeRoutePatterns,
    lang,
    paramValues,
    processPaths,
    routeFiles,
    sort,
  });

  const totalPages = getTotalPages(paths, maxPerPage);

  let body: string;
  if (!page) {
    body =
      paths.length <= maxPerPage
        ? renderSitemapXml(origin, paths)
        : renderSitemapIndexXml(origin, totalPages);
  } else {
    const paginatedPaths = paginatePaths({ maxPerPage, page, paths });
    if (paginatedPaths.kind === 'invalid-page') {
      return new Response('Invalid page param', { status: 400 });
    }
    if (paginatedPaths.kind === 'not-found') {
      return new Response('Page does not exist', { status: 404 });
    }

    body = renderSitemapXml(origin, paginatedPaths.paths);
  }

  return new Response(body, { headers: getHeaders({ customHeaders: headers }) });
}

/**
 * Prepares final public sitemap path objects before rendering or sampling.
 */
export function prepareSvelteKitSitemapPaths({
  additionalPaths = [],
  defaultChangefreq,
  defaultPriority,
  excludeRoutePatterns,
  lang,
  paramValues,
  processPaths,
  routeFiles,
  sort = false,
}: Omit<SitemapConfig, 'headers' | 'maxPerPage' | 'origin' | 'page'>): PathObj[] {
  let paths = [
    ...generateSvelteKitPaths({
      defaultChangefreq,
      defaultPriority,
      excludeRoutePatterns,
      lang,
      paramValues,
      routeFiles,
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

  return sortPaths(deduplicatePaths(paths), sort);
}

function stripUndefinedPathMetadata(pathObj: PathObj): PathObj {
  return Object.fromEntries(
    Object.entries(pathObj).filter(([, value]) => value !== undefined)
  ) as PathObj;
}
