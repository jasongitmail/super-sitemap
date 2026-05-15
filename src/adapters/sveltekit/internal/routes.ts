import fs from 'node:fs';
import path from 'node:path';

import type {
  LangConfig,
  ParamValues,
  RouteLocaleSlot,
  RouteParam,
  RouteSegment,
  RouteTemplate,
} from '../../../core/internal/types.js';
import type { CreateSvelteKitRouteTemplatesOptions } from './types.js';

const LANG_TOKEN_REGEX = /\/?\[(\[lang(=[a-z]+)?\]|lang(=[a-z]+)?)\]/;
const PAGE_ROUTE_FILE_REGEX = /\/\+page.*\.(svelte|md|svx)$/;
const PARAM_SEGMENT_REGEX = /^\[(\[?)(\.\.\.)?([^\]=]+)(?:=([^\]]+))?\]?\]$/;
const ROUTE_GROUP_REGEX = /\/\([^)]+\)/g;
const SRC_ROUTES_PREFIX = '/src/routes';

type ParseSvelteKitRouteTemplateOptions = {
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
 * Creates normalized route templates from SvelteKit page route files.
 */
export function createSvelteKitRouteTemplates({
  excludeRoutePatterns = [],
  lang = { alternates: [], default: 'en' },
  routeFiles = discoverSvelteKitPageRouteFiles(),
}: CreateSvelteKitRouteTemplatesOptions): RouteTemplate[] {
  validateSvelteKitLocaleConfig(routeFiles, lang);

  const routeEntries = routeFiles
    .map((filePath) => ({
      filePath,
      route: normalizeSvelteKitRouteFile(filePath),
    }))
    .filter(({ route }) => !excludeRoutePatterns.some((pattern) => new RegExp(pattern).test(route)))
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

  const templatesByRoute = new Map(
    routeEntries.map(({ filePath, route }) => [
      route,
      parseSvelteKitRouteTemplate({ filePath, route }),
    ])
  );

  return [...templatesByRoute.values()];
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
 * Discovers SvelteKit page route files from an on-disk src/routes directory.
 *
 * This supports route discovery outside Vite's import.meta.glob context.
 */
export function discoverSvelteKitPageRouteFilesFromDirectory(routesDir: string): string[] {
  return listFilePathsRecursively(routesDir)
    .filter(isSvelteKitPageRouteFile)
    .map((filePath) => toSvelteKitRouteFilePath(routesDir, filePath));
}

/**
 * Checks whether an on-disk file path is a SvelteKit page route file.
 */
export function isSvelteKitPageRouteFile(filePath: string): boolean {
  return /\/\+page.*\.(svelte|md|svx)$/.test(filePath.replaceAll(path.sep, '/'));
}

/**
 * Recursively reads a directory and returns the full disk path of each file.
 *
 * @param dirPath - The directory to traverse.
 * @returns An array of strings representing full disk file paths.
 */
export function listFilePathsRecursively(dirPath: string): string[] {
  const paths: string[] = [];

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      paths.push(...listFilePathsRecursively(entryPath));
      continue;
    }

    if (entry.isFile()) {
      paths.push(entryPath);
    }
  }

  return paths;
}

/**
 * Converts SvelteKit page files into public route keys after applying exclusions.
 */
export function filterSvelteKitRoutes(
  routeFiles: string[],
  excludeRoutePatterns: string[]
): string[] {
  return sortSvelteKitRoutes(
    routeFiles
      .map(normalizeSvelteKitRouteFile)
      .filter((route) => !excludeRoutePatterns.some((pattern) => new RegExp(pattern).test(route)))
      .map(removeSvelteKitRouteGroups)
  );
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
 * Sorts SvelteKit route keys alphabetically.
 */
export function sortSvelteKitRoutes(routes: string[]): string[] {
  return [...routes].sort();
}

/**
 * Given an array of SvelteKit route keys, return a new array that includes all
 * valid SvelteKit variants for routes that contain optional params other than
 * the locale param.
 */
export function expandSvelteKitOptionalRoutes(routes: string[]): string[] {
  const processedRoutes = routes.flatMap((route) => {
    const routeWithoutLangIfAny = route.replace(findSvelteKitLangToken(), '');
    return /\[\[.*\]\]/.test(routeWithoutLangIfAny) ? expandSvelteKitOptionalRoute(route) : route;
  });

  return Array.from(new Set(processedRoutes));
}

/**
 * Expands one SvelteKit route containing optional parameters into the route
 * variants SvelteKit considers valid.
 */
export function expandSvelteKitOptionalRoute(originalRoute: string): string[] {
  const hasLang = findSvelteKitLangToken().exec(originalRoute);
  const route = hasLang ? originalRoute.replace(findSvelteKitLangToken(), '') : originalRoute;

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

  if (hasLang) {
    const lang = hasLang[0];
    results = results.map(
      (result) => `${result.slice(0, hasLang.index)}${lang}${result.slice(hasLang.index)}`
    );
  }

  if (!results[0].length) results[0] = '/';

  return results;
}

/**
 * Creates a regex matching SvelteKit optional or required lang route tokens.
 */
export function findSvelteKitLangToken(): RegExp {
  return new RegExp(LANG_TOKEN_REGEX);
}

/**
 * Converts a SvelteKit route key into Super Sitemap's normalized route template IR.
 */
export function parseSvelteKitRouteTemplate({
  filePath,
  route,
}: ParseSvelteKitRouteTemplateOptions): RouteTemplate {
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

    if (parsedParam.name === 'lang') {
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
 * Orders SvelteKit route templates to preserve the SvelteKit adapter's path output order.
 */
export function orderSvelteKitTemplatesForCompatibility({
  paramValues = {},
  templates,
}: {
  paramValues?: ParamValues;
  templates: RouteTemplate[];
}): RouteTemplate[] {
  const templatesByCompatibilityKey = new Map(
    templates.map((template) => [template.source.compatibilityKey, template])
  );
  const dynamicTemplatesInParamValueOrderWithoutLocale: RouteTemplate[] = [];
  const dynamicTemplatesInParamValueOrderWithLocale: RouteTemplate[] = [];
  const usedDynamicTemplateKeys = new Set<string>();

  for (const paramValueKey in paramValues) {
    const template = templatesByCompatibilityKey.get(paramValueKey);
    if (template && hasNonLocaleParams(template)) {
      if (template.locale) {
        dynamicTemplatesInParamValueOrderWithLocale.push(template);
      } else {
        dynamicTemplatesInParamValueOrderWithoutLocale.push(template);
      }
      usedDynamicTemplateKeys.add(paramValueKey);
    }
  }

  const staticTemplatesWithoutLocale: RouteTemplate[] = [];
  const staticTemplatesWithLocale: RouteTemplate[] = [];
  const remainingDynamicTemplatesWithoutLocale: RouteTemplate[] = [];
  const remainingDynamicTemplatesWithLocale: RouteTemplate[] = [];

  for (const template of templates) {
    if (!hasNonLocaleParams(template)) {
      if (template.locale) {
        staticTemplatesWithLocale.push(template);
      } else {
        staticTemplatesWithoutLocale.push(template);
      }
      continue;
    }

    if (!usedDynamicTemplateKeys.has(template.source.compatibilityKey)) {
      if (template.locale) {
        remainingDynamicTemplatesWithLocale.push(template);
      } else {
        remainingDynamicTemplatesWithoutLocale.push(template);
      }
    }
  }

  return [
    ...staticTemplatesWithoutLocale,
    ...dynamicTemplatesInParamValueOrderWithoutLocale,
    ...remainingDynamicTemplatesWithoutLocale,
    ...staticTemplatesWithLocale,
    ...dynamicTemplatesInParamValueOrderWithLocale,
    ...remainingDynamicTemplatesWithLocale,
  ];
}

/**
 * Requires explicit locale config when SvelteKit routes contain a lang token.
 */
export function validateSvelteKitLocaleConfig(routeFiles: string[], lang: LangConfig): void {
  const routesContainLangParam = routeFiles.some((route) => findSvelteKitLangToken().test(route));

  if (routesContainLangParam && (!lang?.default || !lang?.alternates.length)) {
    throw Error(
      'Must specify `lang` property within the sitemap config because one or more routes contain [[lang]].'
    );
  }
}

/**
 * Converts an on-disk page route file path into SvelteKit's Vite-style route path.
 */
function toSvelteKitRouteFilePath(routesDir: string, filePath: string): string {
  const relativePath = path.relative(routesDir, filePath).split(path.sep).join('/');
  return `/src/routes/${relativePath}`;
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
 * Checks whether a route template has params other than the locale slot.
 */
function hasNonLocaleParams(template: RouteTemplate): boolean {
  return template.segments.some((segment) => segment.kind === 'param');
}
