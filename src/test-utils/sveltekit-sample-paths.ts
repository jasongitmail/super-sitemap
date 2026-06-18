import { getSamplePaths } from '../adapters/sveltekit/internal/sample-paths.js';
import type { GetSamplePathsOptions } from '../adapters/sveltekit/internal/types.js';
import type { InternalSvelteKitSitemapConfig } from '../adapters/sveltekit/internal/types.js';

/**
 * Samples paths from explicit SvelteKit route files for adapter tests.
 *
 * @param options - SvelteKit sitemap config with injected route files.
 * @returns Canonical root-relative sample paths.
 */
export function getSamplePathsFromRouteFiles({
  getCanonicalPath,
  sitemapConfig,
}: {
  getCanonicalPath?: GetSamplePathsOptions['getCanonicalPath'];
  sitemapConfig: InternalSvelteKitSitemapConfig;
}): string[] {
  return getSamplePaths({ getCanonicalPath, sitemapConfig });
}
