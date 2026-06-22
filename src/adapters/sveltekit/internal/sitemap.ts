import {
  getFrameworkAdapterBody,
  getFrameworkAdapterResponse,
  prepareFrameworkAdapterPaths,
} from '../../../core/internal/framework-adapter.js';
import type { PathObj } from '../../../core/internal/types.js';
import { createSvelteKitNormalizedRoutes } from './routes.js';
import type { InternalSvelteKitSitemapConfig, SitemapConfig } from './types.js';

export { getHeaders } from '../../../core/internal/sitemap.js';

/**
 * Generates an XML sitemap or sitemap index response body from SvelteKit route files.
 */
export function getBody(config: SitemapConfig): string {
  return getFrameworkAdapterBody({
    config,
    createNormalizedRoutes: createSvelteKitNormalizedRoutes,
  });
}

/**
 * Generates a SvelteKit `Response` containing an XML sitemap.
 */
export async function response(config: SitemapConfig): Promise<Response> {
  return getFrameworkAdapterResponse({
    config,
    createNormalizedRoutes: createSvelteKitNormalizedRoutes,
  });
}

/**
 * Test-only helper that returns finalized public sitemap path objects without
 * XML rendering.
 *
 * @remarks
 * Public consumers should use `getBody`, `getHeaders`, or `response`. Tests use
 * this helper to assert adapter path generation directly before pagination and
 * XML rendering.
 */
export function prepareSitemapPaths(
  config: Omit<InternalSvelteKitSitemapConfig, 'headers' | 'maxPerPage' | 'origin' | 'page'>
): PathObj[] {
  return prepareFrameworkAdapterPaths({
    config,
    createNormalizedRoutes: createSvelteKitNormalizedRoutes,
  });
}
