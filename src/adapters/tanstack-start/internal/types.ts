import type {
  SitemapConfig as BaseSitemapConfig,
  RouteLocaleSlot,
  RouteSource,
  RouteTemplate,
} from '../../../core/internal/types.js';

export type TanStackStartResolvedRoute = {
  filePath?: string;
  fullPath?: string;
  id?: string;
  path?: string;
  to?: string;
};

export type TanStackStartRoutesByPath = object;

export type TanStackStartRouterRoutesByPath = {
  routesByPath: TanStackStartRoutesByPath;
};

export type TanStackStartRouter<
  TRouter extends TanStackStartRouterRoutesByPath = TanStackStartRouterRoutesByPath
> = Pick<TRouter, 'routesByPath'>;

export type TanStackStartRouterFactory<
  TRouter extends TanStackStartRouterRoutesByPath = TanStackStartRouterRoutesByPath
> = () => TanStackStartRouter<TRouter>;

export type TanStackStartLocaleMapping = {
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

export type TanStackStartRouteTemplate = Omit<RouteTemplate, 'source'> & {
  source: TanStackStartRouteSource;
};

export type ParseTanStackStartRouteTemplatesOptions = {
  locale?: TanStackStartLocaleMapping;
};

export type TanStackStartRouteInput<
  TRouter extends TanStackStartRouterRoutesByPath = TanStackStartRouterRoutesByPath
> = {
  router: TanStackStartRouterFactory<TRouter>;
};

export type CreateTanStackStartRouteTemplatesOptions<
  TRouter extends TanStackStartRouterRoutesByPath = TanStackStartRouterRoutesByPath
> = ParseTanStackStartRouteTemplatesOptions & {
  excludeRoutePatterns?: string[];
} & TanStackStartRouteInput<TRouter>;

export type SitemapConfig<
  TRouter extends TanStackStartRouterRoutesByPath = TanStackStartRouterRoutesByPath
> = Omit<BaseSitemapConfig, 'excludeRoutePatterns'> &
  CreateTanStackStartRouteTemplatesOptions<TRouter>;

export type TanStackStartSitemapConfig<
  TRouter extends TanStackStartRouterRoutesByPath = TanStackStartRouterRoutesByPath
> = SitemapConfig<TRouter>;

export type GetTanStackStartHeadersOptions = {
  customHeaders?: Record<string, string>;
};

export type GetSamplePathsOptions<
  TRouter extends TanStackStartRouterRoutesByPath = TanStackStartRouterRoutesByPath
> = {
  getCanonicalPath?: (path: string) => string;
  sitemapConfig: SitemapConfig<TRouter>;
};
