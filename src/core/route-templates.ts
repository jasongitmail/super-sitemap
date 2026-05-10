import type {
  Alternate,
  LangConfig,
  ParamValue,
  ParamValues,
  PathObj,
  RouteParam,
  RouteSegment,
  RouteTemplate,
  SitemapConfig,
} from './types.js';

type GenerateRouteTemplatePathsOptions = {
  defaultChangefreq?: SitemapConfig['defaultChangefreq'];
  defaultPriority?: SitemapConfig['defaultPriority'];
  lang?: LangConfig;
  paramValues?: ParamValues;
  templates: RouteTemplate[];
};

export function generatePathsFromRouteTemplates({
  defaultChangefreq,
  defaultPriority,
  lang = { alternates: [], default: 'en' },
  paramValues = {},
  templates,
}: GenerateRouteTemplatePathsOptions): PathObj[] {
  validateKnownParamValueKeys(templates, paramValues);

  const defaults = {
    changefreq: defaultChangefreq,
    lastmod: undefined,
    priority: defaultPriority,
  };
  const paths: PathObj[] = [];

  for (const template of templates) {
    const params = getTemplateParams(template);
    const paramValue = paramValues[template.source.compatibilityKey];

    if (params.length && paramValue === undefined) {
      throw new Error(
        `Core: paramValues not provided for route: '${template.source.compatibilityKey}'.`
      );
    }

    if (!params.length) {
      pushLocalizedPaths(
        paths,
        template,
        { ...defaults, path: buildPath(template.segments) },
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
          template,
          {
            changefreq: item.changefreq ?? defaults.changefreq,
            lastmod: item.lastmod,
            path: buildPath(template.segments, paramValueMap),
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
          template,
          {
            ...defaults,
            path: buildPath(template.segments, paramValueMap),
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
        template,
        {
          ...defaults,
          path: buildPath(template.segments, paramValueMap),
        },
        lang,
        paramValueMap
      );
    }
  }

  return paths;
}

function validateKnownParamValueKeys(templates: RouteTemplate[], paramValues: ParamValues) {
  const knownCompatibilityKeys = new Set(
    templates.map((template) => template.source.compatibilityKey)
  );

  for (const paramValueKey in paramValues) {
    if (!knownCompatibilityKeys.has(paramValueKey)) {
      throw new Error(
        `Core: paramValues were provided for a route that does not exist: '${paramValueKey}'.`
      );
    }
  }
}

function getTemplateParams(template: RouteTemplate): RouteParam[] {
  if (template.params) {
    return [...template.params].sort((a, b) => a.segmentIndex - b.segmentIndex);
  }

  const params: RouteParam[] = [];
  template.segments.forEach((segment, segmentIndex) => {
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

function toPath(segments: string[]): string {
  const path = segments.filter(Boolean).join('/');
  return path ? `/${path}` : '/';
}

function pushLocalizedPaths(
  paths: PathObj[],
  template: RouteTemplate,
  pathObj: PathObj,
  lang: LangConfig,
  paramValues: Map<string, string>
) {
  if (!template.locale) {
    paths.push(pathObj);
    return;
  }

  const variations = getLocaleVariations(template, pathObj.path, lang, paramValues);

  for (const variation of variations) {
    paths.push({
      ...pathObj,
      alternates: variations,
      path: variation.path,
    });
  }
}

function getLocaleVariations(
  template: RouteTemplate,
  defaultPath: string,
  lang: LangConfig,
  paramValues: Map<string, string>
): Alternate[] {
  const variations: Alternate[] = [];
  const defaultLocalePath =
    template.locale?.mode === 'required'
      ? buildPath(template.segments, paramValues, lang.default)
      : defaultPath;

  variations.push({
    lang: lang.default,
    path: defaultLocalePath,
  });

  for (const alternate of lang.alternates) {
    variations.push({
      lang: alternate,
      path: buildPath(template.segments, paramValues, alternate),
    });
  }

  return variations;
}
