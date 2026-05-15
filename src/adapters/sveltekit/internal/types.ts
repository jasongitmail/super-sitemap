import type {
  SitemapConfig as BaseSitemapConfig,
  LangConfig,
} from '../../../core/internal/types.js';

/**
 * Options for creating normalized route templates from SvelteKit page route files.
 */
export type CreateSvelteKitRouteTemplatesOptions = {
  excludeRoutePatterns?: string[];
  lang?: LangConfig;
  routeFiles?: string[];
};

export type SitemapConfig = BaseSitemapConfig & {
  routeFiles?: string[];
};

export type SvelteKitSitemapConfig = SitemapConfig;

export type GetSvelteKitHeadersOptions = {
  customHeaders?: Record<string, string>;
};
