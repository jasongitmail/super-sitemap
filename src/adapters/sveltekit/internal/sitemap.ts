import * as core from '../../../core/internal/sitemap.js';
import type { NormalizedRoute, PathObj } from '../../../core/internal/types.js';
import {
  createSvelteKitNormalizedRoutes,
  orderSvelteKitNormalizedRoutesForCompatibility,
} from './routes.js';
import type { SitemapConfig } from './types.js';

export { getHeaders } from '../../../core/internal/sitemap.js';

/**
 * Generates an XML sitemap or sitemap index response body from SvelteKit route files.
 */
export function getBody(config: SitemapConfig): string {
  return core.getBody({ normalizedRoutes: createNormalizedRoutes(config), ...config });
}

/**
 * Generates a SvelteKit `Response` containing an XML sitemap.
 */
export async function response(config: SitemapConfig): Promise<Response> {
  return core.response({ normalizedRoutes: createNormalizedRoutes(config), ...config });
}

/**
 * Prepares final public sitemap path objects before rendering or sampling.
 */
export function prepareSitemapPaths(
  config: Omit<SitemapConfig, 'headers' | 'maxPerPage' | 'origin' | 'page'>
): PathObj[] {
  return core.preparePaths({ normalizedRoutes: createNormalizedRoutes(config), ...config });
}

/**
 * Creates normalized routes from SvelteKit route files, ordered to
 * preserve the adapter's path output order.
 */
function createNormalizedRoutes({
  excludeRoutePatterns,
  locales,
  paramValues,
  routeFiles,
}: Pick<
  SitemapConfig,
  'excludeRoutePatterns' | 'locales' | 'paramValues' | 'routeFiles'
>): NormalizedRoute[] {
  return orderSvelteKitNormalizedRoutesForCompatibility({
    normalizedRoutes: createSvelteKitNormalizedRoutes({
      excludeRoutePatterns,
      locales,
      routeFiles,
    }),
    paramValues,
  });
}
