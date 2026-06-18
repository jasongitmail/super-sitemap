import { getFrameworkAdapterSamplePaths } from '../../../core/internal/framework-adapter.js';
import { createTanStackStartNormalizedRoutes } from './routes.js';
import type { GetSamplePathsOptions } from './types.js';

/**
 * Returns one canonical sample path for each sitemap-published TanStack route shape.
 *
 * @remarks
 * Design rationale:
 * - avoids fetching/parsing sitemap XML
 * - reuses the exact sitemap config
 * - samples from final public sitemap paths after `processPaths`
 * - exposes no paths beyond what the sitemap exposes by default
 * - keeps auth/private-route exclusion DRY in sitemap config
 * - keeps the mental model simple: `/sample-paths` is a sampled view of `/sitemap.xml`
 *
 * `getCanonicalPath` exists because canonicalization must run before dedupe and
 * sampling. For example, localized variants like `/es/contact` and `/contact`
 * need to collapse into one route sample before they are matched against route
 * normalizedRoutes. The default canonicalizer returns each path unchanged.
 *
 * If `getCanonicalPath` maps paths into new values, that is explicit caller
 * behavior, but inventing paths that are not canonical forms of
 * sitemap-published paths is not recommended and would be considered an
 * anti-pattern. There should be no reason to do this.
 *
 * Private or authenticated routes must be excluded from the sitemap config. This
 * helper intentionally reuses the sitemap as the source of truth instead of
 * maintaining a second exclusion policy.
 *
 * Paths that do not match a TanStack route, including typical `additionalPaths`
 * such as PDFs, are ignored because they do not correspond to a TanStack route.
 *
 * @param options - Sample path options.
 * @returns Canonical root-relative sample paths.
 */
export function getSamplePaths({
  getCanonicalPath,
  sitemapConfig,
}: GetSamplePathsOptions): string[] {
  return getFrameworkAdapterSamplePaths({
    config: sitemapConfig,
    createNormalizedRoutes: createTanStackStartNormalizedRoutes,
    getCanonicalPath,
  });
}
