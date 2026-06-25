/**
 * Expands consecutive optional path segments using prefix-only routing semantics.
 *
 * @remarks
 * Frameworks such as SvelteKit and TanStack Start allow optional path segments
 * to be omitted only from the right edge of a consecutive optional segment run.
 *
 * @param routeVariants - Route segment variants built before the optional run.
 * @param optionalSegments - Consecutive optional route segments to expand.
 * @returns Route variants with every valid optional segment prefix appended.
 */
export function expandOptionalSegmentPrefixVariants<T>(
  routeVariants: T[][],
  optionalSegments: T[]
): T[][] {
  if (!optionalSegments.length) {
    return routeVariants;
  }

  return routeVariants.flatMap((variant) =>
    Array.from({ length: optionalSegments.length + 1 }, (_, prefixLength) => [
      ...variant,
      ...optionalSegments.slice(0, prefixLength),
    ])
  );
}
