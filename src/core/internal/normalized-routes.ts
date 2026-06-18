import type { NormalizedRoute } from './types.js';

/**
 * Deduplicates framework-discovered routes after adapter normalization.
 *
 * @remarks
 * This protects against multiple framework records collapsing to the same
 * public route key after route groups are removed, optional route variants are
 * expanded, or router records resolve to the same full path. It keeps the first
 * normalized route because adapter discovery order is already deterministic.
 *
 * This does not deduplicate duplicate `paramValues`; repeated parameter values
 * become duplicate concrete paths and are handled later by path-level dedupe.
 *
 * @param normalizedRoutes - Normalized routes produced by a framework adapter.
 * @returns Routes with unique compatibility keys.
 */
export function deduplicateNormalizedRoutesByCompatibilityKey<Route extends NormalizedRoute>(
  normalizedRoutes: Route[]
): Route[] {
  const normalizedRoutesByCompatibilityKey = new Map<string, Route>();

  for (const normalizedRoute of normalizedRoutes) {
    const compatibilityKey = normalizedRoute.source.compatibilityKey;
    if (!normalizedRoutesByCompatibilityKey.has(compatibilityKey)) {
      normalizedRoutesByCompatibilityKey.set(compatibilityKey, normalizedRoute);
    }
  }

  return [...normalizedRoutesByCompatibilityKey.values()];
}
