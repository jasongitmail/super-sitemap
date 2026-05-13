import type {
  PathObj,
  RouteLocaleSlot,
  RouteParam,
  RouteSegment,
  RouteSource,
  RouteTemplate,
  SitemapConfig,
} from "../../core/index.js";

import {
  deduplicatePaths,
  generateAdditionalPaths,
  generatePathsFromRouteTemplates,
  getTotalPages,
  paginatePaths,
  renderSitemapIndexXml,
  renderSitemapXml,
  sortPaths,
} from "../../core/index.js";

const OPTIONAL_PARAM_SEGMENT_REGEX = /^\{-\$([^}]+)\}$/;
const routerCache = new WeakMap<TanStackStartRouterFactory, TanStackStartRouter>();

type TanStackStartRouteRecord = {
  filePath?: string;
  fullPath?: string;
  id?: string;
  path?: string;
  routesByPathKey?: string;
  to?: string;
};

export type TanStackStartResolvedRoute = {
  filePath?: string;
  fullPath?: string;
  id?: string;
  path?: string;
  to?: string;
};

export type TanStackStartRoutesByPath = object;

export type TanStackStartRouterRoutesByPath = {
  routesByPath: TanStackStartRoutesByPath;
};

export type TanStackStartRouter<
  TRouter extends TanStackStartRouterRoutesByPath = TanStackStartRouterRoutesByPath,
> = Pick<TRouter, "routesByPath">;

export type TanStackStartRouterFactory<
  TRouter extends TanStackStartRouterRoutesByPath = TanStackStartRouterRoutesByPath,
> = () => TanStackStartRouter<TRouter>;

export type TanStackStartLocaleMapping = {
  matcher?: string;
  mode: RouteLocaleSlot["mode"];
  paramName: string;
};

export type TanStackStartRouteSource = RouteSource & {
  fullPath?: string;
  id?: string;
  path?: string;
  to?: string;
};

export type TanStackStartRouteTemplate = Omit<RouteTemplate, "source"> & {
  source: TanStackStartRouteSource;
};

export type ParseTanStackStartRouteTemplatesOptions = {
  locale?: TanStackStartLocaleMapping;
};

export type TanStackStartRouteInput<
  TRouter extends TanStackStartRouterRoutesByPath = TanStackStartRouterRoutesByPath,
> = {
  router: TanStackStartRouterFactory<TRouter>;
};

export type CreateTanStackStartRouteTemplatesOptions<
  TRouter extends TanStackStartRouterRoutesByPath = TanStackStartRouterRoutesByPath,
> = ParseTanStackStartRouteTemplatesOptions & {
  excludeRoutePatterns?: string[];
} & TanStackStartRouteInput<TRouter>;

export type TanStackStartSitemapConfig<
  TRouter extends TanStackStartRouterRoutesByPath = TanStackStartRouterRoutesByPath,
> = Omit<SitemapConfig, "excludeRoutePatterns"> & CreateTanStackStartRouteTemplatesOptions<TRouter>;

export type GetTanStackStartHeadersOptions = {
  customHeaders?: Record<string, string>;
};

type ParsedSegment =
  | {
      kind: "omit";
    }
  | {
      kind: "optional-param";
      name: string;
    }
  | {
      kind: "param";
      name: string;
      rest: boolean;
    }
  | {
      kind: "static";
      value: string;
    };

type SegmentVariant = {
  compatibilityKeySegment?: string;
  segment?: RouteSegment;
};

export function createTanStackStartRouteTemplates({
  excludeRoutePatterns = [],
  locale,
  ...routeInput
}: CreateTanStackStartRouteTemplatesOptions): TanStackStartRouteTemplate[] {
  const routeRecords = getTanStackStartRouteRecordsFromRoutesByPath(routeInput);
  const templatesByCompatibilityKey = new Map<string, TanStackStartRouteTemplate>();

  for (const route of routeRecords) {
    const templates = parseTanStackStartRouteTemplates(route, { locale }).filter(
      (template) =>
        !excludeRoutePatterns.some((pattern) =>
          new RegExp(pattern).test(template.source.compatibilityKey),
        ),
    );

    for (const template of templates) {
      if (!templatesByCompatibilityKey.has(template.source.compatibilityKey)) {
        templatesByCompatibilityKey.set(template.source.compatibilityKey, template);
      }
    }
  }

  return [...templatesByCompatibilityKey.values()].sort((a, b) =>
    a.source.compatibilityKey.localeCompare(b.source.compatibilityKey),
  );
}

export function buildTanStackStartSitemap({
  maxPerPage = 50_000,
  origin,
  page,
  ...config
}: TanStackStartSitemapConfig): string {
  return getBody({ maxPerPage, origin, page, ...config });
}

export function getBody({
  maxPerPage = 50_000,
  origin,
  page,
  ...config
}: TanStackStartSitemapConfig): string {
  if (!origin) {
    throw new Error("TanStack Start sitemap: `origin` property is required in sitemap config.");
  }

  const paths = prepareTanStackStartSitemapPaths(config);
  const totalPages = getTotalPages(paths, maxPerPage);

  if (!page) {
    if (paths.length <= maxPerPage) {
      return renderSitemapXml(origin, paths);
    }

    return renderSitemapIndexXml(origin, totalPages);
  }

  const paginatedPaths = paginatePaths({ maxPerPage, page, paths });
  if (paginatedPaths.kind === "invalid-page") {
    return "Invalid page param";
  }
  if (paginatedPaths.kind === "not-found") {
    return "Page does not exist";
  }

  return renderSitemapXml(origin, paginatedPaths.paths);
}

export function getHeaders({ customHeaders = {} }: GetTanStackStartHeadersOptions = {}): Record<
  string,
  string
> {
  return {
    "cache-control": "max-age=0, s-maxage=3600",
    "content-type": "application/xml",
    ...Object.fromEntries(
      Object.entries(customHeaders).map(([key, value]) => [key.toLowerCase(), value]),
    ),
  };
}

export function generateTanStackStartPaths({
  defaultChangefreq,
  defaultPriority,
  excludeRoutePatterns,
  lang,
  locale,
  paramValues,
  ...routeInput
}: Pick<
  TanStackStartSitemapConfig,
  | "defaultChangefreq"
  | "defaultPriority"
  | "excludeRoutePatterns"
  | "lang"
  | "locale"
  | "paramValues"
> &
  TanStackStartRouteInput): PathObj[] {
  const templates = createTanStackStartRouteTemplates({
    excludeRoutePatterns,
    locale,
    ...routeInput,
  });

  try {
    return generatePathsFromRouteTemplates({
      defaultChangefreq,
      defaultPriority,
      lang,
      paramValues,
      templates,
    }).map(stripUndefinedPathMetadata);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith("Core: paramValues not provided for route: ")) {
        const route = error.message.match(/'(.+)'/)?.[1] ?? "";
        throw new Error(
          `TanStack Start sitemap: paramValues not provided for route: '${route}'. Update excludeRoutePatterns to exclude this route or add data for this route's params to paramValues.`,
        );
      }

      if (
        error.message.startsWith(
          "Core: paramValues were provided for a route that does not exist: ",
        )
      ) {
        const route = error.message.match(/'(.+)'/)?.[1] ?? "";
        throw new Error(
          `TanStack Start sitemap: paramValues were provided for a route that does not exist: '${route}'. Remove this property from paramValues or update your TanStack route source.`,
        );
      }
    }

    throw error;
  }
}

export async function response({
  additionalPaths = [],
  defaultChangefreq,
  defaultPriority,
  excludeRoutePatterns,
  headers = {},
  lang,
  locale,
  maxPerPage = 50_000,
  origin,
  page,
  paramValues,
  processPaths,
  sort = false,
  ...routeInput
}: TanStackStartSitemapConfig): Promise<Response> {
  if (!origin) {
    throw new Error("TanStack Start sitemap: `origin` property is required in sitemap config.");
  }

  const paths = prepareTanStackStartSitemapPaths({
    additionalPaths,
    defaultChangefreq,
    defaultPriority,
    excludeRoutePatterns,
    lang,
    locale,
    paramValues,
    processPaths,
    sort,
    ...routeInput,
  });

  const totalPages = getTotalPages(paths, maxPerPage);

  let body: string;
  if (!page) {
    body =
      paths.length <= maxPerPage
        ? renderSitemapXml(origin, paths)
        : renderSitemapIndexXml(origin, totalPages);
  } else {
    const paginatedPaths = paginatePaths({ maxPerPage, page, paths });
    if (paginatedPaths.kind === "invalid-page") {
      return new Response("Invalid page param", { status: 400 });
    }
    if (paginatedPaths.kind === "not-found") {
      return new Response("Page does not exist", { status: 404 });
    }

    body = renderSitemapXml(origin, paginatedPaths.paths);
  }

  return new Response(body, { headers: getHeaders({ customHeaders: headers }) });
}

function prepareTanStackStartSitemapPaths({
  additionalPaths = [],
  defaultChangefreq,
  defaultPriority,
  excludeRoutePatterns,
  lang,
  locale,
  paramValues,
  processPaths,
  sort = false,
  ...routeInput
}: Omit<TanStackStartSitemapConfig, "headers" | "maxPerPage" | "origin" | "page">): PathObj[] {
  let paths = [
    ...generateTanStackStartPaths({
      defaultChangefreq,
      defaultPriority,
      excludeRoutePatterns,
      lang,
      locale,
      paramValues,
      ...routeInput,
    }),
    ...generateAdditionalPaths({
      additionalPaths,
      defaultChangefreq,
      defaultPriority,
    }),
  ];

  if (processPaths) {
    paths = processPaths(paths);
  }

  return sortPaths(deduplicatePaths(paths), sort);
}

function stripUndefinedPathMetadata(pathObj: PathObj): PathObj {
  return Object.fromEntries(
    Object.entries(pathObj).filter(([, value]) => value !== undefined),
  ) as PathObj;
}

function getTanStackStartRouteRecordsFromRoutesByPath(
  routeInput: TanStackStartRouteInput,
): TanStackStartRouteRecord[] {
  const routesByPath = getCachedTanStackStartRouter(routeInput.router).routesByPath;

  if (!routesByPath) {
    throw new Error("TanStack Start sitemap: `router` must return a router with `routesByPath`.");
  }

  return Object.entries(routesByPath)
    .map(([routesByPathKey, route]) => createTanStackStartRouteRecord(routesByPathKey, route))
    .filter(isEmittableRouteRecord)
    .sort((a, b) => getCompatibilityPath(a).localeCompare(getCompatibilityPath(b)));
}

/**
 * Returns the cached TanStack router for a stable router factory.
 *
 * @param routerFactory - The app's exported `getRouter` function.
 * @returns The cached TanStack router.
 */
function getCachedTanStackStartRouter<
  TRouter extends TanStackStartRouterRoutesByPath = TanStackStartRouterRoutesByPath,
>(routerFactory: TanStackStartRouterFactory<TRouter>): TanStackStartRouter<TRouter> {
  if (typeof routerFactory !== "function") {
    throw new Error("TanStack Start sitemap: `router` must be your app's `getRouter` function.");
  }

  const cachedRouter = routerCache.get(routerFactory);
  if (cachedRouter) {
    return cachedRouter as TanStackStartRouter<TRouter>;
  }

  const router = routerFactory();
  routerCache.set(routerFactory, router);
  return router;
}

/**
 * Normalizes TanStack's generated route records without depending on their exact exported type.
 */
function createTanStackStartRouteRecord(
  routesByPathKey: string,
  route: unknown,
): TanStackStartRouteRecord {
  const routeRecord = isRouteRecordObject(route) ? route : {};

  return {
    filePath: getOptionalStringRouteField(routeRecord, "filePath"),
    fullPath: getOptionalStringRouteField(routeRecord, "fullPath"),
    id: getOptionalStringRouteField(routeRecord, "id"),
    path: getOptionalStringRouteField(routeRecord, "path"),
    routesByPathKey,
    to: getOptionalStringRouteField(routeRecord, "to"),
  };
}

/**
 * Checks whether a route entry can contain route metadata fields.
 */
function isRouteRecordObject(route: unknown): route is Record<string, unknown> {
  return typeof route === "object" && route !== null;
}

/**
 * Reads a route metadata field only when TanStack exposes it as a string.
 */
function getOptionalStringRouteField(
  route: Record<string, unknown>,
  field: keyof TanStackStartResolvedRoute,
): string | undefined {
  const value = route[field];
  return typeof value === "string" ? value : undefined;
}

function parseTanStackStartRouteTemplates(
  route: TanStackStartRouteRecord | string,
  options: ParseTanStackStartRouteTemplatesOptions = {},
): TanStackStartRouteTemplate[] {
  const routeRecord = typeof route === "string" ? { fullPath: route } : route;
  const sourcePath = getCompatibilityPath(routeRecord);
  const parsedSegments = splitPath(sourcePath).map(parseTanStackStartSegment);
  const variants = expandSegmentVariants(parsedSegments, options.locale);

  return variants.map((segments) =>
    createRouteTemplate({
      compatibilityKey: toPath(segments.map((segment) => segment.compatibilityKeySegment)),
      localeMapping: options.locale,
      routeRecord,
      routeSegments: segments.flatMap((segment) => (segment.segment ? [segment.segment] : [])),
    }),
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
    if (segment.kind === "locale") {
      locale = {
        matcher: segment.matcher,
        mode: localeMapping?.mode ?? "required",
        paramName: segment.name,
        segmentIndex,
      };
      return;
    }

    if (segment.kind === "param") {
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
      adapter: "tanstack-start",
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
    Object.entries(source).filter(([, value]) => value !== undefined),
  ) as TanStackStartRouteSource;
}

function isEmittableRouteRecord(route: TanStackStartRouteRecord): boolean {
  if (route.id === "__root__") return false;
  if (!hasRoutePathField(route)) return false;

  const sourcePath = getCompatibilityPath(route);
  if (sourcePath === "/") return true;

  return splitPath(sourcePath).some((segment) => !isPathlessSegment(segment));
}

function hasRoutePathField(route: TanStackStartRouteRecord): boolean {
  return (
    typeof route.fullPath === "string" ||
    typeof route.to === "string" ||
    typeof route.path === "string" ||
    typeof route.routesByPathKey === "string" ||
    typeof route.id === "string"
  );
}

function expandSegmentVariants(
  segments: ParsedSegment[],
  locale: TanStackStartLocaleMapping | undefined,
): SegmentVariant[][] {
  let variants: SegmentVariant[][] = [[]];

  for (const segment of segments) {
    const additions = getSegmentVariants(segment, locale);
    variants = variants.flatMap((variant) =>
      additions.map((addition) => (addition ? [...variant, addition] : variant)),
    );
  }

  return variants.length ? variants : [[]];
}

function getSegmentVariants(
  segment: ParsedSegment,
  locale: TanStackStartLocaleMapping | undefined,
): Array<SegmentVariant | undefined> {
  if (segment.kind === "omit") {
    return [undefined];
  }

  if (segment.kind === "static") {
    return [
      {
        compatibilityKeySegment: segment.value,
        segment: { kind: "static", value: segment.value },
      },
    ];
  }

  const isRestParam = segment.kind === "param" && segment.rest;
  const compatibilityKeySegment = isRestParam ? "$" : `$${segment.name}`;
  const optionalCompatibilityKeySegment =
    segment.kind === "optional-param" ? `{-$${segment.name}}` : compatibilityKeySegment;

  if (locale?.paramName === segment.name) {
    return [
      {
        compatibilityKeySegment: optionalCompatibilityKeySegment,
        segment: {
          kind: "locale",
          matcher: locale.matcher,
          name: segment.name,
        },
      },
    ];
  }

  const paramVariant = {
    compatibilityKeySegment: optionalCompatibilityKeySegment,
    segment: {
      kind: "param",
      name: segment.name,
      rest: segment.kind === "param" ? segment.rest : false,
    },
  } satisfies SegmentVariant;

  if (segment.kind === "optional-param") {
    return [undefined, paramVariant];
  }

  return [paramVariant];
}

function getCompatibilityPath(route: TanStackStartRouteRecord): string {
  return normalizePath(
    route.fullPath ?? route.to ?? route.path ?? route.routesByPathKey ?? route.id ?? "/",
  );
}

function normalizePath(routePath: string): string {
  const normalizedPath = routePath.trim();

  if (!normalizedPath || normalizedPath === "/") return "/";

  return toPath(splitPath(normalizedPath));
}

function parseTanStackStartSegment(segment: string): ParsedSegment {
  if (isPathlessSegment(segment)) {
    return { kind: "omit" };
  }

  if (segment === "$") {
    return { kind: "param", name: "_splat", rest: true };
  }

  const optionalParamMatch = OPTIONAL_PARAM_SEGMENT_REGEX.exec(segment);
  if (optionalParamMatch) {
    return { kind: "optional-param", name: optionalParamMatch[1] ?? "" };
  }

  if (segment.startsWith("$")) {
    return { kind: "param", name: segment.slice(1), rest: false };
  }

  return { kind: "static", value: segment };
}

function isPathlessSegment(segment: string): boolean {
  return (
    segment === "index" ||
    segment === "__root__" ||
    segment.startsWith("_") ||
    (segment.startsWith("(") && segment.endsWith(")"))
  );
}

function splitPath(routePath: string): string[] {
  return routePath.split("/").filter(Boolean);
}

function toPath(segments: Array<string | undefined>): string {
  const path = segments.filter(Boolean).join("/");
  return path ? `/${path}` : "/";
}
