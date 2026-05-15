import fs from 'node:fs';
import path from 'node:path';

/**
 * Discovers SvelteKit page route files using Vite's glob import metadata.
 * Endpoints such as +server.ts are intentionally excluded.
 */
export function discoverSvelteKitPageRouteFiles(): string[] {
  const svelteRoutes = Object.keys(import.meta.glob('/src/routes/**/+page*.svelte'));
  const mdRoutes = Object.keys(import.meta.glob('/src/routes/**/+page*.md'));
  const svxRoutes = Object.keys(import.meta.glob('/src/routes/**/+page*.svx'));

  return svelteRoutes.concat(mdRoutes, svxRoutes);
}

/**
 * Discovers SvelteKit page route files from an on-disk src/routes directory.
 *
 * This is used by compatibility utilities that run outside Vite's import.meta.glob
 * context, such as sampledPaths()/sampledUrls().
 */
export function discoverSvelteKitPageRouteFilesFromDirectory(routesDir: string): string[] {
  return listFilePathsRecursively(routesDir)
    .filter(isSvelteKitPageRouteFile)
    .map((filePath) => toSvelteKitRouteFilePath(routesDir, filePath));
}

/**
 * Checks whether an on-disk file path is a SvelteKit page route file.
 */
export function isSvelteKitPageRouteFile(filePath: string): boolean {
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

function toSvelteKitRouteFilePath(routesDir: string, filePath: string): string {
  const relativePath = path.relative(routesDir, filePath).split(path.sep).join('/');
  return `/src/routes/${relativePath}`;
}
