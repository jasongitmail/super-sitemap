const PAGE_ROUTE_FILE_REGEX = /\/\+page.*\.(svelte|md|svx)$/;
const ROUTE_GROUP_REGEX = /\/\([^)]+\)/g;
const SRC_ROUTES_PREFIX = '/src/routes';

/**
 * Converts a SvelteKit page route file path into the legacy route key shape
 * used by Super Sitemap's compatibility API.
 */
export function normalizeSvelteKitRouteFile(filePath: string): string {
  let route = filePath.startsWith(SRC_ROUTES_PREFIX)
    ? filePath.slice(SRC_ROUTES_PREFIX.length)
    : filePath;

  route = route.replace(PAGE_ROUTE_FILE_REGEX, '');
  return route || '/';
}

/**
 * Removes decorative route groups after compatibility exclusions have run.
 */
export function removeSvelteKitRouteGroups(route: string): string {
  const normalized = route.replaceAll(ROUTE_GROUP_REGEX, '');
  return normalized || '/';
}

export function sortSvelteKitRoutes(routes: string[]): string[] {
  return [...routes].sort();
}
