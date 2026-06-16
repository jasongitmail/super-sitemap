export function routeMatchesPattern(pattern: RegExp, routeKey: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(routeKey);
}
