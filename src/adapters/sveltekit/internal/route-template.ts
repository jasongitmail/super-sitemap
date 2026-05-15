import type {
  RouteLocaleSlot,
  RouteParam,
  RouteSegment,
  RouteTemplate,
} from '../../../core/internal/types.js';

const LANG_TOKEN_REGEX = /\/?\[(\[lang(=[a-z]+)?\]|lang(=[a-z]+)?)\]/;
const PARAM_SEGMENT_REGEX = /^\[(\[?)(\.\.\.)?([^\]=]+)(?:=([^\]]+))?\]?\]$/;

/**
 * Creates a regex matching SvelteKit optional or required lang route tokens.
 */
export function findSvelteKitLangToken(): RegExp {
  return new RegExp(LANG_TOKEN_REGEX);
}

export type ParseSvelteKitRouteTemplateOptions = {
  filePath?: string;
  route: string;
};

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

type ParsedSvelteKitParamSegment = {
  matcher?: string;
  name: string;
  optional: boolean;
  rest?: boolean;
};

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
