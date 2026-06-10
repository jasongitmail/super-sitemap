import * as core from '../../../core/internal/sitemap.js';
import type { PathObj } from '../../../core/internal/types.js';
import { createTanStackStartNormalizedRoutes } from './routes.js';
import type { SitemapConfig, TanStackStartNormalizedRoute } from './types.js';

export { getHeaders } from '../../../core/internal/sitemap.js';

/**
 * Generates an XML sitemap or sitemap index response body from TanStack Start routes.
 */
export function getBody(config: SitemapConfig): string {
  return core.getBody({ normalizedRoutes: createNormalizedRoutes(config), ...config });
}

/**
 * Generates a TanStack Start `Response` containing an XML sitemap.
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
 * Creates normalized routes from the app's TanStack Start router.
 */
function createNormalizedRoutes({
  excludeRoutePatterns,
  langParam,
  router,
}: Pick<
  SitemapConfig,
  'excludeRoutePatterns' | 'langParam' | 'router'
>): TanStackStartNormalizedRoute[] {
  return createTanStackStartNormalizedRoutes({ excludeRoutePatterns, langParam, router });
}
