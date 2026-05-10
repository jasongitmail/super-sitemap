import { findSvelteKitLangToken } from './route-template.js';

/**
 * Given an array of SvelteKit route keys, return a new array that includes all
 * valid SvelteKit variants for routes that contain optional params other than
 * the locale param.
 */
export function expandSvelteKitOptionalRoutes(routes: string[]): string[] {
  const processedRoutes = routes.flatMap((route) => {
    const routeWithoutLangIfAny = route.replace(findSvelteKitLangToken(), '');
    return /\[\[.*\]\]/.test(routeWithoutLangIfAny) ? expandSvelteKitOptionalRoute(route) : route;
  });

  return Array.from(new Set(processedRoutes));
}

/**
 * Expands one SvelteKit route containing optional parameters into the route
 * variants SvelteKit considers valid.
 */
export function expandSvelteKitOptionalRoute(originalRoute: string): string[] {
  const hasLang = findSvelteKitLangToken().exec(originalRoute);
  const route = hasLang ? originalRoute.replace(findSvelteKitLangToken(), '') : originalRoute;

  let results: string[] = [];

  results.push(route.slice(0, route.indexOf('[[') - 1));

  const remaining = route.slice(route.indexOf('[['));
  const segments = remaining.split('/').filter(Boolean);

  let j = 1;
  for (const segment of segments) {
    if (!results[j]) results[j] = results[j - 1];

    results[j] = `${results[j]}/${segment}`;

    if (segment.startsWith('[[')) {
      j++;
    }
  }

  if (hasLang) {
    const lang = hasLang[0];
    results = results.map(
      (result) => `${result.slice(0, hasLang.index)}${lang}${result.slice(hasLang.index)}`
    );
  }

  if (!results[0].length) results[0] = '/';

  return results;
}
