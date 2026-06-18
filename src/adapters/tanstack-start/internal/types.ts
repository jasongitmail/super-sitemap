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

export type TanStackStartResolvedRoute = {
  filePath?: string;
  fullPath?: string;
  id?: string;
  path?: string;
  to?: string;
};

/**
 * The router's `routesByPath` map. Typed as `object` rather than
 * `Record<string, unknown>` because TanStack's generated route maps are
 * interfaces, which have no implicit index signature and would not be
 * assignable to a Record type. Entries are validated structurally at runtime.
 */
export type TanStackStartRoutesByPath = object;

export type TanStackStartRouter = {
  routesByPath: TanStackStartRoutesByPath;
};

export type TanStackStartRouterFactory = () => TanStackStartRouter;

export type TanStackStartRouteInput = {
  router: TanStackStartRouterFactory;
};

export type CreateTanStackStartNormalizedRoutesOptions = TanStackStartRouteInput & {
  excludeRoutePatterns?: RegExp[];
};

/**
 * Public sitemap configuration for the TanStack Start adapter.
 *
 * @remarks
 * This type is intentionally explicit instead of composing the core config
 * type. Editor hovers are part of the package DX: consumers should see every
 * config property directly from the adapter entrypoint. Keep this in sync with
 * the SvelteKit config; `sitemap-config-parity.test.ts` enforces the shared
 * shape at typecheck time.
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

  router: TanStackStartRouterFactory;
};

export type GetSamplePathsOptions = BaseGetSamplePathsOptions<SitemapConfig>;
