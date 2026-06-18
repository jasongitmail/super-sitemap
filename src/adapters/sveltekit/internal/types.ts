import type { GetHeadersOptions } from '../../../core/internal/sitemap.js';
import type { SitemapConfig, LocalesConfig } from '../../../core/internal/types.js';

export type { GetHeadersOptions };

/**
 * Options for creating normalized routes from SvelteKit page route files.
 */
export type CreateSvelteKitNormalizedRoutesOptions = {
  excludeRoutePatterns?: RegExp[];
  locales?: LocalesConfig;
  routeFiles?: string[];
};

/**
 * Internal config used by adapter helpers and tests that inject route files.
 */
export type InternalSvelteKitSitemapConfig = SitemapConfig & {
  routeFiles?: string[];
};

export type GetSamplePathsOptions = {
  getCanonicalPath?: (path: string) => string;
  sitemapConfig: SitemapConfig;
};
