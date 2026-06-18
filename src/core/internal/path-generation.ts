import { toPath } from './paths.js';
import type {
  Alternate,
  LocalesConfig,
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
  locales?: LocalesConfig;
  normalizedRoutes: NormalizedRoute[];
  paramValues?: ParamValues;
};

type ParamValueCountMismatchDetails = {
  expectedValueCount: number;
  paramNames: string[];
  receivedValueCount: number;
};

type ParamValueEntryShape = 'param-value' | 'string' | 'string-array';

type SitemapRouteParamErrorCode =
  | 'invalid-param-values-shape'
  | 'missing-param-values'
  | 'param-value-count-mismatch'
  | 'unknown-param-values-route';

/**
 * Raised when paramValues and discovered routes disagree. Carries the route's
 * compatibility key so adapters can rethrow with framework-specific guidance
 * instead of parsing error message strings.
 */
export class SitemapRouteParamError extends Error {
  readonly code: SitemapRouteParamErrorCode;
  readonly expectedValueCount?: number;
  readonly paramNames?: string[];
  readonly receivedValueCount?: number;
  readonly route: string;

  constructor(
    code: SitemapRouteParamError['code'],
    route: string,
    details?: ParamValueCountMismatchDetails
  ) {
    super(formatRouteParamErrorMessage({ code, details, route }));
    this.code = code;
    this.expectedValueCount = details?.expectedValueCount;
    this.name = 'SitemapRouteParamError';
    this.paramNames = details?.paramNames;
    this.receivedValueCount = details?.receivedValueCount;
    this.route = route;
  }
}

export function generatePathsFromNormalizedRoutes({
  defaultChangefreq,
  defaultPriority,
  locales,
  normalizedRoutes,
  paramValues = {},
}: GenerateNormalizedRoutePathsOptions): PathObj[] {
  validateLocaleConfig(normalizedRoutes, locales);
  validateParamValueRouteKeys(normalizedRoutes, paramValues);

  const resolvedLocales = locales ?? { alternates: [], default: 'en' };

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
        resolvedLocales,
        new Map()
      );
      continue;
    }

    validateParamValueShape(normalizedRoute.source.compatibilityKey, paramValue);

    if (isParamValueArray(paramValue)) {
      for (const item of paramValue) {
        const paramValueMap = valuesByParamName(
          normalizedRoute.source.compatibilityKey,
          params,
          item.values
        );
        pushLocalizedPaths(
          paths,
          normalizedRoute,
          {
            changefreq: item.changefreq ?? defaults.changefreq,
            lastmod: item.lastmod,
            path: buildPath(normalizedRoute.segments, paramValueMap),
            priority: item.priority ?? defaults.priority,
          },
          resolvedLocales,
          paramValueMap
        );
      }
      continue;
    }

    if (isStringTupleArray(paramValue)) {
      for (const values of paramValue) {
        const paramValueMap = valuesByParamName(
          normalizedRoute.source.compatibilityKey,
          params,
          values
        );
        pushLocalizedPaths(
          paths,
          normalizedRoute,
          {
            ...defaults,
            path: buildPath(normalizedRoute.segments, paramValueMap),
          },
          resolvedLocales,
          paramValueMap
        );
      }
      continue;
    }

    for (const value of paramValue) {
      const paramValueMap = valuesByParamName(normalizedRoute.source.compatibilityKey, params, [
        value,
      ]);
      pushLocalizedPaths(
        paths,
        normalizedRoute,
        {
          ...defaults,
          path: buildPath(normalizedRoute.segments, paramValueMap),
        },
        resolvedLocales,
        paramValueMap
      );
    }
  }

  return paths;
}

function validateLocaleConfig(
  normalizedRoutes: NormalizedRoute[],
  locales: LocalesConfig | undefined
): void {
  const routesContainLocaleParam = normalizedRoutes.some(
    (normalizedRoute) => normalizedRoute.locale
  );

  if (routesContainLocaleParam && (!locales?.default || !locales.alternates.length)) {
    throw new Error(
      'super-sitemap: `locales` property is required in sitemap config because one or more routes contain a locale param.'
    );
  }
}

/**
 * Validates that every paramValues key targets a route that accepts param data.
 */
function validateParamValueRouteKeys(
  normalizedRoutes: NormalizedRoute[],
  paramValues: ParamValues
) {
  const paramsByCompatibilityKey = new Map(
    normalizedRoutes.map((normalizedRoute) => [
      normalizedRoute.source.compatibilityKey,
      getNormalizedRouteParams(normalizedRoute),
    ])
  );

  for (const paramValueKey in paramValues) {
    const params = paramsByCompatibilityKey.get(paramValueKey);

    if (!params) {
      throw new SitemapRouteParamError('unknown-param-values-route', paramValueKey);
    }

    if (!params.length) {
      throw new SitemapRouteParamError('param-value-count-mismatch', paramValueKey, {
        expectedValueCount: 0,
        paramNames: [],
        receivedValueCount: getReceivedValueCount(paramValues[paramValueKey]),
      });
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

/**
 * Validates runtime paramValues shapes from JavaScript or untyped data sources.
 */
function validateParamValueShape(
  route: string,
  paramValue: unknown
): asserts paramValue is ParamValues[string] {
  if (!Array.isArray(paramValue) || !paramValue.length) {
    throw new SitemapRouteParamError('invalid-param-values-shape', route);
  }

  const firstShape = getParamValueEntryShape(paramValue[0]);
  if (!firstShape) {
    throw new SitemapRouteParamError('invalid-param-values-shape', route);
  }

  for (const value of paramValue) {
    if (getParamValueEntryShape(value) !== firstShape) {
      throw new SitemapRouteParamError('invalid-param-values-shape', route);
    }
  }
}

/**
 * Classifies one paramValues entry when it has a supported runtime shape.
 */
function getParamValueEntryShape(value: unknown): ParamValueEntryShape | undefined {
  if (typeof value === 'string') return 'string';

  if (Array.isArray(value)) {
    return value.every(isString) ? 'string-array' : undefined;
  }

  if (isRecord(value) && Array.isArray(value['values']) && value['values'].every(isString)) {
    return 'param-value';
  }

  return undefined;
}

/**
 * Checks whether a value is a string.
 */
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Checks whether a value can be inspected as a plain object shape.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Maps ordered param values to their route param names after validating counts.
 */
function valuesByParamName(
  route: string,
  params: RouteParam[],
  values: string[]
): Map<string, string> {
  if (values.length !== params.length) {
    throw new SitemapRouteParamError('param-value-count-mismatch', route, {
      expectedValueCount: params.length,
      paramNames: params.map(({ name }) => name),
      receivedValueCount: values.length,
    });
  }

  const valueMap = new Map<string, string>();

  for (let index = 0; index < params.length; index++) {
    const param = params[index];
    const value = values[index];
    if (param && value !== undefined) valueMap.set(param.name, value);
  }

  return valueMap;
}

/**
 * Estimates how many values a provided paramValues entry supplies per path.
 */
function getReceivedValueCount(paramValue: ParamValues[string] | undefined): number {
  if (!Array.isArray(paramValue) || paramValue.length === 0) return 0;

  const firstValue = paramValue[0];
  if (Array.isArray(firstValue)) return firstValue.length;
  if (typeof firstValue === 'object') return firstValue.values.length;
  return 1;
}

/**
 * Formats the core route param error before adapter-level sitemap guidance is added.
 */
function formatRouteParamErrorMessage({
  code,
  details,
  route,
}: {
  code: SitemapRouteParamErrorCode;
  details?: ParamValueCountMismatchDetails;
  route: string;
}): string {
  if (code === 'missing-param-values') {
    return `paramValues not provided for route: '${route}'.`;
  }

  if (code === 'unknown-param-values-route') {
    return `paramValues were provided for a route that does not exist: '${route}'.`;
  }

  if (code === 'invalid-param-values-shape') {
    return `paramValues for route '${route}' must be string[], string[][], or ParamValue[].`;
  }

  if (!details || details.expectedValueCount === 0) {
    return `Route key '${route}' expects no params. Remove this key from paramValues.`;
  }

  return `paramValues for route '${route}' must provide ${formatCount(
    details.expectedValueCount,
    'value'
  )} per path: ${details.paramNames.join(', ')}. Received ${formatCount(
    details.receivedValueCount,
    'value'
  )}.`;
}

/**
 * Formats singular and plural count labels for error messages.
 */
function formatCount(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
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
  locales: LocalesConfig,
  paramValues: Map<string, string>
) {
  if (!normalizedRoute.locale) {
    paths.push(pathObj);
    return;
  }

  const variations = getLocaleVariations(normalizedRoute, pathObj.path, locales, paramValues);

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
  locales: LocalesConfig,
  paramValues: Map<string, string>
): Alternate[] {
  const variations: Alternate[] = [];
  const defaultLocalePath =
    normalizedRoute.locale?.mode === 'required'
      ? buildPath(normalizedRoute.segments, paramValues, locales.default)
      : defaultPath;

  variations.push({
    hreflang: locales.default,
    path: defaultLocalePath,
  });

  for (const alternate of locales.alternates) {
    variations.push({
      hreflang: alternate,
      path: buildPath(normalizedRoute.segments, paramValues, alternate),
    });
  }

  return variations;
}
