import { deduplicateNormalizedRoutesByCompatibilityKey } from './normalized-routes.js';
import { orderNormalizedRoutes } from './route-ordering.js';
import { selectSamplePaths } from './sample-paths.js';
import {
  getBody as getCoreBody,
  preparePaths,
  response as coreResponse,
  type GetBodyOptions,
  type PreparePathsOptions,
  type ResponseOptions,
} from './sitemap.js';
import type { NormalizedRoute, ParamValues, PathObj } from './types.js';

type ConfigWithParamValues = {
  paramValues?: ParamValues;
};

type FrameworkRouteFactory<Config, Route extends NormalizedRoute> = (config: Config) => Route[];

type FrameworkAdapterOptions<Config, Route extends NormalizedRoute> = {
  config: Config;
  createNormalizedRoutes: FrameworkRouteFactory<Config, Route>;
};

/**
 * Creates the ordered normalized routes shared by all framework entrypoints.
 *
 * @remarks
 * Framework adapters own route discovery and syntax parsing. Core owns the
 * common post-normalization policy: dedupe by compatibility key, then order
 * routes before path generation.
 *
 * @param options - Adapter config and route factory.
 * @returns Deduplicated, ordered normalized routes.
 */
export function createOrderedFrameworkRoutes<
  Config extends ConfigWithParamValues,
  Route extends NormalizedRoute,
>({ config, createNormalizedRoutes }: FrameworkAdapterOptions<Config, Route>): Route[] {
  return orderNormalizedRoutes({
    normalizedRoutes: deduplicateNormalizedRoutesByCompatibilityKey(createNormalizedRoutes(config)),
    paramValues: config.paramValues,
  });
}

/**
 * Generates a sitemap body from framework adapter config.
 *
 * @param options - Adapter config and route factory.
 * @returns Sitemap XML, sitemap index XML, or pagination error body text.
 */
export function getFrameworkAdapterBody<
  Config extends Omit<GetBodyOptions, 'normalizedRoutes'>,
  Route extends NormalizedRoute,
>({ config, createNormalizedRoutes }: FrameworkAdapterOptions<Config, Route>): string {
  return getCoreBody({
    ...config,
    normalizedRoutes: createOrderedFrameworkRoutes({ config, createNormalizedRoutes }),
  });
}

/**
 * Generates a sitemap response from framework adapter config.
 *
 * @param options - Adapter config and route factory.
 * @returns Response containing sitemap XML, sitemap index XML, or pagination error text.
 */
export function getFrameworkAdapterResponse<
  Config extends Omit<ResponseOptions, 'normalizedRoutes'>,
  Route extends NormalizedRoute,
>({ config, createNormalizedRoutes }: FrameworkAdapterOptions<Config, Route>): Response {
  return coreResponse({
    ...config,
    normalizedRoutes: createOrderedFrameworkRoutes({ config, createNormalizedRoutes }),
  });
}

/**
 * Prepares public sitemap paths from framework adapter config.
 *
 * @param options - Adapter config and route factory.
 * @returns Final path objects after generation, processing, dedupe, and sorting.
 */
export function prepareFrameworkAdapterPaths<
  Config extends Omit<PreparePathsOptions, 'normalizedRoutes'>,
  Route extends NormalizedRoute,
>({ config, createNormalizedRoutes }: FrameworkAdapterOptions<Config, Route>): PathObj[] {
  return preparePaths({
    ...config,
    normalizedRoutes: createOrderedFrameworkRoutes({ config, createNormalizedRoutes }),
  });
}

/**
 * Selects sample paths from the same prepared paths used for sitemap output.
 *
 * @param options - Adapter config, route factory, and optional sample canonicalizer.
 * @returns One canonical sample path per sitemap-published route shape.
 */
export function getFrameworkAdapterSamplePaths<
  Config extends Omit<PreparePathsOptions, 'normalizedRoutes'>,
  Route extends NormalizedRoute,
>({
  config,
  createNormalizedRoutes,
  getCanonicalPath,
}: FrameworkAdapterOptions<Config, Route> & {
  getCanonicalPath?: (path: string) => string;
}): string[] {
  const normalizedRoutes = createOrderedFrameworkRoutes({ config, createNormalizedRoutes });

  return selectSamplePaths({
    getCanonicalPath,
    normalizedRoutes,
    paths: preparePaths({ ...config, normalizedRoutes }),
  });
}
