import type { GetHeadersOptions } from '../../../core/internal/sitemap.js';
import type {
  SitemapConfig as BaseSitemapConfig,
  LangConfig,
} from '../../../core/internal/types.js';

export type { GetHeadersOptions };

/**
 * Options for creating normalized routes from SvelteKit page route files.
 */
export type CreateSvelteKitNormalizedRoutesOptions = {
  excludeRoutePatterns?: RegExp[];
  lang?: LangConfig;
  routeFiles?: string[];
};

export type SitemapConfig = BaseSitemapConfig & {
  routeFiles?: string[];
};

export type GetSamplePathsOptions = {
  getCanonicalPath?: (path: string) => string;
  sitemapConfig: SitemapConfig;
};
