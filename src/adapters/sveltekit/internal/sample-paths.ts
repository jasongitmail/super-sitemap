import type { RouteTemplate } from '../../../core/internal/types.js';
import type { GetSamplePathsOptions } from './types.js';

import { createSvelteKitRouteTemplates } from './routes.js';
import { prepareSvelteKitSitemapPaths } from './sitemap.js';

type SampleRouteMatcher = {
  compatibilityKey: string;
  regex: RegExp;
  score: number;
};

/**
 * Returns one canonical sample path for each sitemap-published SvelteKit route shape.
 *
 * @remarks
 * Design rationale:
 * - avoids fetching/parsing sitemap XML
 * - reuses the exact sitemap config
 * - samples from final public sitemap paths after `processPaths`
 * - exposes no paths beyond what the sitemap exposes by default
 * - keeps auth/private-route exclusion DRY in sitemap config
 * - keeps the mental model simple: `/sample-paths` is a sampled view of `/sitemap.xml`
 *
 * `getCanonicalPath` exists because canonicalization must run before dedupe and
 * sampling. For example, localized variants like `/es/contact` and `/contact`
 * need to collapse into one route sample before they are matched against route
 * templates. The default canonicalizer returns each path unchanged.
 *
 * If `getCanonicalPath` maps paths into new values, that is explicit caller
 * behavior, but inventing paths that are not canonical forms of
 * sitemap-published paths is not recommended and would be considered an
 * anti-pattern. There should be no reason to do this.
 *
 * Private or authenticated routes must be excluded from the sitemap config. This
 * helper intentionally reuses the sitemap as the source of truth instead of
 * maintaining a second exclusion policy.
 *
 * Paths that do not match a SvelteKit route, including typical `additionalPaths`
 * such as PDFs, are ignored because they do not correspond to a SvelteKit route.
 *
 * @param options - Sample path options.
 * @returns Canonical root-relative sample paths.
 */
export function getSamplePaths({
  getCanonicalPath = identityPath,
  sitemapConfig,
}: GetSamplePathsOptions): string[] {
  const paths = prepareSvelteKitSitemapPaths(sitemapConfig).map(({ path }) =>
    normalizePath(getCanonicalPath(path))
  );
  const canonicalPaths = deduplicateStrings(paths);
  const matchers = createSampleRouteMatchers(
    createSvelteKitRouteTemplates({
      excludeRoutePatterns: sitemapConfig.excludeRoutePatterns,
      lang: sitemapConfig.lang,
      routeFiles: sitemapConfig.routeFiles,
    })
  );

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
function createSampleRouteMatchers(templates: RouteTemplate[]): SampleRouteMatcher[] {
  return templates
    .map((template) => ({
      compatibilityKey: template.source.compatibilityKey,
      regex: routeTemplateToRegex(template),
      score: getRouteTemplateSpecificityScore(template),
    }))
    .sort((a, b) => b.score - a.score || a.compatibilityKey.localeCompare(b.compatibilityKey));
}

/**
 * Converts a normalized route template into a pathname matcher.
 */
function routeTemplateToRegex(template: RouteTemplate): RegExp {
  if (template.segments.length === 0) {
    return /^\/$/;
  }

  const pattern = template.segments
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
 * Scores route templates so static routes beat dynamic siblings that can match
 * the same concrete path.
 */
function getRouteTemplateSpecificityScore(template: RouteTemplate): number {
  return template.segments.reduce((score, segment) => {
    if (segment.kind === 'static') return score + 100;
    if (segment.kind === 'param' && !segment.rest) return score + 10;
    if (segment.kind === 'param' && segment.rest) return score + 1;
    return score;
  }, template.segments.length);
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

function normalizePath(routePath: string): string {
  const normalizedPath = routePath.trim();

  if (!normalizedPath || normalizedPath === '/') return '/';

  return toPath(splitPath(normalizedPath));
}

function splitPath(routePath: string): string[] {
  return routePath.split('/').filter(Boolean);
}

function toPath(segments: Array<string | undefined>): string {
  const path = segments.filter(Boolean).join('/');
  return path ? `/${path}` : '/';
}
