## Sitemap Index

_**You only need to read and enable if you have >50,000 URLs in your sitemap, which is the number
recommended by [sitemaps.org](https://www.sitemaps.org/protocol.html).**_

Enable sitemap index support with just two changes:

1. Rename your route so it serves `/sitemap.xml` and `/sitemap1.xml`, `/sitemap2.xml`, etc.
2. Pass the page param via your sitemap config

<details>
<summary>TanStack Start example</summary>

```ts
// /src/routes/sitemap{-$page}[.]xml.ts
import { createFileRoute } from '@tanstack/react-router';
import { response } from 'super-sitemap/tanstack-start';
import { getRouter } from '../router';

export const Route = createFileRoute('/sitemap{-$page}.xml')({
  server: {
    handlers: {
      GET: ({ params }) =>
        response({
          origin: 'https://example.com',
          router: getRouter,
          page: params.page,
          // maxPerPage: 45_000 // optional; default 50_000
        }),
    },
  },
});
```

</details>

<details>
<summary>SvelteKit example</summary>

```ts
// /src/routes/sitemap[[page]].xml/+server.ts
import type { RequestHandler } from '@sveltejs/kit';
import { response } from 'super-sitemap/sveltekit';

export const GET: RequestHandler = async ({ params }) => {
  return await response({
    origin: 'https://example.com',
    page: params.page,
    // maxPerPage: 45_000 // optional; default 50_000
  });
};
```

</details>

Your `sitemap.xml` route will now return a sitemap index automatically when it
contains more URLs than `maxPerPage` (default 50,000), or a regular sitemap otherwise.

Feel free to always set up your sitemap as a sitemap index, since it works
optimally whether you have few or many URLs.

<details>
<summary>Example sitemap index</summary>

```xml
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap1.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap2.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap3.xml</loc>
  </sitemap>
</sitemapindex>
```

</details>
