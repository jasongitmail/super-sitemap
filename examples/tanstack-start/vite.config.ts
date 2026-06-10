import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import viteReact from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    // The TanStack Start plugin must come before react()'s plugin. It also
    // generates `src/routeTree.gen.ts` from the files in `src/routes`.
    tanstackStart(),
    viteReact(),
  ],
  resolve: {
    alias: {
      // Resolve the library's TanStack Start adapter to this repo's source so
      // the example integration-tests the real adapter code.
      'super-sitemap/tanstack-start': fileURLToPath(
        new URL('../../src/adapters/tanstack-start/index.ts', import.meta.url)
      ),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
