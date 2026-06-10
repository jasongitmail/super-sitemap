import { toPath } from './paths.js';
import type {
  Alternate,
  LangConfig,
  NormalizedRoute,
  ParamValue,
  ParamValues,
  PathObj,
  RouteParam,
  RouteSegment,
  SitemapConfig,
} from './types.js';

type GenerateNormalizedRoutePathsOptions = {
  defaultChangefreq?: SitemapConfig['defaultChangefreq'];
  defaultPriority?: SitemapConfig['defaultPriority'];
  lang?: LangConfig;
  normalizedRoutes: NormalizedRoute[];
  paramValues?: ParamValues;
};

/**
 * Raised when paramValues and discovered routes disagree. Carries the route's
 * compatibility key so adapters can rethrow with framework-specific guidance
 * instead of parsing error message strings.
 */
export class SitemapRouteParamError extends Error {
  readonly code: 'missing-param-values' | 'unknown-param-values-route';
  readonly route: string;

  constructor(code: SitemapRouteParamError['code'], route: string) {
    super(
      code === 'missing-param-values'
        ? `paramValues not provided for route: '${route}'.`
        : `paramValues were provided for a route that does not exist: '${route}'.`
    );
    this.code = code;
    this.name = 'SitemapRouteParamError';
    this.route = route;
  }
}

export function generatePathsFromNormalizedRoutes({
  defaultChangefreq,
  defaultPriority,
  lang = { alternates: [], default: 'en' },
  normalizedRoutes,
  paramValues = {},
}: GenerateNormalizedRoutePathsOptions): PathObj[] {
  validateKnownParamValueKeys(normalizedRoutes, paramValues);

  const defaults = {
    changefreq: defaultChangefreq,
    lastmod: undefined,
    priority: defaultPriority,
  };
  const paths: PathObj[] = [];

  for (const normalizedRoute of normalizedRoutes) {
    const params = getNormalizedRouteParams(normalizedRoute);
    const paramValue = paramValues[normalizedRoute.source.compatibilityKey];

    if (params.length && paramValue === undefined) {
      throw new SitemapRouteParamError(
        'missing-param-values',
        normalizedRoute.source.compatibilityKey
      );
    }

    if (!params.length) {
      pushLocalizedPaths(
        paths,
        normalizedRoute,
        { ...defaults, path: buildPath(normalizedRoute.segments) },
        lang,
        new Map()
      );
      continue;
    }

    if (isParamValueArray(paramValue)) {
      for (const item of paramValue) {
        const paramValueMap = valuesByParamName(params, item.values);
        pushLocalizedPaths(
          paths,
          normalizedRoute,
          {
            changefreq: item.changefreq ?? defaults.changefreq,
            lastmod: item.lastmod,
            path: buildPath(normalizedRoute.segments, paramValueMap),
            priority: item.priority ?? defaults.priority,
          },
          lang,
          paramValueMap
        );
      }
      continue;
    }

    if (isStringTupleArray(paramValue)) {
      for (const values of paramValue) {
        const paramValueMap = valuesByParamName(params, values);
        pushLocalizedPaths(
          paths,
          normalizedRoute,
          {
            ...defaults,
            path: buildPath(normalizedRoute.segments, paramValueMap),
          },
          lang,
          paramValueMap
        );
      }
      continue;
    }

    for (const value of paramValue) {
      const paramValueMap = valuesByParamName(params, [value]);
      pushLocalizedPaths(
        paths,
        normalizedRoute,
        {
          ...defaults,
          path: buildPath(normalizedRoute.segments, paramValueMap),
        },
        lang,
        paramValueMap
      );
    }
  }

  return paths;
}

function validateKnownParamValueKeys(
  normalizedRoutes: NormalizedRoute[],
  paramValues: ParamValues
) {
  const knownCompatibilityKeys = new Set(
    normalizedRoutes.map((normalizedRoute) => normalizedRoute.source.compatibilityKey)
  );

  for (const paramValueKey in paramValues) {
    if (!knownCompatibilityKeys.has(paramValueKey)) {
      throw new SitemapRouteParamError('unknown-param-values-route', paramValueKey);
    }
  }
}

function getNormalizedRouteParams(normalizedRoute: NormalizedRoute): RouteParam[] {
  if (normalizedRoute.params) {
    return [...normalizedRoute.params].sort((a, b) => a.segmentIndex - b.segmentIndex);
  }

  const params: RouteParam[] = [];
  normalizedRoute.segments.forEach((segment, segmentIndex) => {
    if (segment.kind === 'param') {
      params.push({
        matcher: segment.matcher,
        name: segment.name,
        rest: segment.rest,
        segmentIndex,
      });
    }
  });

  return params;
}

function isParamValueArray(
  paramValue: ParamValues[string] | undefined
): paramValue is ParamValue[] {
  return (
    Array.isArray(paramValue) &&
    paramValue.length > 0 &&
    typeof paramValue[0] === 'object' &&
    !Array.isArray(paramValue[0])
  );
}

function isStringTupleArray(paramValue: ParamValues[string] | undefined): paramValue is string[][] {
  return Array.isArray(paramValue) && Array.isArray(paramValue[0]);
}

function valuesByParamName(params: RouteParam[], values: string[]): Map<string, string> {
  const valueMap = new Map<string, string>();

  for (let index = 0; index < params.length; index++) {
    const param = params[index];
    if (param) valueMap.set(param.name, values[index] ?? '');
  }

  return valueMap;
}

function buildPath(
  segments: RouteSegment[],
  paramValues = new Map<string, string>(),
  localeValue?: string
): string {
  const pathSegments: string[] = [];

  for (const segment of segments) {
    if (segment.kind === 'static') {
      pathSegments.push(segment.value);
      continue;
    }

    if (segment.kind === 'locale') {
      if (localeValue) pathSegments.push(localeValue);
      continue;
    }

    pathSegments.push(paramValues.get(segment.name) ?? '');
  }

  return toPath(pathSegments);
}

function pushLocalizedPaths(
  paths: PathObj[],
  normalizedRoute: NormalizedRoute,
  pathObj: PathObj,
  lang: LangConfig,
  paramValues: Map<string, string>
) {
  if (!normalizedRoute.locale) {
    paths.push(pathObj);
    return;
  }

  const variations = getLocaleVariations(normalizedRoute, pathObj.path, lang, paramValues);

  for (const variation of variations) {
    paths.push({
      ...pathObj,
      alternates: variations,
      path: variation.path,
    });
  }
}

function getLocaleVariations(
  normalizedRoute: NormalizedRoute,
  defaultPath: string,
  lang: LangConfig,
  paramValues: Map<string, string>
): Alternate[] {
  const variations: Alternate[] = [];
  const defaultLocalePath =
    normalizedRoute.locale?.mode === 'required'
      ? buildPath(normalizedRoute.segments, paramValues, lang.default)
      : defaultPath;

  variations.push({
    lang: lang.default,
    path: defaultLocalePath,
  });

  for (const alternate of lang.alternates) {
    variations.push({
      lang: alternate,
      path: buildPath(normalizedRoute.segments, paramValues, alternate),
    });
  }

  return variations;
}
