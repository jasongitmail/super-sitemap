import { sveltekit } from '@sveltejs/kit/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: {
      'super-sitemap/sveltekit': fileURLToPath(
        new URL('../../src/adapters/sveltekit/index.ts', import.meta.url)
      ),
    },
  },
  test: {
    include:
      process.env.FRAMEWORK_ROUTING === '1'
        ? ['tests/framework-routing.test.ts']
        : ['src/**/*.test.ts', 'tests/sitemap.test.ts'],
  },
});
