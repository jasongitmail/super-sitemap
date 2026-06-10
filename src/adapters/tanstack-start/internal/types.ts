import type { GetHeadersOptions } from '../../../core/internal/sitemap.js';
import type {
  SitemapConfig as BaseSitemapConfig,
  NormalizedRoute,
  RouteLocaleSlot,
  RouteSource,
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

/**
 * Declares which route param holds the language value from the `lang` config,
 * e.g. `{ paramName: 'locale', mode: 'optional' }` for `/{-$locale}/about`.
 */
export type TanStackStartLangParamConfig = {
  matcher?: string;
  mode: RouteLocaleSlot['mode'];
  paramName: string;
};

export type TanStackStartRouteSource = RouteSource & {
  fullPath?: string;
  id?: string;
  path?: string;
  to?: string;
};

export type TanStackStartNormalizedRoute = Omit<NormalizedRoute, 'source'> & {
  source: TanStackStartRouteSource;
};

export type ParseTanStackStartNormalizedRoutesOptions = {
  langParam?: TanStackStartLangParamConfig;
};

export type TanStackStartRouteInput = {
  router: TanStackStartRouterFactory;
};

export type CreateTanStackStartNormalizedRoutesOptions = ParseTanStackStartNormalizedRoutesOptions &
  TanStackStartRouteInput & {
    excludeRoutePatterns?: string[];
  };

export type SitemapConfig = Omit<BaseSitemapConfig, 'excludeRoutePatterns'> &
  CreateTanStackStartNormalizedRoutesOptions;

export type GetSamplePathsOptions = {
  getCanonicalPath?: (path: string) => string;
  sitemapConfig: SitemapConfig;
};
