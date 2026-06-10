import { normalizePath } from './paths.js';
import type { NormalizedRoute, PathObj } from './types.js';

export type SelectSamplePathsOptions = {
  /** Optional canonicalizer applied to each path before dedupe and sampling. */
  getCanonicalPath?: (path: string) => string;
  /** Normalized routes used to match paths back to route shapes. */
  normalizedRoutes: NormalizedRoute[];
  /** Prepared sitemap path objects (after `processPaths`, dedupe, and sort). */
  paths: PathObj[];
};

type SampleRouteMatcher = {
  compatibilityKey: string;
  regex: RegExp;
  score: number;
};

/**
 * Selects one canonical sample path for each route shape found in the prepared
 * sitemap paths. Paths that match no normalized route, such as `additionalPaths`
 * pointing at static assets, are ignored.
 */
export function selectSamplePaths({
  getCanonicalPath = identityPath,
  normalizedRoutes,
  paths,
}: SelectSamplePathsOptions): string[] {
  const canonicalPaths = deduplicateStrings(
    paths.map(({ path }) => normalizePath(getCanonicalPath(path)))
  );
  const matchers = createSampleRouteMatchers(normalizedRoutes);

  const sampledCompatibilityKeys = new Set<string>();
  const samples: string[] = [];

  for (const path of canonicalPaths) {
    const matcher = matchers.find(({ regex }) => regex.test(path));

    if (!matcher || sampledCompatibilityKeys.has(matcher.compatibilityKey)) {
      continue;
    }

    sampledCompatibilityKeys.add(matcher.compatibilityKey);
    samples.push(path);
  }

  return samples;
}

/**
 * Returns the input path unchanged for default sample path canonicalization.
 */
function identityPath(path: string): string {
  return path;
}

/**
 * Creates deterministic route matchers that prefer specific static routes over
 * broad parameterized routes.
 */
function createSampleRouteMatchers(normalizedRoutes: NormalizedRoute[]): SampleRouteMatcher[] {
  return normalizedRoutes
    .map((normalizedRoute) => ({
      compatibilityKey: normalizedRoute.source.compatibilityKey,
      regex: normalizedRouteToRegex(normalizedRoute),
      score: getNormalizedRouteSpecificityScore(normalizedRoute),
    }))
    .sort((a, b) => b.score - a.score || a.compatibilityKey.localeCompare(b.compatibilityKey));
}

/**
 * Converts a normalized route into a pathname matcher.
 */
function normalizedRouteToRegex(normalizedRoute: NormalizedRoute): RegExp {
  if (normalizedRoute.segments.length === 0) {
    return /^\/$/;
  }

  const pattern = normalizedRoute.segments
    .map((segment) => {
      if (segment.kind === 'static') {
        return `/${escapeRegex(segment.value)}`;
      }

      if (segment.kind === 'locale') {
        return '(?:/[^/]+)?';
      }

      return segment.rest ? '/.+' : '/[^/]+';
    })
    .join('');

  return new RegExp(`^${pattern}$`);
}

/**
 * Scores normalized routes so static routes beat dynamic siblings that can match
 * the same concrete path.
 */
function getNormalizedRouteSpecificityScore(normalizedRoute: NormalizedRoute): number {
  return normalizedRoute.segments.reduce((score, segment) => {
    if (segment.kind === 'static') return score + 100;
    if (segment.kind === 'param' && !segment.rest) return score + 10;
    if (segment.kind === 'param' && segment.rest) return score + 1;
    return score;
  }, normalizedRoute.segments.length);
}

/**
 * Deduplicates strings while preserving first-seen order.
 */
function deduplicateStrings(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Escapes a path segment for use in a regular expression.
 */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
