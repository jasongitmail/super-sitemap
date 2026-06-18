import type { GetSamplePathsOptions as BaseGetSamplePathsOptions } from '../../../core/internal/sample-paths.js';
import type { GetHeadersOptions } from '../../../core/internal/sitemap.js';
import type {
  SitemapConfig as BaseSitemapConfig,
  NormalizedRoute,
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

export type TanStackStartRouteSource = RouteSource & {
  fullPath?: string;
  id?: string;
  path?: string;
  to?: string;
};

export type TanStackStartNormalizedRoute = Omit<NormalizedRoute, 'source'> & {
  source: TanStackStartRouteSource;
};

export type TanStackStartRouteInput = {
  router: TanStackStartRouterFactory;
};

export type CreateTanStackStartNormalizedRoutesOptions = TanStackStartRouteInput & {
  excludeRoutePatterns?: RegExp[];
};

export type SitemapConfig = BaseSitemapConfig & TanStackStartRouteInput;

export type GetSamplePathsOptions = BaseGetSamplePathsOptions<SitemapConfig>;
