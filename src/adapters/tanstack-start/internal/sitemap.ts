import {
  getFrameworkAdapterBody,
  getFrameworkAdapterResponse,
  prepareFrameworkAdapterPaths,
} from '../../../core/internal/framework-adapter.js';
import type { PathObj } from '../../../core/internal/types.js';
import { createTanStackStartNormalizedRoutes } from './routes.js';
import type { SitemapConfig } from './types.js';

export { getHeaders } from '../../../core/internal/sitemap.js';

/**
 * Generates an XML sitemap or sitemap index response body from TanStack Start routes.
 */
export function getBody(config: SitemapConfig): string {
  return getFrameworkAdapterBody({
    config,
    createNormalizedRoutes: createTanStackStartNormalizedRoutes,
  });
}

/**
 * Generates a TanStack Start `Response` containing an XML sitemap.
 */
export async function response(config: SitemapConfig): Promise<Response> {
  return getFrameworkAdapterResponse({
    config,
    createNormalizedRoutes: createTanStackStartNormalizedRoutes,
  });
}

/**
 * Prepares final public sitemap path objects before rendering or sampling.
 */
export function prepareSitemapPaths(
  config: Omit<SitemapConfig, 'headers' | 'maxPerPage' | 'origin' | 'page'>
): PathObj[] {
  return prepareFrameworkAdapterPaths({
    config,
    createNormalizedRoutes: createTanStackStartNormalizedRoutes,
  });
}
