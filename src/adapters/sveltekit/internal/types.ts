import type { GetSamplePathsOptions as BaseGetSamplePathsOptions } from '../../../core/internal/sample-paths.js';
import type { GetHeadersOptions } from '../../../core/internal/sitemap.js';
import type {
  Changefreq,
  LocalesConfig,
  ParamValues,
  PathObj,
  Priority,
} from '../../../core/internal/types.js';

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
 * Public sitemap configuration for the SvelteKit adapter.
 *
 * @remarks
 * This type is intentionally explicit instead of aliasing the core config type.
 * Editor hovers are part of the package DX: consumers should see every config
 * property directly from the adapter entrypoint. Keep this in sync with the
 * TanStack Start config; `sitemap-config-parity.d.ts` enforces the shared shape
 * at typecheck time.
 */
export type SitemapConfig = {
  additionalPaths?: string[];
  excludeRoutePatterns?: RegExp[];
  headers?: Record<string, string>;
  locales?: LocalesConfig;
  maxPerPage?: number;
  origin: string;
  page?: string;

  /**
   * Parameter values for dynamic routes, where the values can be:
   * - `string[]`
   * - `string[][]`
   * - `ParamValue[]`
   */
  paramValues?: ParamValues;

  /**
   * Optional. Default changefreq, when not specified within a route's
   * `paramValues` objects. Omitting from sitemap config will omit changefreq
   * from all sitemap entries except those where you set `changefreq` property
   * with a route's `paramValues` objects.
   */
  defaultChangefreq?: Changefreq;

  /**
   * Optional. Default priority, when not specified within a route's
   * `paramValues` objects. Omitting from sitemap config will omit priority from
   * all sitemap entries except those where you set `priority` property with a
   * route's `paramValues` objects.
   */
  defaultPriority?: Priority;

  processPaths?: (paths: PathObj[]) => PathObj[];

  /**
   * Optional. Defaults to `false`, preserving generated route order, dynamic
   * `paramValues` order, and `additionalPaths` order. Set to `alpha` to sort all
   * paths alphabetically.
   */
  sort?: 'alpha' | false;
};

/**
 * Internal config used by adapter helpers and tests that inject route files.
 */
export type InternalSvelteKitSitemapConfig = SitemapConfig & {
  routeFiles?: string[];
};

export type GetSamplePathsOptions = BaseGetSamplePathsOptions<SitemapConfig>;
