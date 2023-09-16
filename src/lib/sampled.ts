import { XMLParser } from 'fast-xml-parser';

import { filterRoutes } from './sitemap';

/**
 * Given this site's sitemap.xml, returns an array containing:
 * 1. the URL of every static (non-parameterized) route, and
 * 2. one URL for every parameterized route.
 *
 * @public
 * @remarks
 * - This function is intended as a utility for data analysis, such as SEO
 *   evaluation.
 * - The design favors zero maintenance, consuming `sitemap.xml` directly to
 *   avoid needing to duplicate param values or exclusion rules, favoring
 *   DRYness over performance given its intention as a utility.
 *
 * @param sitemapXml - The XML string of the sitemap to analyze. This must have
 *                     been created by SK Sitemap in order for the logic to work
 *                     as intended.
 * @returns Array of URLs, sorted alphabetically
 *
 * @example
 * ```ts
 * const response = await fetch('https://localhost:5173/sitemap.xml');
 * const sitemapXml = await response.text();
 * const result = await sampledUrls(sitemapXml);
 * ```
 */
export async function sampledUrls(sitemapXml: string): Promise<string[]> {
  const parser = new XMLParser();
  const sitemap = parser.parse(sitemapXml);

  const urls = sitemap.urlset.url.map((x) => x.loc);
  let routes = Object.keys(import.meta.glob('/src/routes/**/+page.svelte'));

  // Filter to reformat from file paths into site paths. excludePatterns can be
  // left empty because these were applied when sitemap.xml was generated.
  routes = filterRoutes(routes, []);

  const staticRoutes = [];
  const dynamicRoutes = [];
  for (const route of routes) {
    if (/\[.*\]/.test(route)) {
      dynamicRoutes.push(route);
    } else {
      staticRoutes.push(route);
    }
  }

  // Remove static route URLs from array of URLs
  const origin = new URL(urls[0]).origin;
  const staticUrls = new Set(staticRoutes.map((path) => origin + path));

  // Convert dynamic routes into regex patterns
  // - Use set to make unique. Duplicates could occur given we haven't applied
  //   excludePatterns to the dynamic **routes** (e.g. `/blog/[page=integer]`
  //   and `/blog/[slug]` both become `/blog/[^/]+`). When we sample URLs for
  //   each of these patterns, the excluded routes wont' even exist in the URLs
  //   from the sitemap, so it's not a problem.
  const regexPatterns = new Set(
    dynamicRoutes.map((path: string) => path.replace(/\[[^\]]+\]/g, '([^/]+)'))
  );

  // Get one URL for each dynamic route
  const sampledDynamicUrls = findFirstMatches(regexPatterns, urls);

  return [...staticUrls, ...sampledDynamicUrls].sort();
}

/**
 * Given this site's `sitemap.xml`, returns an array containing:
 * 1. the path of every static (non-parameterized) route, and
 * 2. one path for every parameterized route.
 *
 * This method is identical to `sampledUrls()`, but returns paths instead.
 *
 * @public
 * @param sitemapXml - The XML string of the sitemap to analyze. This must have
 *                     been created by SK Sitemap in order for the logic to work
 *                     as intended.
 * @returns Array of paths, sorted alphabetically.
 *
 * @example
 * ```ts
 * const response = await fetch('https://localhost:5173/sitemap.xml');
 * const sitemapXml = await response.text();
 * const result = await sampledPaths(sitemapXml);
 * ```
 */
export async function sampledPaths(sitemapXml: string): Promise<string[]> {
  const urls = await sampledUrls(sitemapXml);
  return urls.map((url: string) => new URL(url).pathname);
}

/**
 * Finds the first instance of a string within an array that matches each given
 * regex pattern within a set of patterns.
 *
 * @private
 * @param regexPatterns - Set of regex patterns to search for.
 * @param haystack - Array of strings to search within.
 * @returns Set of strings where each is the first match found for a pattern.
 *
 * @example
 * ```ts
 * const patterns = new Set(["a.*", "b.*"]);
 * const haystack = ["apple", "banana", "cherry"];
 * const result = findFirstMatches(patterns, haystack); // Set { 'apple', 'banana' }
 * ```
 */
export function findFirstMatches(regexPatterns: Set<string>, haystack: string[]): Set<string> {
  const firstMatches = new Set<string>();

  for (const pattern of regexPatterns) {
    const regex = new RegExp(pattern);

    for (const needle of haystack) {
      if (regex.test(needle)) {
        firstMatches.add(needle);
        break;
      }
    }
  }

  return firstMatches;
}
