import type { LangConfig, ParamValues, RouteTemplate } from '../../core/internal/types.js';

import { discoverSvelteKitPageRouteFiles } from './discovery.js';
import { expandSvelteKitOptionalRoutes } from './optional-routes.js';
import {
  normalizeSvelteKitRouteFile,
  removeSvelteKitRouteGroups,
  sortSvelteKitRoutes,
} from './route-files.js';
import { findSvelteKitLangToken, parseSvelteKitRouteTemplate } from './route-template.js';

export type {
  Alternate,
  Changefreq,
  LangConfig,
  ParamValue,
  ParamValues,
  PathObj,
  Priority,
  SitemapConfig,
} from '../../core/internal/types.js';
export {
  discoverSvelteKitPageRouteFiles,
  discoverSvelteKitPageRouteFilesFromDirectory,
  isSvelteKitPageRouteFile,
  listFilePathsRecursively,
} from './discovery.js';
export { expandSvelteKitOptionalRoute, expandSvelteKitOptionalRoutes } from './optional-routes.js';
export {
  normalizeSvelteKitRouteFile,
  removeSvelteKitRouteGroups,
  sortSvelteKitRoutes,
} from './route-files.js';
export { findSvelteKitLangToken, parseSvelteKitRouteTemplate } from './route-template.js';

export type CreateSvelteKitRouteTemplatesOptions = {
  excludeRoutePatterns?: string[];
  lang?: LangConfig;
  routeFiles?: string[];
};

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

export function validateSvelteKitLocaleConfig(routeFiles: string[], lang: LangConfig): void {
  const routesContainLangParam = routeFiles.some((route) => findSvelteKitLangToken().test(route));

  if (routesContainLangParam && (!lang?.default || !lang?.alternates.length)) {
    throw Error(
      'Must specify `lang` property within the sitemap config because one or more routes contain [[lang]].'
    );
  }
}

function hasNonLocaleParams(template: RouteTemplate): boolean {
  return template.segments.some((segment) => segment.kind === 'param');
}
