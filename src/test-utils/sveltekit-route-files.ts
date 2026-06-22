import fs from 'node:fs';
import path from 'node:path';

/**
 * Test-only helpers for discovering SvelteKit page route files from disk.
 *
 * Production route discovery uses Vite's `import.meta.glob` (see
 * `src/adapters/sveltekit/internal/routes.ts`). These on-disk equivalents let
 * tests build route file fixtures without a Vite module graph. They live
 * outside `src/adapters` and `src/core` so Node built-ins never ship in the
 * published package, which must stay safe for edge runtimes.
 */

/**
 * Discovers SvelteKit page route files from an on-disk src/routes directory.
 */
export function discoverSvelteKitPageRouteFilesFromDirectory(routesDir: string): string[] {
  return listFilePathsRecursively(routesDir)
    .filter(isSvelteKitPageRouteFile)
    .map((filePath) => toSvelteKitRouteFilePath(routesDir, filePath));
}

/**
 * Checks whether an on-disk file path is a SvelteKit page route file.
 */
function isSvelteKitPageRouteFile(filePath: string): boolean {
  return /\/\+page.*\.(svelte|md|svx)$/.test(filePath.replaceAll(path.sep, '/'));
}

/**
 * Recursively reads a directory and returns the full disk path of each file.
 *
 * @param dirPath - The directory to traverse.
 * @returns An array of strings representing full disk file paths.
 */
export function listFilePathsRecursively(dirPath: string): string[] {
  const paths: string[] = [];

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      paths.push(...listFilePathsRecursively(entryPath));
      continue;
    }

    if (entry.isFile()) {
      paths.push(entryPath);
    }
  }

  return paths;
}

/**
 * Converts an on-disk page route file path into SvelteKit's Vite-style route path.
 */
function toSvelteKitRouteFilePath(routesDir: string, filePath: string): string {
  const relativePath = path.relative(routesDir, filePath).split(path.sep).join('/');
  return `/src/routes/${relativePath}`;
}
