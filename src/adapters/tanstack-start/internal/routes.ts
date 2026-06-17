import { normalizePath, splitPath, toPath } from '../../../core/internal/paths.js';
import { routeMatchesPattern } from '../../../core/internal/route-exclusion.js';
import type { RouteLocaleSlot, RouteParam, RouteSegment } from '../../../core/internal/types.js';
import type {
  CreateTanStackStartNormalizedRoutesOptions,
  TanStackStartNormalizedRoute,
  TanStackStartResolvedRoute,
  TanStackStartRouteInput,
  TanStackStartRouteSource,
} from './types.js';

const OPTIONAL_PARAM_SEGMENT_REGEX = /^\{-\$([^}]+)\}$/;

type TanStackStartRouteRecord = {
  filePath?: string;
  fullPath?: string;
  id?: string;
  path?: string;
  routesByPathKey?: string;
  serverOnly?: boolean;
  to?: string;
};

type ParsedSegment =
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

type SegmentVariant = {
  compatibilityKeySegment?: string;
  localeMode?: RouteLocaleSlot['mode'];
  segment?: RouteSegment;
};

export function createTanStackStartNormalizedRoutes({
  excludeRoutePatterns = [],
  ...routeInput
}: CreateTanStackStartNormalizedRoutesOptions): TanStackStartNormalizedRoute[] {
  const routeRecords = getTanStackStartRouteRecordsFromRoutesByPath(routeInput);
  const normalizedRoutesByCompatibilityKey = new Map<string, TanStackStartNormalizedRoute>();

  for (const route of routeRecords) {
    const normalizedRoutes = parseTanStackStartNormalizedRoutes(route).filter(
      (normalizedRoute) =>
        !excludeRoutePatterns.some((pattern) =>
          routeMatchesPattern(pattern, normalizedRoute.source.compatibilityKey)
        )
    );

    for (const normalizedRoute of normalizedRoutes) {
      if (!normalizedRoutesByCompatibilityKey.has(normalizedRoute.source.compatibilityKey)) {
        normalizedRoutesByCompatibilityKey.set(
          normalizedRoute.source.compatibilityKey,
          normalizedRoute
        );
      }
    }
  }

  return [...normalizedRoutesByCompatibilityKey.values()].sort((a, b) =>
    a.source.compatibilityKey.localeCompare(b.source.compatibilityKey)
  );
}

function getTanStackStartRouteRecordsFromRoutesByPath(
  routeInput: TanStackStartRouteInput
): TanStackStartRouteRecord[] {
  if (typeof routeInput.router !== 'function') {
    throw new Error("super-sitemap: `router` must be your app's `getRouter` function.");
  }

  const routesByPath = routeInput.router().routesByPath;

  if (!routesByPath) {
    throw new Error('super-sitemap: `router` must return a router with `routesByPath`.');
  }

  return Object.entries(routesByPath)
    .map(([routesByPathKey, route]) => createTanStackStartRouteRecord(routesByPathKey, route))
    .filter(isEmittableRouteRecord)
    .sort((a, b) => getCompatibilityPath(a).localeCompare(getCompatibilityPath(b)));
}

/**
 * Normalizes TanStack's generated route records without depending on their exact exported type.
 */
function createTanStackStartRouteRecord(
  routesByPathKey: string,
  route: unknown
): TanStackStartRouteRecord {
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

function parseTanStackStartNormalizedRoutes(
  route: TanStackStartRouteRecord | string
): TanStackStartNormalizedRoute[] {
  const routeRecord = typeof route === 'string' ? { fullPath: route } : route;
  const sourcePath = getCompatibilityPath(routeRecord);
  const parsedSegments = splitPath(sourcePath).map(parseTanStackStartSegment);
  const variants = expandSegmentVariants(parsedSegments);

  return variants.map((segments) =>
    createNormalizedRoute({
      compatibilityKey: toPath(segments.map((segment) => segment.compatibilityKeySegment)),
      routeRecord,
      routeSegmentVariants: segments,
    })
  );
}

function createNormalizedRoute({
  compatibilityKey,
  routeRecord,
  routeSegmentVariants,
}: {
  compatibilityKey: string;
  routeRecord: TanStackStartRouteRecord;
  routeSegmentVariants: SegmentVariant[];
}): TanStackStartNormalizedRoute {
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
    source: stripUndefinedRouteSource({
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

function stripUndefinedRouteSource(source: TanStackStartRouteSource): TanStackStartRouteSource {
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined)
  ) as TanStackStartRouteSource;
}

function isEmittableRouteRecord(route: TanStackStartRouteRecord): boolean {
  if (route.id === '__root__') return false;
  if (route.serverOnly) return false;
  if (!hasRoutePathField(route)) return false;

  const sourcePath = getCompatibilityPath(route);
  if (sourcePath === '/') return true;

  return splitPath(sourcePath).some((segment) => !isPathlessSegment(segment));
}

function hasRoutePathField(route: TanStackStartRouteRecord): boolean {
  return (
    typeof route.fullPath === 'string' ||
    typeof route.to === 'string' ||
    typeof route.path === 'string' ||
    typeof route.routesByPathKey === 'string' ||
    typeof route.id === 'string'
  );
}

function expandSegmentVariants(segments: ParsedSegment[]): SegmentVariant[][] {
  let variants: SegmentVariant[][] = [[]];

  for (const segment of segments) {
    const additions = getSegmentVariants(segment);
    variants = variants.flatMap((variant) =>
      additions.map((addition) => (addition ? [...variant, addition] : variant))
    );
  }

  return variants.length ? variants : [[]];
}

function getSegmentVariants(segment: ParsedSegment): Array<SegmentVariant | undefined> {
  if (segment.kind === 'omit') {
    return [undefined];
  }

  if (segment.kind === 'static') {
    return [
      {
        compatibilityKeySegment: segment.value,
        segment: { kind: 'static', value: segment.value },
      },
    ];
  }

  const isRestParam = segment.kind === 'param' && segment.rest;
  const compatibilityKeySegment = isRestParam ? '$' : `$${segment.name}`;
  const optionalCompatibilityKeySegment =
    segment.kind === 'optional-param' ? `{-$${segment.name}}` : compatibilityKeySegment;

  if (segment.name === 'locale') {
    return [
      {
        compatibilityKeySegment: optionalCompatibilityKeySegment,
        localeMode: segment.kind === 'optional-param' ? 'optional' : 'required',
        segment: {
          kind: 'locale',
          name: segment.name,
        },
      },
    ];
  }

  const paramVariant = {
    compatibilityKeySegment: optionalCompatibilityKeySegment,
    segment: {
      kind: 'param',
      name: segment.name,
      rest: segment.kind === 'param' ? segment.rest : false,
    },
  } satisfies SegmentVariant;

  if (segment.kind === 'optional-param') {
    return [undefined, paramVariant];
  }

  return [paramVariant];
}

function hasRouteSegment(
  variant: SegmentVariant
): variant is SegmentVariant & { segment: RouteSegment } {
  return variant.segment !== undefined;
}

function getCompatibilityPath(route: TanStackStartRouteRecord): string {
  return normalizePath(
    route.fullPath ?? route.to ?? route.path ?? route.routesByPathKey ?? route.id ?? '/'
  );
}

function parseTanStackStartSegment(segment: string): ParsedSegment {
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

function isPathlessSegment(segment: string): boolean {
  return (
    segment === 'index' ||
    segment === '__root__' ||
    segment.startsWith('_') ||
    (segment.startsWith('(') && segment.endsWith(')'))
  );
}
