import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  discoverSvelteKitPageRouteFiles,
  discoverSvelteKitPageRouteFilesFromDirectory,
  listFilePathsRecursively,
} from './discovery.js';

describe('SvelteKit route discovery', () => {
  it('discovers page routes and excludes endpoint-only files', () => {
    const routes = discoverSvelteKitPageRouteFiles();

    expect(routes).toContain('/src/routes/(public)/[[lang]]/about/+page.svelte');
    expect(routes).toContain('/src/routes/(public)/markdown-md/+page.md');
    expect(routes).toContain('/src/routes/(public)/markdown-svx/+page.svx');
    expect(routes).not.toContain('/src/routes/(public)/[[lang]]/sitemap[[page]].xml/+server.ts');
    expect(routes.some((route) => route.includes('+server.'))).toBe(false);
  });

  it('returns the full path of each file in nested directories', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'super-sitemap-'));
    const nestedDir = path.join(tmpDir, 'nested', 'deeper');

    try {
      fs.mkdirSync(nestedDir, { recursive: true });
      const rootFile = path.join(tmpDir, '+page.svelte');
      const nestedFile = path.join(tmpDir, 'nested', '+page@.svelte');
      const deepFile = path.join(nestedDir, '+page.md');

      fs.writeFileSync(rootFile, '');
      fs.writeFileSync(nestedFile, '');
      fs.writeFileSync(deepFile, '');

      expect(listFilePathsRecursively(tmpDir).sort()).toEqual(
        [deepFile, nestedFile, rootFile].sort()
      );
    } finally {
      fs.rmSync(tmpDir, { force: true, recursive: true });
    }
  });

  it('discovers supported page file variants from disk and excludes endpoints', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'super-sitemap-routes-'));

    try {
      const files = [
        '+page.svelte',
        'terms/+page@.svelte',
        'break/+page@foo.svelte',
        'break-dynamic/+page@[id].svelte',
        'break-group/+page@(id).svelte',
        'markdown/+page.md',
        'content/+page.svx',
        'api/+server.ts',
      ];

      for (const file of files) {
        const filePath = path.join(tmpDir, file);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, '');
      }

      expect(discoverSvelteKitPageRouteFilesFromDirectory(tmpDir).sort()).toEqual(
        [
          '/src/routes/+page.svelte',
          '/src/routes/break/+page@foo.svelte',
          '/src/routes/break-dynamic/+page@[id].svelte',
          '/src/routes/break-group/+page@(id).svelte',
          '/src/routes/content/+page.svx',
          '/src/routes/markdown/+page.md',
          '/src/routes/terms/+page@.svelte',
        ].sort()
      );
    } finally {
      fs.rmSync(tmpDir, { force: true, recursive: true });
    }
  });
});
