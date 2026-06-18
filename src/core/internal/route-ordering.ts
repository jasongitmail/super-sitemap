import type { NormalizedRoute, ParamValues } from './types.js';

/**
 * Orders normalized routes before path generation.
 *
 * Static routes are emitted before dynamic routes, dynamic routes with
 * `paramValues` follow the user's config key order, and remaining dynamic routes
 * preserve adapter discovery order. Locale routes stay after non-locale routes
 * within those buckets. Final path sorting still belongs to `sort: 'alpha'`
 * after path generation, processing, and deduplication.
 */
export function orderNormalizedRoutes<Route extends NormalizedRoute>({
  normalizedRoutes,
  paramValues = {},
}: {
  normalizedRoutes: Route[];
  paramValues?: ParamValues;
}): Route[] {
  const normalizedRoutesByCompatibilityKey = new Map<string, Route>(
    normalizedRoutes.map((normalizedRoute) => [
      normalizedRoute.source.compatibilityKey,
      normalizedRoute,
    ])
  );
  const dynamicRoutesInParamValueOrderWithoutLocale: Route[] = [];
  const dynamicRoutesInParamValueOrderWithLocale: Route[] = [];
  const usedDynamicRouteKeys = new Set<string>();

  for (const paramValueKey in paramValues) {
    const normalizedRoute = normalizedRoutesByCompatibilityKey.get(paramValueKey);
    if (normalizedRoute && hasNonLocaleParams(normalizedRoute)) {
      if (normalizedRoute.locale) {
        dynamicRoutesInParamValueOrderWithLocale.push(normalizedRoute);
      } else {
        dynamicRoutesInParamValueOrderWithoutLocale.push(normalizedRoute);
      }
      usedDynamicRouteKeys.add(paramValueKey);
    }
  }

  const staticRoutesWithoutLocale: Route[] = [];
  const staticRoutesWithLocale: Route[] = [];
  const remainingDynamicRoutesWithoutLocale: Route[] = [];
  const remainingDynamicRoutesWithLocale: Route[] = [];

  for (const normalizedRoute of normalizedRoutes) {
    if (!hasNonLocaleParams(normalizedRoute)) {
      if (normalizedRoute.locale) {
        staticRoutesWithLocale.push(normalizedRoute);
      } else {
        staticRoutesWithoutLocale.push(normalizedRoute);
      }
      continue;
    }

    if (!usedDynamicRouteKeys.has(normalizedRoute.source.compatibilityKey)) {
      if (normalizedRoute.locale) {
        remainingDynamicRoutesWithLocale.push(normalizedRoute);
      } else {
        remainingDynamicRoutesWithoutLocale.push(normalizedRoute);
      }
    }
  }

  return [
    ...staticRoutesWithoutLocale,
    ...dynamicRoutesInParamValueOrderWithoutLocale,
    ...remainingDynamicRoutesWithoutLocale,
    ...staticRoutesWithLocale,
    ...dynamicRoutesInParamValueOrderWithLocale,
    ...remainingDynamicRoutesWithLocale,
  ];
}

/**
 * Checks whether a normalized route has params other than the locale slot.
 */
function hasNonLocaleParams(normalizedRoute: NormalizedRoute): boolean {
  return normalizedRoute.segments.some((segment) => segment.kind === 'param');
}
