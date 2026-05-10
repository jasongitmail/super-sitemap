import type { PathObj, SitemapConfig } from './types.js';

/**
 * Removes duplicate paths from an array of PathObj, keeping the last occurrence of any duplicates.
 *
 * - Duplicate pathObjs could occur due to a developer using additionalPaths or processPaths() and
 *   not properly excluding a pre-existing path.
 */
export function deduplicatePaths(pathObjs: PathObj[]): PathObj[] {
  const uniquePaths = new Map<string, PathObj>();

  for (const pathObj of pathObjs) {
    uniquePaths.set(pathObj.path, pathObj);
  }

  return Array.from(uniquePaths.values());
}

/**
 * Converts the user-provided `additionalPaths` into `PathObj[]` type, ensuring each path starts
 * with a forward slash and each PathObj contains default changefreq and priority.
 *
 * - `additionalPaths` are never translated based on the lang config because they could be something
 *   like a PDF within the user's static dir.
 */
export function generateAdditionalPaths({
  additionalPaths,
  defaultChangefreq,
  defaultPriority,
}: {
  additionalPaths: string[];
  defaultChangefreq: SitemapConfig['defaultChangefreq'];
  defaultPriority: SitemapConfig['defaultPriority'];
}): PathObj[] {
  const defaults = {
    changefreq: defaultChangefreq,
    lastmod: undefined,
    priority: defaultPriority,
  };

  return additionalPaths.map((path) => ({
    ...defaults,
    path: path.startsWith('/') ? path : `/${path}`,
  }));
}

export function sortPaths(paths: PathObj[], sort: SitemapConfig['sort']): PathObj[] {
  if (sort !== 'alpha') return paths;

  return [...paths].sort((a, b) => a.path.localeCompare(b.path));
}
