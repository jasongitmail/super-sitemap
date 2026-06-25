import { deduplicateNormalizedRoutesByCompatibilityKey } from '../../../core/internal/normalized-routes.js';
import { expandOptionalSegmentPrefixVariants } from '../../../core/internal/optional-route-variants.js';
import { normalizePath, splitPath, toPath } from '../../../core/internal/paths.js';
import {
  routeMatchesPattern,
  validateExcludeRoutePatterns,
} from '../../../core/internal/route-exclusion.js';
import type {
  NormalizedRoute,
  RouteLocaleSlot,
  RouteParam,
  RouteSegment,
} from '../../../core/internal/types.js';
import type {
  CreateTanStackStartNormalizedRoutesOptions,
  TanStackStartResolvedRoute,
  TanStackStartRouteInput,
} from './types.js';

const OPTIONAL_PARAM_SEGMENT_REGEX = /^\{-\$([^}]+)\}$/;

type DiscoveredRouteRecord = {
  filePath?: string;
  fullPath?: string;
  id?: string;
  path?: string;
  routesByPathKey?: string;
  serverOnly?: boolean;
  to?: string;
};

type ParsedRouteSegment =
  | {
      kind: 'omit';
    }
  | {
      kind: 'optional-param';
      name: string;
    }
  | {
      kind: 'param';
      name: string;
      rest: boolean;
    }
  | {
      kind: 'static';
      value: string;
    };

type RouteSegmentVariant = {
  compatibilityKeySegment?: string;
  localeMode?: RouteLocaleSlot['mode'];
  segment?: RouteSegment;
};

/**
 * Creates normalized sitemap routes from TanStack Start's generated router.
 */
export function createTanStackStartNormalizedRoutes({
  excludeRoutePatterns = [],
  ...routeInput
}: CreateTanStackStartNormalizedRoutesOptions): NormalizedRoute[] {
  validateExcludeRoutePatterns(excludeRoutePatterns);
  const routeRecords = getTanStackStartRouteRecordsFromRoutesByPath(routeInput);
  const normalizedRoutes: NormalizedRoute[] = [];

  for (const route of routeRecords) {
    const routeNormalizedRoutes = convertToNormalizedRoutes(route).filter(
      (normalizedRoute) =>
        !excludeRoutePatterns.some((pattern) =>
          routeMatchesPattern(pattern, normalizedRoute.source.compatibilityKey)
        )
    );

    normalizedRoutes.push(...routeNormalizedRoutes);
  }

  return deduplicateNormalizedRoutesByCompatibilityKey(normalizedRoutes);
}

/**
 * Reads TanStack Start's `routesByPath` map and converts it into sitemap route records.
 */
function getTanStackStartRouteRecordsFromRoutesByPath(
  routeInput: TanStackStartRouteInput
): DiscoveredRouteRecord[] {
  if (typeof routeInput.router !== 'function') {
    throw new Error("super-sitemap: `router` must be your app's `getRouter` function.");
  }

  const routesByPath = routeInput.router().routesByPath;

  if (!routesByPath) {
    throw new Error('super-sitemap: `router` must return a router with `routesByPath`.');
  }

  return Object.entries(routesByPath)
    .map(([routesByPathKey, route]) => createTanStackStartRouteRecord(routesByPathKey, route))
    .filter(shouldIncludeInSitemap);
}

/**
 * Normalizes TanStack's generated route records without depending on their exact exported type.
 */
function createTanStackStartRouteRecord(
  routesByPathKey: string,
  route: unknown
): DiscoveredRouteRecord {
  const routeRecord = isRouteRecordObject(route) ? route : {};

  return {
    filePath: getOptionalStringRouteField(routeRecord, 'filePath'),
    fullPath: getOptionalStringRouteField(routeRecord, 'fullPath'),
    id: getOptionalStringRouteField(routeRecord, 'id'),
    path: getOptionalStringRouteField(routeRecord, 'path'),
    routesByPathKey,
    serverOnly: isServerOnlyRoute(routeRecord),
    to: getOptionalStringRouteField(routeRecord, 'to'),
  };
}

/**
 * Checks whether a route entry can contain route metadata fields.
 */
function isRouteRecordObject(route: unknown): route is Record<string, unknown> {
  return typeof route === 'object' && route !== null;
}

/**
 * Detects routes that declare server handlers but render no component, such as
 * the sitemap endpoint itself, robots.txt, or API routes. These are excluded
 * from the sitemap automatically, mirroring the SvelteKit adapter's pages-only
 * discovery, so users never have to exclude their sitemap route from its own
 * output. Routes with a component are always kept, even when they also declare
 * server handlers, so a misread shape can never silently drop a page.
 */
function isServerOnlyRoute(route: Record<string, unknown>): boolean {
  const options = route['options'];
  if (typeof options !== 'object' || options === null) return false;

  const routeOptions = options as Record<string, unknown>;
  const server = routeOptions['server'];
  const component = routeOptions['component'];
  return server !== null && server !== undefined && (component === null || component === undefined);
}

/**
 * Reads a route metadata field only when TanStack exposes it as a string.
 */
function getOptionalStringRouteField(
  route: Record<string, unknown>,
  field: keyof TanStackStartResolvedRoute
): string | undefined {
  const value = route[field];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Converts a discovered TanStack route into one or more normalized sitemap routes.
 */
function convertToNormalizedRoutes(route: DiscoveredRouteRecord | string): NormalizedRoute[] {
  const routeRecord = typeof route === 'string' ? { fullPath: route } : route;
  const sourcePath = getCompatibilityKey(routeRecord);
  const parsedSegments = splitPath(sourcePath).map(parseRouteSegment);
  const variants = expandOptionalParamRouteVariants(parsedSegments);

  return variants.map((segments) =>
    createNormalizedRoute({
      compatibilityKey: toPath(segments.map((segment) => segment.compatibilityKeySegment)),
      routeRecord,
      routeSegmentVariants: segments,
    })
  );
}

/**
 * Builds the normalized route object and extracts route params from segment variants.
 */
function createNormalizedRoute({
  compatibilityKey,
  routeRecord,
  routeSegmentVariants,
}: {
  compatibilityKey: string;
  routeRecord: DiscoveredRouteRecord;
  routeSegmentVariants: RouteSegmentVariant[];
}): NormalizedRoute {
  const params: RouteParam[] = [];
  let locale: RouteLocaleSlot | undefined;
  const routeSegmentEntries = routeSegmentVariants.filter(hasRouteSegment);
  const routeSegments = routeSegmentEntries.map(({ segment }) => segment);

  routeSegmentEntries.forEach(({ localeMode, segment }, segmentIndex) => {
    if (segment.kind === 'locale') {
      locale = {
        matcher: segment.matcher,
        mode: localeMode ?? 'required',
        paramName: segment.name,
        segmentIndex,
      };
      return;
    }

    if (segment.kind === 'param') {
      params.push({
        matcher: segment.matcher,
        name: segment.name,
        rest: segment.rest ?? false,
        segmentIndex,
      });
    }
  });

  return {
    id: compatibilityKey,
    locale,
    params,
    segments: routeSegments,
    source: stripUndefinedFields({
      adapter: 'tanstack-start',
      compatibilityKey,
      filePath: routeRecord.filePath,
      fullPath: routeRecord.fullPath,
      id: routeRecord.id,
      path: routeRecord.path,
      to: routeRecord.to,
    }),
  };
}

/**
 * Removes undefined fields so normalized route source metadata stays compact.
 */
function stripUndefinedFields<T extends object>(source: T): T {
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined)) as T;
}

/**
 * Determines whether a discovered TanStack route should appear in a sitemap.
 */
function shouldIncludeInSitemap(route: DiscoveredRouteRecord): boolean {
  if (route.id === '__root__') return false;
  if (route.serverOnly) return false;
  if (!hasSourceForCompatibilityKey(route)) return false;

  const sourcePath = getCompatibilityKey(route);
  if (sourcePath === '/') return true;

  return splitPath(sourcePath).some((segment) => !isPathlessSegment(segment));
}

/**
 * Checks whether TanStack exposed enough route metadata to create a route key.
 */
function hasSourceForCompatibilityKey(route: DiscoveredRouteRecord): boolean {
  return (
    typeof route.fullPath === 'string' ||
    typeof route.to === 'string' ||
    typeof route.path === 'string' ||
    typeof route.routesByPathKey === 'string' ||
    typeof route.id === 'string'
  );
}

/**
 * Expands TanStack optional path params into the route key variants they can emit.
 */
function expandOptionalParamRouteVariants(segments: ParsedRouteSegment[]): RouteSegmentVariant[][] {
  let routeVariants: RouteSegmentVariant[][] = [[]];
  let pendingOptionalPathParams: RouteSegmentVariant[] = [];

  for (const segment of segments) {
    if (segment.kind === 'omit') {
      continue;
    }

    if (isOptionalPathParam(segment)) {
      pendingOptionalPathParams.push(toRouteSegmentVariant(segment));
      continue;
    }

    routeVariants = expandOptionalSegmentPrefixVariants(routeVariants, pendingOptionalPathParams);
    pendingOptionalPathParams = [];

    routeVariants = routeVariants.map((variant) => [...variant, toRouteSegmentVariant(segment)]);
  }

  return expandOptionalSegmentPrefixVariants(routeVariants, pendingOptionalPathParams);
}

/**
 * Detects optional route params that consume ordered URL path segments.
 */
function isOptionalPathParam(
  segment: ParsedRouteSegment
): segment is Extract<ParsedRouteSegment, { kind: 'optional-param' }> {
  return segment.kind === 'optional-param' && segment.name !== 'locale';
}

/**
 * Converts an emitted TanStack segment into a normalized route segment variant.
 */
function toRouteSegmentVariant(
  segment: Exclude<ParsedRouteSegment, { kind: 'omit' }>
): RouteSegmentVariant {
  if (segment.kind === 'static') {
    return {
      compatibilityKeySegment: segment.value,
      segment: { kind: 'static', value: segment.value },
    };
  }

  const isRestParam = segment.kind === 'param' && segment.rest;
  const compatibilityKeySegment = isRestParam ? '$' : `$${segment.name}`;
  const optionalCompatibilityKeySegment =
    segment.kind === 'optional-param' ? `{-$${segment.name}}` : compatibilityKeySegment;

  if (segment.name === 'locale') {
    return {
      compatibilityKeySegment: optionalCompatibilityKeySegment,
      localeMode: segment.kind === 'optional-param' ? 'optional' : 'required',
      segment: {
        kind: 'locale',
        name: segment.name,
      },
    };
  }

  return {
    compatibilityKeySegment: optionalCompatibilityKeySegment,
    segment: {
      kind: 'param',
      name: segment.name,
      rest: segment.kind === 'param' ? segment.rest : false,
    },
  } satisfies RouteSegmentVariant;
}

/**
 * Narrows a route segment variant to one that contributes a sitemap path segment.
 */
function hasRouteSegment(
  variant: RouteSegmentVariant
): variant is RouteSegmentVariant & { segment: RouteSegment } {
  return variant.segment !== undefined;
}

/**
 * Chooses the best available TanStack route field for the public compatibility key.
 */
function getCompatibilityKey(route: DiscoveredRouteRecord): string {
  return normalizePath(
    route.fullPath ?? route.to ?? route.path ?? route.routesByPathKey ?? route.id ?? '/'
  );
}

/**
 * Parses a TanStack route segment into the normalized intermediate segment model.
 */
function parseRouteSegment(segment: string): ParsedRouteSegment {
  if (isPathlessSegment(segment)) {
    return { kind: 'omit' };
  }

  if (segment === '$') {
    return { kind: 'param', name: '_splat', rest: true };
  }

  const optionalParamMatch = OPTIONAL_PARAM_SEGMENT_REGEX.exec(segment);
  if (optionalParamMatch) {
    return { kind: 'optional-param', name: optionalParamMatch[1] ?? '' };
  }

  if (segment.startsWith('$')) {
    return { kind: 'param', name: segment.slice(1), rest: false };
  }

  return { kind: 'static', value: segment };
}

/**
 * Detects TanStack route segments that organize route files but do not emit URL path segments.
 */
function isPathlessSegment(segment: string): boolean {
  return (
    segment === 'index' ||
    segment === '__root__' ||
    segment.startsWith('_') ||
    (segment.startsWith('(') && segment.endsWith(')'))
  );
}
