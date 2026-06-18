/**
 * Validates runtime route exclusion config from JavaScript or untyped config files.
 *
 * @remarks
 * TypeScript catches this for typed callers, but package users can still pass
 * invalid values from JavaScript config, casts, or serialized config.
 */
export function validateExcludeRoutePatterns(
  excludeRoutePatterns: unknown
): asserts excludeRoutePatterns is readonly RegExp[] {
  if (!Array.isArray(excludeRoutePatterns)) {
    throw new Error(
      `super-sitemap: \`excludeRoutePatterns\` must be an array of RegExp values. Received ${describeInvalidPattern(
        excludeRoutePatterns
      )}.`
    );
  }

  for (const [index, pattern] of excludeRoutePatterns.entries()) {
    if (pattern instanceof RegExp) continue;

    if (typeof pattern === 'string') {
      throw new Error(
        `super-sitemap: \`excludeRoutePatterns[${index}]\` must be a RegExp, not a string. Use a regex literal like /dashboard/ instead of "/dashboard".`
      );
    }

    throw new Error(
      `super-sitemap: \`excludeRoutePatterns[${index}]\` must be a RegExp. Received ${describeInvalidPattern(
        pattern
      )}.`
    );
  }
}

/**
 * Tests a route key against a route exclusion pattern.
 */
export function routeMatchesPattern(pattern: RegExp, routeKey: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(routeKey);
}

/**
 * Formats invalid config values without assuming they are safely serializable.
 */
function describeInvalidPattern(pattern: unknown): string {
  if (pattern === null) return 'null';
  if (pattern === undefined) return 'undefined';
  return typeof pattern;
}
