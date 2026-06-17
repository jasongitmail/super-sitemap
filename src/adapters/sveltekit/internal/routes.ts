import { routeMatchesPattern } from '../../../core/internal/route-exclusion.js';
import type {
  LocalesConfig,
  NormalizedRoute,
  ParamValues,
  RouteLocaleSlot,
  RouteParam,
  RouteSegment,
} from '../../../core/internal/types.js';
import type { CreateSvelteKitNormalizedRoutesOptions } from './types.js';

const LOCALE_TOKEN_REGEX = /\/?\[(\[locale(=[a-z]+)?\]|locale(=[a-z]+)?)\]/;
const LEGACY_LANG_TOKEN_REGEX = /\/?\[(\[lang(=[a-z]+)?\]|lang(=[a-z]+)?)\]/;
const PAGE_ROUTE_FILE_REGEX = /\/\+page.*\.(svelte|md|svx)$/;
const PARAM_SEGMENT_REGEX = /^\[(\[?)(\.\.\.)?([^\]=]+)(?:=([^\]]+))?\]?\]$/;
const ROUTE_GROUP_REGEX = /\/\([^)]+\)/g;
const SRC_ROUTES_PREFIX = '/src/routes';

type ParseSvelteKitNormalizedRouteOptions = {
  filePath?: string;
  route: string;
};

type ParsedSvelteKitParamSegment = {
  matcher?: string;
  name: string;
  optional: boolean;
  rest?: boolean;
};

/**
 * Creates normalized routes from SvelteKit page route files.
 */
export function createSvelteKitNormalizedRoutes({
  excludeRoutePatterns = [],
  locales = { alternates: [], default: 'en' },
  routeFiles = discoverSvelteKitPageRouteFiles(),
}: CreateSvelteKitNormalizedRoutesOptions): NormalizedRoute[] {
  validateSvelteKitLocaleConfig(routeFiles, locales);

  const routeEntries = routeFiles
    .map((filePath) => ({
      filePath,
      route: normalizeSvelteKitRouteFile(filePath),
    }))
    .filter(
      ({ route }) => !excludeRoutePatterns.some((pattern) => routeMatchesPattern(pattern, route))
    )
    .map(({ filePath, route }) => ({
      filePath,
      route: removeSvelteKitRouteGroups(route),
    }))
    .sort((a, b) => a.route.localeCompare(b.route))
    .flatMap(({ filePath, route }) =>
      expandSvelteKitOptionalRoutes([route]).map((expandedRoute) => ({
        filePath,
        route: expandedRoute,
      }))
    );

  const normalizedRoutesByRoute = new Map(
    routeEntries.map(({ filePath, route }) => [
      route,
      parseSvelteKitNormalizedRoute({ filePath, route }),
    ])
  );

  return [...normalizedRoutesByRoute.values()];
}

/**
 * Discovers SvelteKit page route files using Vite's glob import metadata.
 * Endpoints such as +server.ts are intentionally excluded.
 */
export function discoverSvelteKitPageRouteFiles(): string[] {
  const svelteRoutes = Object.keys(import.meta.glob('/src/routes/**/+page*.svelte'));
  const mdRoutes = Object.keys(import.meta.glob('/src/routes/**/+page*.md'));
  const svxRoutes = Object.keys(import.meta.glob('/src/routes/**/+page*.svx'));

  return svelteRoutes.concat(mdRoutes, svxRoutes);
}

/**
 * Converts a SvelteKit page route file path into the route key shape used by
 * adapter config such as paramValues and excludeRoutePatterns.
 */
export function normalizeSvelteKitRouteFile(filePath: string): string {
  let route = filePath.startsWith(SRC_ROUTES_PREFIX)
    ? filePath.slice(SRC_ROUTES_PREFIX.length)
    : filePath;

  route = route.replace(PAGE_ROUTE_FILE_REGEX, '');
  return route || '/';
}

/**
 * Removes decorative route groups after exclusions have run.
 */
export function removeSvelteKitRouteGroups(route: string): string {
  const normalized = route.replaceAll(ROUTE_GROUP_REGEX, '');
  return normalized || '/';
}

/**
 * Given an array of SvelteKit route keys, return a new array that includes all
 * valid SvelteKit variants for routes that contain optional params other than
 * the locale param.
 */
export function expandSvelteKitOptionalRoutes(routes: string[]): string[] {
  const processedRoutes = routes.flatMap((route) => {
    const routeWithoutLocaleIfAny = route.replace(findSvelteKitLocaleToken(), '');
    return /\[\[.*\]\]/.test(routeWithoutLocaleIfAny) ? expandSvelteKitOptionalRoute(route) : route;
  });

  return Array.from(new Set(processedRoutes));
}

/**
 * Expands one SvelteKit route containing optional parameters into the route
 * variants SvelteKit considers valid.
 */
export function expandSvelteKitOptionalRoute(originalRoute: string): string[] {
  const hasLocale = findSvelteKitLocaleToken().exec(originalRoute);
  const route = hasLocale ? originalRoute.replace(findSvelteKitLocaleToken(), '') : originalRoute;

  let results: string[] = [];

  results.push(route.slice(0, route.indexOf('[[') - 1));

  const remaining = route.slice(route.indexOf('[['));
  const segments = remaining.split('/').filter(Boolean);

  let j = 1;
  for (const segment of segments) {
    if (!results[j]) results[j] = results[j - 1];

    results[j] = `${results[j]}/${segment}`;

    if (segment.startsWith('[[')) {
      j++;
    }
  }

  if (hasLocale) {
    const locale = hasLocale[0];
    results = results.map(
      (result) => `${result.slice(0, hasLocale.index)}${locale}${result.slice(hasLocale.index)}`
    );
  }

  if (!results[0].length) results[0] = '/';

  return results;
}

/**
 * Creates a regex matching SvelteKit optional or required locale route tokens.
 */
export function findSvelteKitLocaleToken(): RegExp {
  return new RegExp(LOCALE_TOKEN_REGEX);
}

/**
 * Converts a SvelteKit route key into Super Sitemap's normalized route IR.
 */
export function parseSvelteKitNormalizedRoute({
  filePath,
  route,
}: ParseSvelteKitNormalizedRouteOptions): NormalizedRoute {
  const segments: RouteSegment[] = [];
  const params: RouteParam[] = [];
  let locale: RouteLocaleSlot | undefined;

  const routeSegments = route === '/' ? [] : route.split('/').filter(Boolean);

  routeSegments.forEach((segment, segmentIndex) => {
    const parsedParam = parseSvelteKitParamSegment(segment);

    if (!parsedParam) {
      segments.push({ kind: 'static', value: segment });
      return;
    }

    if (parsedParam.name === 'locale') {
      segments.push({
        kind: 'locale',
        matcher: parsedParam.matcher,
        name: parsedParam.name,
      });
      locale = {
        matcher: parsedParam.matcher,
        mode: parsedParam.optional ? 'optional' : 'required',
        paramName: parsedParam.name,
        segmentIndex,
      };
      return;
    }

    segments.push({
      kind: 'param',
      matcher: parsedParam.matcher,
      name: parsedParam.name,
      rest: parsedParam.rest,
    });
    params.push({
      matcher: parsedParam.matcher,
      name: parsedParam.name,
      rest: parsedParam.rest,
      segmentIndex,
    });
  });

  return {
    id: route,
    locale,
    params,
    segments,
    source: {
      adapter: 'sveltekit',
      compatibilityKey: route,
      filePath,
    },
  };
}

/**
 * Orders SvelteKit normalized routes to preserve the SvelteKit adapter's path output order.
 */
export function orderSvelteKitNormalizedRoutesForCompatibility({
  normalizedRoutes,
  paramValues = {},
}: {
  normalizedRoutes: NormalizedRoute[];
  paramValues?: ParamValues;
}): NormalizedRoute[] {
  const normalizedRoutesByCompatibilityKey = new Map(
    normalizedRoutes.map((normalizedRoute) => [
      normalizedRoute.source.compatibilityKey,
      normalizedRoute,
    ])
  );
  const dynamicRoutesInParamValueOrderWithoutLocale: NormalizedRoute[] = [];
  const dynamicRoutesInParamValueOrderWithLocale: NormalizedRoute[] = [];
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

  const staticRoutesWithoutLocale: NormalizedRoute[] = [];
  const staticRoutesWithLocale: NormalizedRoute[] = [];
  const remainingDynamicRoutesWithoutLocale: NormalizedRoute[] = [];
  const remainingDynamicRoutesWithLocale: NormalizedRoute[] = [];

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
 * Requires explicit locale config when SvelteKit routes contain a locale token.
 */
export function validateSvelteKitLocaleConfig(routeFiles: string[], locales: LocalesConfig): void {
  const routesContainLegacyLangParam = routeFiles.some((route) =>
    findSvelteKitLegacyLangToken().test(route)
  );

  if (routesContainLegacyLangParam) {
    throw new Error(
      'super-sitemap: v2 recognizes locale routes by a param named `locale`. Rename `[lang]`/`[[lang]]` to `[locale]`/`[[locale]]`.'
    );
  }

  const routesContainLocaleParam = routeFiles.some((route) =>
    findSvelteKitLocaleToken().test(route)
  );

  if (routesContainLocaleParam && (!locales?.default || !locales?.alternates.length)) {
    throw new Error(
      'super-sitemap: `locales` property is required in sitemap config because one or more routes contain [[locale]].'
    );
  }
}

function findSvelteKitLegacyLangToken(): RegExp {
  return new RegExp(LEGACY_LANG_TOKEN_REGEX);
}

/**
 * Parses a SvelteKit parameter segment into normalized metadata.
 */
function parseSvelteKitParamSegment(segment: string): ParsedSvelteKitParamSegment | undefined {
  const match = PARAM_SEGMENT_REGEX.exec(segment);
  if (!match) return undefined;

  return {
    matcher: match[4],
    name: match[3] ?? '',
    optional: match[1] === '[',
    rest: match[2] === '...',
  };
}

/**
 * Checks whether a normalized route has params other than the locale slot.
 */
function hasNonLocaleParams(normalizedRoute: NormalizedRoute): boolean {
  return normalizedRoute.segments.some((segment) => segment.kind === 'param');
}
