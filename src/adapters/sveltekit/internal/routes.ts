import { deduplicateNormalizedRoutesByCompatibilityKey } from '../../../core/internal/normalized-routes.js';
import { expandOptionalSegmentPrefixVariants } from '../../../core/internal/optional-route-variants.js';
import {
  routeMatchesPattern,
  validateExcludeRoutePatterns,
} from '../../../core/internal/route-exclusion.js';
import type {
  LocalesConfig,
  NormalizedRoute,
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

type ConvertToNormalizedRouteOptions = {
  filePath?: string;
  route: string;
};

type ParsedRouteSegment =
  | {
      kind: 'locale';
      matcher?: string;
      name: string;
      optional: boolean;
    }
  | {
      kind: 'param';
      matcher?: string;
      name: string;
      optional: boolean;
      rest?: boolean;
    }
  | {
      kind: 'static';
      value: string;
    };

/**
 * Creates normalized routes from SvelteKit page route files.
 */
export function createSvelteKitNormalizedRoutes({
  excludeRoutePatterns = [],
  locales = { alternates: [], default: 'en' },
  routeFiles = discoverSvelteKitPageRouteFiles(),
}: CreateSvelteKitNormalizedRoutesOptions): NormalizedRoute[] {
  validateExcludeRoutePatterns(excludeRoutePatterns);
  validateSvelteKitLocaleConfig(routeFiles, locales);

  const routeEntries = routeFiles
    .map((filePath) => ({
      filePath,
      route: normalizeSvelteKitRouteFile(filePath),
    }))
    .map(({ filePath, route }) => ({
      filePath,
      route: removeSvelteKitRouteGroups(route),
    }))
    .sort((a, b) => a.route.localeCompare(b.route))
    .flatMap(({ filePath, route }) =>
      expandOptionalParamRouteVariants(route).map((expandedRoute) => ({
        filePath,
        route: expandedRoute,
      }))
    )
    .filter(
      ({ route }) => !excludeRoutePatterns.some((pattern) => routeMatchesPattern(pattern, route))
    );

  return deduplicateNormalizedRoutesByCompatibilityKey(
    routeEntries.map(({ filePath, route }) => convertToNormalizedRoute({ filePath, route }))
  );
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
 * Removes decorative route groups from route keys.
 */
export function removeSvelteKitRouteGroups(route: string): string {
  const normalized = route.replaceAll(ROUTE_GROUP_REGEX, '');
  return normalized || '/';
}

/**
 * Expands one SvelteKit route containing optional parameters into the route
 * variants SvelteKit considers valid.
 */
export function expandOptionalParamRouteVariants(originalRoute: string): string[] {
  const hasLocale = findSvelteKitLocaleToken().exec(originalRoute);
  const route = hasLocale ? originalRoute.replace(findSvelteKitLocaleToken(), '') : originalRoute;

  if (!/\[\[.*\]\]/.test(route)) {
    return [originalRoute];
  }

  const routeSegments = route.split('/').filter(Boolean);
  let routeVariants: string[][] = [[]];
  let pendingOptionalSegments: string[] = [];

  for (const segment of routeSegments) {
    const parsedSegment = parseRouteSegment(segment);

    if (parsedSegment.kind !== 'static' && parsedSegment.optional) {
      pendingOptionalSegments.push(segment);
      continue;
    }

    if (pendingOptionalSegments.length) {
      routeVariants = expandOptionalSegmentPrefixVariants(routeVariants, pendingOptionalSegments);
      pendingOptionalSegments = [];
    }

    routeVariants = routeVariants.map((variant) => [...variant, segment]);
  }

  routeVariants = expandOptionalSegmentPrefixVariants(routeVariants, pendingOptionalSegments);

  let results = routeVariants.map((variant) => (variant.length ? `/${variant.join('/')}` : '/'));

  if (hasLocale) {
    const locale = hasLocale[0];
    results = results.map(
      (result) => `${result.slice(0, hasLocale.index)}${locale}${result.slice(hasLocale.index)}`
    );
  }

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
export function convertToNormalizedRoute({
  filePath,
  route,
}: ConvertToNormalizedRouteOptions): NormalizedRoute {
  const segments: RouteSegment[] = [];
  const params: RouteParam[] = [];
  let locale: RouteLocaleSlot | undefined;

  const routeSegments = route === '/' ? [] : route.split('/').filter(Boolean);

  routeSegments.forEach((segment, segmentIndex) => {
    const parsedSegment = parseRouteSegment(segment);

    if (parsedSegment.kind === 'static') {
      segments.push({ kind: 'static', value: parsedSegment.value });
      return;
    }

    if (parsedSegment.kind === 'locale') {
      segments.push({
        kind: 'locale',
        matcher: parsedSegment.matcher,
        name: parsedSegment.name,
      });
      locale = {
        matcher: parsedSegment.matcher,
        mode: parsedSegment.optional ? 'optional' : 'required',
        paramName: parsedSegment.name,
        segmentIndex,
      };
      return;
    }

    segments.push({
      kind: 'param',
      matcher: parsedSegment.matcher,
      name: parsedSegment.name,
      rest: parsedSegment.rest,
    });
    params.push({
      matcher: parsedSegment.matcher,
      name: parsedSegment.name,
      rest: parsedSegment.rest,
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

/**
 * Creates a regex matching legacy v1 SvelteKit `lang` route tokens.
 */
function findSvelteKitLegacyLangToken(): RegExp {
  return new RegExp(LEGACY_LANG_TOKEN_REGEX);
}

/**
 * Parses a SvelteKit route segment into normalized metadata.
 */
function parseRouteSegment(segment: string): ParsedRouteSegment {
  const match = PARAM_SEGMENT_REGEX.exec(segment);
  if (!match) return { kind: 'static', value: segment };

  const name = match[3] ?? '';
  const optional = match[1] === '[';

  if (name === 'locale') {
    return {
      kind: 'locale',
      matcher: match[4],
      name,
      optional,
    };
  }

  return {
    kind: 'param',
    matcher: match[4],
    name,
    optional,
    rest: match[2] === '...',
  };
}
