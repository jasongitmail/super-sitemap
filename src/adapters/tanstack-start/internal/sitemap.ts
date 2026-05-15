import type { PathObj } from '../../../core/internal/types.js';
import type {
  GetTanStackStartHeadersOptions,
  SitemapConfig,
  TanStackStartRouteInput,
  TanStackStartSitemapConfig,
} from './types.js';

import { getTotalPages, paginatePaths } from '../../../core/internal/pagination.js';
import {
  deduplicatePaths,
  generateAdditionalPaths,
  sortPaths,
} from '../../../core/internal/paths.js';
import { generatePathsFromRouteTemplates } from '../../../core/internal/route-templates.js';
import { renderSitemapIndexXml, renderSitemapXml } from '../../../core/internal/xml.js';
import { createTanStackStartRouteTemplates } from './routes.js';

export function getBody({
  maxPerPage = 50_000,
  origin,
  page,
  ...config
}: TanStackStartSitemapConfig): string {
  if (!origin) {
    throw new Error('TanStack Start sitemap: `origin` property is required in sitemap config.');
  }

  const paths = prepareTanStackStartSitemapPaths(config);
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

export function getHeaders({ customHeaders = {} }: GetTanStackStartHeadersOptions = {}): Record<
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

export function generateTanStackStartPaths({
  defaultChangefreq,
  defaultPriority,
  excludeRoutePatterns,
  lang,
  locale,
  paramValues,
  ...routeInput
}: Pick<
  TanStackStartSitemapConfig,
  | 'defaultChangefreq'
  | 'defaultPriority'
  | 'excludeRoutePatterns'
  | 'lang'
  | 'locale'
  | 'paramValues'
> &
  TanStackStartRouteInput): PathObj[] {
  const templates = createTanStackStartRouteTemplates({
    excludeRoutePatterns,
    locale,
    ...routeInput,
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
          `TanStack Start sitemap: paramValues not provided for route: '${route}'. Update excludeRoutePatterns to exclude this route or add data for this route's params to paramValues.`
        );
      }

      if (
        error.message.startsWith(
          'Core: paramValues were provided for a route that does not exist: '
        )
      ) {
        const route = error.message.match(/'(.+)'/)?.[1] ?? '';
        throw new Error(
          `TanStack Start sitemap: paramValues were provided for a route that does not exist: '${route}'. Remove this property from paramValues or update your TanStack route source.`
        );
      }
    }

    throw error;
  }
}

export async function response({
  additionalPaths = [],
  defaultChangefreq,
  defaultPriority,
  excludeRoutePatterns,
  headers = {},
  lang,
  locale,
  maxPerPage = 50_000,
  origin,
  page,
  paramValues,
  processPaths,
  sort = false,
  ...routeInput
}: TanStackStartSitemapConfig): Promise<Response> {
  if (!origin) {
    throw new Error('TanStack Start sitemap: `origin` property is required in sitemap config.');
  }

  const paths = prepareTanStackStartSitemapPaths({
    additionalPaths,
    defaultChangefreq,
    defaultPriority,
    excludeRoutePatterns,
    lang,
    locale,
    paramValues,
    processPaths,
    sort,
    ...routeInput,
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

export function prepareTanStackStartSitemapPaths({
  additionalPaths = [],
  defaultChangefreq,
  defaultPriority,
  excludeRoutePatterns,
  lang,
  locale,
  paramValues,
  processPaths,
  sort = false,
  ...routeInput
}: Omit<SitemapConfig, 'headers' | 'maxPerPage' | 'origin' | 'page'>): PathObj[] {
  let paths = [
    ...generateTanStackStartPaths({
      defaultChangefreq,
      defaultPriority,
      excludeRoutePatterns,
      lang,
      locale,
      paramValues,
      ...routeInput,
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
