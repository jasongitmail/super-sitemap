import type {
  RouteLocaleSlot,
  RouteParam,
  RouteSegment,
  RouteSource,
  RouteTemplate,
} from '../../core/index.js';

const OPTIONAL_PARAM_SEGMENT_REGEX = /^\{-\$([^}]+)\}$/;

export type TanStackStartRouteRecord = {
  filePath?: string;
  fullPath?: string;
  id?: string;
  path?: string;
  to?: string;
};

export type TanStackStartLocaleMapping = {
  matcher?: string;
  mode: RouteLocaleSlot['mode'];
  paramName: string;
};

export type TanStackStartRouteSource = RouteSource & {
  fullPath?: string;
  id?: string;
  path?: string;
  to?: string;
};

export type TanStackStartRouteTemplate = Omit<RouteTemplate, 'source'> & {
  source: TanStackStartRouteSource;
};

export type ParseTanStackStartRouteTemplatesOptions = {
  locale?: TanStackStartLocaleMapping;
};

export type CreateTanStackStartRouteTemplatesOptions = ParseTanStackStartRouteTemplatesOptions & {
  excludeRoutePatterns?: string[];
  routes: TanStackStartRouteRecord[];
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
  segment?: RouteSegment;
};

export function createTanStackStartRouteTemplates({
  excludeRoutePatterns = [],
  locale,
  routes,
}: CreateTanStackStartRouteTemplatesOptions): TanStackStartRouteTemplate[] {
  const templatesByCompatibilityKey = new Map<string, TanStackStartRouteTemplate>();

  for (const route of routes) {
    const templates = parseTanStackStartRouteTemplates(route, { locale }).filter(
      (template) =>
        !excludeRoutePatterns.some((pattern) =>
          new RegExp(pattern).test(template.source.compatibilityKey)
        )
    );

    for (const template of templates) {
      if (!templatesByCompatibilityKey.has(template.source.compatibilityKey)) {
        templatesByCompatibilityKey.set(template.source.compatibilityKey, template);
      }
    }
  }

  return [...templatesByCompatibilityKey.values()].sort((a, b) =>
    a.source.compatibilityKey.localeCompare(b.source.compatibilityKey)
  );
}

export function parseTanStackStartRouteTemplates(
  route: TanStackStartRouteRecord | string,
  options: ParseTanStackStartRouteTemplatesOptions = {}
): TanStackStartRouteTemplate[] {
  const routeRecord = typeof route === 'string' ? { fullPath: route } : route;
  const sourcePath = getCompatibilityPath(routeRecord);
  const parsedSegments = splitPath(sourcePath).map(parseTanStackStartSegment);
  const variants = expandSegmentVariants(parsedSegments, options.locale);

  return variants.map((segments) =>
    createRouteTemplate({
      compatibilityKey: toPath(segments.map((segment) => segment.compatibilityKeySegment)),
      localeMapping: options.locale,
      routeRecord,
      routeSegments: segments.flatMap((segment) => (segment.segment ? [segment.segment] : [])),
    })
  );
}

function createRouteTemplate({
  compatibilityKey,
  localeMapping,
  routeRecord,
  routeSegments,
}: {
  compatibilityKey: string;
  localeMapping?: TanStackStartLocaleMapping;
  routeRecord: TanStackStartRouteRecord;
  routeSegments: RouteSegment[];
}): TanStackStartRouteTemplate {
  const params: RouteParam[] = [];
  let locale: RouteLocaleSlot | undefined;

  routeSegments.forEach((segment, segmentIndex) => {
    if (segment.kind === 'locale') {
      locale = {
        matcher: segment.matcher,
        mode: localeMapping?.mode ?? 'required',
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
    source: {
      adapter: 'tanstack-start',
      compatibilityKey,
      filePath: routeRecord.filePath,
      fullPath: routeRecord.fullPath,
      id: routeRecord.id,
      path: routeRecord.path,
      to: routeRecord.to,
    },
  };
}

function expandSegmentVariants(
  segments: ParsedSegment[],
  locale: TanStackStartLocaleMapping | undefined
): SegmentVariant[][] {
  let variants: SegmentVariant[][] = [[]];

  for (const segment of segments) {
    const additions = getSegmentVariants(segment, locale);
    variants = variants.flatMap((variant) =>
      additions.map((addition) => (addition ? [...variant, addition] : variant))
    );
  }

  return variants.length ? variants : [[]];
}

function getSegmentVariants(
  segment: ParsedSegment,
  locale: TanStackStartLocaleMapping | undefined
): Array<SegmentVariant | undefined> {
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

  if (locale?.paramName === segment.name) {
    return [
      {
        compatibilityKeySegment: optionalCompatibilityKeySegment,
        segment: {
          kind: 'locale',
          matcher: locale.matcher,
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

function getCompatibilityPath(route: TanStackStartRouteRecord): string {
  return normalizePath(route.fullPath ?? route.to ?? route.path ?? route.id ?? '/');
}

function normalizePath(routePath: string): string {
  const normalizedPath = routePath.trim();

  if (!normalizedPath || normalizedPath === '/') return '/';

  return toPath(splitPath(normalizedPath));
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

function splitPath(routePath: string): string[] {
  return routePath.split('/').filter(Boolean);
}

function toPath(segments: Array<string | undefined>): string {
  const path = segments.filter(Boolean).join('/');
  return path ? `/${path}` : '/';
}
