# getSamplePaths()

_**`getSamplePaths()` is optional. It is useful when you want one visitable path for each public route shape.**_

Sample paths are root-relative paths generated from the same sitemap config you
use for `sitemap.xml`. Static routes return themselves, e.g. `/about`.
Parameterized routes return one concrete path, e.g. `/blog/hello-world` for
`/blog/[slug]` or `/blog/$slug`.

This is useful for overview routes or tests that fetch representative pages to
inspect SEO metadata, OG images, status codes, and other route-level behavior.

`getSamplePaths()` samples from final public sitemap paths after `processPaths`.
It does not fetch or parse `sitemap.xml`, and it does not expose paths beyond
what your sitemap config already exposes. If you publish `/sample-paths`
publicly, keep private or authenticated routes excluded in your sitemap config.

`additionalPaths` that do not match an app route, such as PDFs, are ignored.

<details>
<summary>View TanStack Start example</summary>

```ts
// /src/routes/sample-paths.ts
import { createFileRoute } from '@tanstack/react-router';
import { getSamplePaths } from 'super-sitemap/tanstack-start';
import { getRouter } from '../router';

export const Route = createFileRoute('/sample-paths')({
  server: {
    handlers: {
      GET: () => {
        const samplePaths = getSamplePaths({
          sitemapConfig: {
            origin: 'https://example.com',
            router: getRouter,
            excludeRoutePatterns: [/^\/dashboard/, /^\/admin\//],
            paramValues: {
              '/blog/$slug': ['hello-world', 'another-post'],
              '/campsites/$country/$state': [
                ['usa', 'new-york'],
                ['canada', 'ontario'],
              ],
            },
          },
        });

        return Response.json(samplePaths);
      },
    },
  },
});
```

</details>

<details>
<summary>View SvelteKit example</summary>

```ts
// /src/lib/sitemap-config.ts
import type { SitemapConfig } from 'super-sitemap/sveltekit';
import * as blog from '$lib/data/blog';

export async function getSitemapConfig(): Promise<SitemapConfig> {
  return {
    origin: 'https://example.com',
    excludeRoutePatterns: [/^\/dashboard/, /\(authenticated\)/],
    paramValues: {
      '/blog/[slug]': await blog.getSlugs(),
    },
  };
}
```

```ts
// /src/routes/sitemap.xml/+server.ts
import * as sitemap from 'super-sitemap/sveltekit';
import { getSitemapConfig } from '$lib/sitemap-config';

export async function GET(): Promise<Response> {
  return sitemap.response(await getSitemapConfig());
}
```

```ts
// /src/routes/sample-paths/+server.ts
import { getSamplePaths } from 'super-sitemap/sveltekit';
import { getSitemapConfig } from '$lib/sitemap-config';

export async function GET(): Promise<Response> {
  const samplePaths = getSamplePaths({
    sitemapConfig: await getSitemapConfig(),
  });

  return Response.json(samplePaths);
}
```

</details>

Both adapters support an optional `getCanonicalPath` callback. Use it when your
final sitemap paths contain localized variants that should collapse into one
sample before route matching:

```ts
getSamplePaths({
  sitemapConfig,
  getCanonicalPath: (path) => path.replace(/^\/(de|es|zh)(?=\/|$)/, '') || '/',
});
```
