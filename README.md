<div align="center">
  <img src="/docs/assets/readme-header.webp" alt="Super Sitemap">

  <p>Sitemap focused on ease of use <br>and making it impossible to forget to add your paths.<br>For TanStack Start and SvelteKit.</p>

  <a href="https://github.com/jasongitmail/super-sitemap/blob/main/LICENSE">
    <img alt="license badge" src="https://img.shields.io/npm/l/super-sitemap?color=limegreen">
  </a>
  <a href="https://www.npmjs.com/package/super-sitemap">
    <img alt="npm badge" src="https://img.shields.io/npm/v/super-sitemap?color=limegreen">
  </a>
  <a href="https://github.com/jasongitmail/super-sitemap/actions/workflows/ci.yml">
    <img alt="unit tests badge" src="https://img.shields.io/github/actions/workflow/status/jasongitmail/super-sitemap/ci.yml?label=tests">
  </a>
</div>

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
  - [Basic example](#basic-example)
  - [The "everything" example](#the-everything-example)
  - [Sitemap Index](#sitemap-index)
  - [Param Values](#param-values)
  - [Optional Params](#optional-params)
  - [`processPaths()` callback](#processpaths-callback)
  - [i18n](#i18n)
  - [Get Sample Paths](#get-sample-paths)
- [Robots.txt](#robotstxt)
- [Playwright test](#playwright-test)
- [Tip: Querying your database to get param values](#tip-querying-your-database-to-get-param-values)
- [Example sitemap output](#example-sitemap-output)
- [Migrating from v1 to v2](#migrating-from-v1)
- [Changelog](#changelog)

## Features

- 🤓 Supports any rendering method.
- 🪄 Automatically gathers routes + data for route parameters provided by you.
- 👻 Exclude routes via `excludeRoutePatterns` (e.g. `/^\/dashboard/`, paginated routes, etc)
- 🧠 Easy maintenance. Accidental omission of data for a parameterized route
  throws an error until either, a.) the route excluded via
  `excludeRoutePatterns`, or b.) data is provided for its param value(s).
- 🚀 Defaults to 1h CDN cache, no browser cache.
- 💆 Set custom headers to override default headers: `sitemap.response({ headers: { 'cache-control': 'max-age=0, s-maxage=60' } })`.
- 💡 Google, and other modern search engines, [ignore `priority` and
  `changefreq`](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap#xml)
  and use their own heuristics to determine when to crawl pages on your site. As
  such, these properties are not included by default to minimize KB size and
  enable faster crawling. Optionally, you can enable them via:
  `sitemap.response({ defaultChangefreq: 'daily', defaultPriority: 0.7 })`.
- 🗺️ Automatic [sitemap index](#sitemap-index).
- 🌎 [i18n](#i18n)
- 🧪 Well tested.
- ✨ Zero runtime dependencies.
- 🫶 Built with TypeScript.

## Installation

`npm i -D super-sitemap`

or

`bun add -d super-sitemap`

Then see the [Usage](#usage), [Robots.txt](#robotstxt), & [Playwright Test](#playwright-test) sections.

## Usage

## Basic example

### TanStack Start

```ts
// /src/routes/sitemap[.]xml.ts
import { createFileRoute } from '@tanstack/react-router';
import { response } from 'super-sitemap/tanstack-start';
import { getRouter } from '../router';

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () =>
        response({
          origin: 'https://example.com',
          router: getRouter,
        }),
    },
  },
});
```

### SvelteKit

```ts
// /src/routes/sitemap.xml/+server.ts
import type { RequestHandler } from '@sveltejs/kit';
import * as sitemap from 'super-sitemap/sveltekit';

export const GET: RequestHandler = async () => {
  return await sitemap.response({
    origin: 'https://example.com',
  });
};
```

- Always include the `.xml` extension on your route name–e.g. `sitemap.xml`.
  This ensures your web server sends the correct `application/xml` content type
  even if you decide to prerender your sitemap to a static file.
- Automatic route discovery:
  - The SvelteKit adapter discovers routes using Vite's `import.meta.glob`.
  - The TanStack Start adapter discovers routes via TanStack Start's official
    `getRouter`, which is derived from its generated route manifest file. This means
    that _all_ TanStack Start routing methods are fully supported: file-based
    routing, code-based routing, or virtual file routes.
- For all frameworks: server-only routes are excluded automatically and do not
  need to be listed in your route exclusions.

## The "everything" example

_All config properties shown here are optional, except for `origin` and
`paramValues` to provide data for parameterized routes._

<details>
<summary>TanStack Start example</summary>

```ts
// /src/routes/sitemap[.]xml.ts
import { createFileRoute } from '@tanstack/react-router';
import * as blog from '../lib/data/blog';
import { response, type PathObj } from 'super-sitemap/tanstack-start';
import { getRouter } from '../router';

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        // Get data for parameterized routes however you need to; this is only an example.
        let blogSlugs, blogTags;
        try {
          [blogSlugs, blogTags] = await Promise.all([blog.getSlugs(), blog.getTags()]);
        } catch (err) {
          throw new Error('Could not load data for param values.');
        }

        return await response({
          origin: 'https://example.com',
          router: getRouter,
          excludeRoutePatterns: [
            /^\/dashboard/, // i.e. routes starting with `/dashboard`
            /\{\-\$page\}/, // i.e. routes containing `{-$page}`–e.g. `/blog/2`
            /^\/admin(?:$|\/)/, // i.e. routes within an admin section
          ],
          paramValues: {
            // paramValues can be a 1D array of strings
            '/blog/$slug': blogSlugs, // e.g. ['hello-world', 'another-post']
            '/blog/tag/$tag': blogTags, // e.g. ['red', 'green', 'blue']

            // Or a 2D array of strings
            '/campsites/$country/$state': [
              ['usa', 'new-york'],
              ['usa', 'california'],
              ['canada', 'toronto'],
            ],

            // Or an array of ParamValue objects
            '/athlete-rankings/$country/$state': [
              {
                values: ['usa', 'new-york'], // required
                lastmod: '2025-01-01T00:00:00Z', // optional
                changefreq: 'daily', // optional
                priority: 0.5, // optional
              },
              {
                values: ['usa', 'california'],
                lastmod: '2025-01-01T00:00:00Z',
                changefreq: 'daily',
                priority: 0.5,
              },
            ],
          },
          headers: {
            'custom-header': 'foo', // case insensitive; xml content type & 1h CDN cache headers are included by default
          },
          additionalPaths: [
            '/foo.pdf', // for example, to a file in your public dir
          ],
          defaultChangefreq: 'daily',
          defaultPriority: 0.7,
          sort: 'alpha', // default is false; 'alpha' sorts paths alphabetically.
          processPaths: (paths: PathObj[]) => {
            // Optional callback to allow arbitrary processing of your path objects. See the
            // processPaths() section of the README.
            return paths;
          },
        });
      },
    },
  },
});
```

</details>

<details>
<summary>SvelteKit example</summary>

```ts
// /src/routes/sitemap.xml/+server.ts
import { error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import * as blog from '$lib/data/blog';
import * as sitemap from 'super-sitemap/sveltekit';

export const prerender = true; // optional

export const GET: RequestHandler = async () => {
  // Get data for parameterized routes however you need to; this is only an example.
  let blogSlugs, blogTags;
  try {
    [blogSlugs, blogTags] = await Promise.all([blog.getSlugs(), blog.getTags()]);
  } catch (err) {
    throw error(500, 'Could not load data for param values.');
  }

  return await sitemap.response({
    origin: 'https://example.com',
    excludeRoutePatterns: [
      /^\/dashboard/, // i.e. routes starting with `/dashboard`
      /\[page=integer\]/, // i.e. routes containing `[page=integer]`–e.g. `/blog/2`
      /\(authenticated\)/, // i.e. routes within a group
    ],
    paramValues: {
      // paramValues can be a 1D array of strings
      '/blog/[slug]': blogSlugs, // e.g. ['hello-world', 'another-post']
      '/blog/tag/[tag]': blogTags, // e.g. ['red', 'green', 'blue']

      // Or a 2D array of strings
      '/campsites/[country]/[state]': [
        ['usa', 'new-york'],
        ['usa', 'california'],
        ['canada', 'toronto'],
      ],

      // Or an array of ParamValue objects
      '/athlete-rankings/[country]/[state]': [
        {
          values: ['usa', 'new-york'], // required
          lastmod: '2025-01-01T00:00:00Z', // optional
          changefreq: 'daily', // optional
          priority: 0.5, // optional
        },
        {
          values: ['usa', 'california'],
          lastmod: '2025-01-01T00:00:00Z',
          changefreq: 'daily',
          priority: 0.5,
        },
      ],
    },
    headers: {
      'custom-header': 'foo', // case insensitive; xml content type & 1h CDN cache headers are included by default
    },
    additionalPaths: [
      '/foo.pdf', // for example, to a file in your static dir
    ],
    defaultChangefreq: 'daily',
    defaultPriority: 0.7,
    sort: 'alpha', // default is false; 'alpha' sorts paths alphabetically.
    processPaths: (paths: sitemap.PathObj[]) => {
      // Optional callback to allow arbitrary processing of your path objects. See the
      // processPaths() section of the README.
      return paths;
    },
  });
};
```

</details>

## Sitemap Index

_**You only need to read and enable if you have >50,000 URLs in your sitemap, which is the number
recommended by [sitemaps.org](https://www.sitemaps.org/protocol.html).**_

You can enable sitemap index support with just two changes.

See the [Sitemap Index docs](./docs/readme-details/sitemap-index.md).

## Param Values

When specifying values for the params of your parameterized routes,
you can use any of the following types:
`string[]`, `string[][]`, or `ParamValue[]`. See examples below.

Note: Syntax differs between frameworks to mirror how each framework specifies required params and optional params.

_Author's note: I'm still deciding if the better library DX is to use framework-specific or framework-agnostic syntax to specify required params & optional params in the keys for paramValues. So this may change before 2.0 lands._

<details>
<summary>TanStack Start example</summary>

```ts
paramValues: {
  // Required params use TanStack's `$param` syntax.
  '/blog/$slug': ['hello-world', 'another-post'],

  // Optional params use TanStack's `{-$param}` syntax.
  '/blog/{-$category}': ['tech', 'design'],

  // Multiple params use a 2D array, matched positionally.
  '/campsites/$country/$state': [
    ['usa', 'colorado'],
    ['canada', 'toronto'],
  ],

  // Splat/rest params use TanStack's bare `$` segment.
  '/docs/$': ['intro/getting-started'],

  // Locale params can appear in keys, but locale values come from `lang`
  // and `langParam`; only non-locale params are provided here.
  '/$locale/blog/$slug': ['hello-world'],
  '/{-$locale}/docs/$slug': ['intro'],

  // Pathless layout segments and route group directories are omitted from keys.
  // For example, `/_layout/(dashboard)/users/$id` is keyed as:
  '/users/$id': ['42'],

  // Optional params expand into route variants. The base route (`/something`)
  // needs no values, but dynamic variants need values unless excluded. For
  // multiple optional params, provide values for each emitted dynamic variant
  // that you keep.
  '/something/{-$paramA}': ['foo', 'bar'],
  '/something/{-$paramA}/{-$paramB}': [
    ['foo', 'one'],
    ['bar', 'two'],
  ],

  // If you need per-entry metadata, use ParamValue objects.
  '/athlete-rankings/$country/$state': [
    {
      values: ['usa', 'new-york'], // required
      lastmod: '2025-01-01T00:00:00Z', // optional
      changefreq: 'daily', // optional
      priority: 0.5, // optional
    },
    {
      values: ['usa', 'california'],
      lastmod: '2025-01-01T01:16:52Z',
      changefreq: 'daily',
      priority: 0.5,
    },
  ],
},
```

</details>

<details>
<summary>SvelteKit example</summary>

```ts
paramValues: {
  // Required params use SvelteKit's `[param]` syntax.
  '/blog/[slug]': ['hello-world', 'another-post'],

  // Optional params use SvelteKit's `[[param]]` syntax.
  '/blog/[[category]]': ['tech', 'design'],

  // Matcher params preserve the matcher name in the key.
  '/blog/[page=integer]': ['2', '3'],
  '/archive/[[year=integer]]': ['2024', '2025'],

  // Multiple params use a 2D array, matched positionally.
  '/campsites/[country]/[state]': [
    ['usa', 'colorado'],
    ['canada', 'toronto'],
  ],

  // Rest params use SvelteKit's `[...rest]` syntax.
  '/docs/[...rest]': ['intro/getting-started'],

  // Locale params can appear in keys, but locale values come from `lang`;
  // only non-locale params are provided here.
  '/[[lang]]/blog/[slug]': ['hello-world'],
  '/[lang]/docs/[slug]': ['intro'],

  // Route groups are omitted from keys.
  // For example, `/(dashboard)/users/[id]` is keyed as:
  '/users/[id]': ['42'],

  // Optional params expand into route variants. The base route (`/something`)
  // needs no values, but dynamic variants need values unless excluded.
  '/something/[[paramA]]': ['foo', 'bar'],
  '/something/[[paramA]]/[[paramB]]': [
    ['foo', 'one'],
    ['bar', 'two'],
  ],

  // If you need per-entry metadata, use ParamValue objects.
  '/athlete-rankings/[country]/[state]': [
    {
      values: ['usa', 'new-york'], // required
      lastmod: '2025-01-01T00:00:00Z', // optional
      changefreq: 'daily', // optional
      priority: 0.5, // optional
    },
    {
      values: ['usa', 'california'],
      lastmod: '2025-01-01T01:16:52Z',
      changefreq: 'daily',
      priority: 0.5,
    },
  ],
},
```

</details>

If your data does not provide values for `lastmod`,
`changefreq`, `priority` (i.e. ParamValue's optional properties), the default value for these defined in your
sitemap config will be used. If you also did not define a default value, then the property will be excluded from that entry.

Hint: it's acceptable to exclude these 3 properties because modern search engines defer to their own heuristics to schedule crawls anyway, especially if you specify `lastmod` but don't update it consistently with changes to that same content.

### Allowed `paramValues` keys

`paramValues` keys must match Super Sitemap's framework-specific route
compatibility keys. In most cases, that means using the same route param syntax
your framework uses. See examples:

| Route feature                         | TanStack Start key                                       | SvelteKit key                                              |
| ------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------- |
| Required param                        | `'/blog/$slug'`                                          | `'/blog/[slug]'`                                           |
| Optional param                        | `'/blog/{-$category}'`                                   | `'/blog/[[category]]'`                                     |
| Required params (2+)                  | `'/campsites/$country/$state'`                           | `'/campsites/[country]/[state]'`                           |
| Optional params (2+), longest variant | `'/something/{-$paramA}/{-$paramB}'`                     | `'/something/[[paramA]]/[[paramB]]'`                       |
| Optional params (2+), shorter variant | `'/something/{-$paramA}'`                                | `'/something/[[paramA]]'`                                  |
| Splat / rest param                    | `'/docs/$'`                                              | `'/docs/[...rest]'`                                        |
| Param matcher                         | (No equivalent)                                          | `'/blog/[page=integer]'`                                   |
| Optional matcher                      | (No equivalent)                                          | `'/archive/[[year=integer]]'`                              |
| Route groups are omitted              | On disk: `/(dashboard)/users/$id`<br>Use: `'/users/$id'` | On disk: `/(dashboard)/users/[id]`<br>Use: `'/users/[id]'` |
| Pathless layout segments, on disk     | `/_layout/users/$id`                                     | (No equivalent.)                                           |
| Pathless layout segments, use         | `'/users/$id'`                                           | (No equivalent.)                                           |
| Optional locale param                 | `'/{-$locale}/blog/$slug'` with `langParam`              | `'/[[lang]]/blog/[slug]'`                                  |
| Required locale param                 | `'/$locale/docs/$slug'` with `langParam`                 | `'/[lang]/docs/[slug]'`                                    |

If in doubt, enable prerendering for your sitemap and build your app; you'll see build errors if you're missing any required paramValues keys or if yours are different from what super sitemap expects.

## Optional Params

_**You only need to read this if you want to understand how super sitemap handles optional params and why.**_

Optional params expand into route variants. Super Sitemap will include each
path variation and will require you to either exclude those route patterns using
`excludeRoutePatterns` or provide param values for them using `paramValues`,
within your sitemap config object.

<details>
<summary>TanStack Start example</summary>

TanStack Start optional params like `/posts/{-$category}` expand the same
way — use TanStack syntax in your `paramValues` keys and JavaScript `RegExp`
objects in `excludeRoutePatterns`.

For example, these `excludeRoutePatterns` patterns match TanStack Start route
keys, not generated URLs:

```ts
excludeRoutePatterns: [
  /^\/blog\/\$slug$/, // dynamic route such as `/blog/$slug`
  /^\/posts$/, // only `/posts`, not `/posts/{-$category}`
  /^\/posts\/\{-\$category\}$/, // only `/posts/{-$category}`
  /^\/posts(?:$|\/)/, // `/posts` and `/posts/{-$category}`
  /^\/docs\/\$$/, // splat route such as `/docs/$`
  /^\/dashboard(?:$|\/)/, // `/dashboard` and nested dashboard routes
];
```

Route groups and pathless layout segments are omitted from TanStack compatibility
keys before matching, so exclude the resulting public route key, such as
`/^\/dashboard(?:$|\/)/`, instead of the group folder name.

</details>

<details>
<summary>SvelteKit example</summary>

SvelteKit allows you to create a route with one or more optional parameters like this:

```text
src/
  routes/
    something/
      [[paramA]]/
        [[paramB]]/
          +page.svelte
          +page.ts
```

Your app would then respond to HTTP requests for all of the following:

- `/something`
- `/something/foo`
- `/something/foo/bar`

Consequently, Super Sitemap will include all such path variations in your
sitemap and will require you to either exclude these using
`excludeRoutePatterns` or provide param values for them using `paramValues`,
within your sitemap config object.

For example:

- `/something` will exist in your sitemap unless excluded with a `RegExp` like
  `/\/something$/`.
- `/something/[[paramA]]` must be either excluded using an `excludeRoutePatterns`
  entry like `/\/something\/\[\[paramA\]\]$/` _or_ appear within your config's
  `paramValues` like this: `'/something/[[paramA]]': ['foo', 'foo2', 'foo3']`.
- And `/something/[[paramA]]/[[paramB]]` must be either excluded using an
  `excludeRoutePatterns` entry like `/\/something\/\[\[paramA\]\]\/\[\[paramB\]\]$/`
  _or_ appear within your config's `paramValues` like this:
  `'/something/[[paramA]]/[[paramB]]': [['foo','bar'], ['foo2','bar2'], ['foo3','bar3']]`.

Alternatively, you can exclude ALL versions of this route by providing a single
`RegExp` object within `excludeRoutePatterns` that matches all of them, such as
`/\/something/`; notice this does NOT end with a `$`, thereby allowing this
pattern to match all 3 versions of this route.

If you plan to mix and match use of `excludeRoutePatterns` and `paramValues` for
a given route that contains optional params, terminate all of your
`excludeRoutePatterns` regular expressions for that route with `$`, to target
only the specific desired versions of that route.

</details>

## processPaths() callback

The `processPaths()` callback is powerful, but rarely needed.

It allows you to arbitrarily process the path objects for your site before they become XML.

See the [Process Paths docs](./docs/readme-details/process-paths.md).

## i18n

Super Sitemap supports [multilingual site
annotations](https://developers.google.com/search/blog/2012/05/multilingual-and-multinational-site). This allows search engines to be aware of alternate
language versions of your pages.

See the [i18n docs](./docs/readme-details/i18n.md).

## Get Sample Paths

`getSamplePaths()` is useful when you want one visitable path for each public route shape, usually for testing or monitoring purposes.

See the [Get Sample Paths docs](./docs/readme-details/sample-paths.md).

## Robots.txt

Create a `robots.txt` so search engines know where to find your sitemap.

Create it at:

- SvelteKit: `/static/robots.txt`
- TanStack Start: `/public/robots.txt`

```text
User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml
```

## Playwright Test

It's recommended to set up an e2e test, like Playwright, that calls your sitemap route.

Why? For _pre-rendered_ sitemaps, `paramValues` are loaded _at build time_, so
misconfigurations fail during the build. But for _non-prerendered_ sitemaps,
`paramValues` are loaded _at runtime_, so a functional test is necessary to
catch configuration mistakes before deployment.

<details>
  <summary>PlayWright example</summary>

```js
// /src/tests/sitemap.test.js

import { expect, test } from '@playwright/test';

test('/sitemap.xml is valid', async ({ page }) => {
  const response = await page.goto('/sitemap.xml');
  expect(response.status()).toBe(200);

  // Ensure XML is valid. Playwright parses the XML here and will error if it
  // cannot be parsed.
  const urls = await page.$$eval('url', (urls) =>
    urls.map((url) => ({
      loc: url.querySelector('loc').textContent,
      // changefreq: url.querySelector('changefreq').textContent, // if you enabled in your sitemap
      // priority: url.querySelector('priority').textContent,
    }))
  );

  // Sanity check
  expect(urls.length).toBeGreaterThan(5);

  // Ensure entries are in a valid format.
  for (const url of urls) {
    expect(url.loc).toBeTruthy();
    expect(() => new URL(url.loc)).not.toThrow();
    // expect(url.changefreq).toBe('daily');
    // expect(url.priority).toBe('0.7');
  }
});
```

</details>

## Tip: Querying your database to get param values

Examples of how to query an SQL database to obtain data to provide as
`paramValues` for your routes:

```SQL
-- Route: /blog/[slug]
SELECT slug FROM blog_posts WHERE status = 'published';

-- Route: /blog/category/[category]
SELECT DISTINCT LOWER(category) FROM blog_posts WHERE status = 'published';

-- Route: /campsites/[country]/[state]
SELECT DISTINCT LOWER(country), LOWER(state) FROM campsites;
```

Using `DISTINCT` prevents duplicates in your result set. Use this when your
table could contain multiple rows with the same params, like in the 2nd and 3rd
examples.

Then if your result is an array of objects, convert into a 2D array of string
values:

```js
const arrayOfArrays = resultFromDB.map((row) => Object.values(row));
// [['usa','new-york'],['usa', 'california']]
```

That's it.

## Example sitemap output

<details>
  <summary>Click to expand</summary>

```xml
  <urlset
    xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
    xmlns:xhtml="http://www.w3.org/1999/xhtml"
  >
    <url>
        <loc>https://example/</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>https://example/about</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>https://example/blog</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>https://example/login</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>https://example/pricing</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>https://example/privacy</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>https://example/signup</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>https://example/support</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>https://example/terms</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>https://example/blog/hello-world</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>https://example/blog/another-post</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>https://example/blog/tag/red</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>https://example/blog/tag/green</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>https://example/blog/tag/blue</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>https://example/campsites/usa/new-york</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>https://example/campsites/usa/california</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>https://example/campsites/canada/toronto</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>https://example/foo.pdf</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
</urlset>
```

</details>

## Migrating from v1 to v2

- **Use the new, framework-specific import:**
  - `import * as sitemap from 'super-sitemap/sveltekit'`, or
  - `import * as sitemap from 'super-sitemap/tanstack-start'`
- **`excludeRoutePatterns` now uses JavaScript regex literals, not strings.**
  - E.g. Use `/^\/dashboard/`, not `"^/dashboard"`.
- **`sampledUrls()` and `sampledPaths()` were removed.**
  - Use [`getSamplePaths()`](#sample-paths) instead.

## Changelog

- `1.0.13-tanstack.3` (unreleased) - BREAKING: `excludeRoutePatterns` now accepts JavaScript `RegExp` objects instead of regex source strings. BREAKING: TanStack Start's `locale` config property renamed to `langParam`; `GetSvelteKitHeadersOptions`/`GetTanStackStartHeadersOptions` unified as `GetHeadersOptions`; error messages are now prefixed `super-sitemap:` instead of framework-specific prefixes. The TanStack Start adapter now automatically excludes server-only routes (server handlers without a component, e.g. the sitemap route itself, robots.txt, API routes) from sitemap output. Removed the `svelte` peer dependency—Super Sitemap now has zero peer dependencies. Removed Node built-ins from shipped code for edge-runtime compatibility (e.g. Cloudflare Workers). Added runnable example apps (`examples/sveltekit`, `examples/tanstack-start`) that integration-test the documented usage.
- `1.0.13-tanstack.1` - BREAKING: public APIs now live at `super-sitemap/sveltekit` and `super-sitemap/tanstack-start`. Adds `getSamplePaths()` to both adapters.
- `1.0.11` - Remove all runtime dependencies!
- `1.0.0` - BREAKING: `priority` renamed to `defaultPriority`, and `changefreq` renamed to `defaultChangefreq`. NON-BREAKING: Support for `paramValues` to contain either `string[]`, `string[][]`, or `ParamValueObj[]` values to allow per-path specification of `lastmod`, `changefreq`, and `priority`.
- `0.15.0` - BREAKING: Rename `excludePatterns` to `excludeRoutePatterns`.
- `0.14.20` - Adds [processPaths() callback](#processpaths-callback).
- `0.14.19` - Support `.md` and `.svx` route extensions for msdvex users.
- `0.14.17` - Support for param matchers (e.g. `[[lang=lang]]`) &
  required lang params (e.g. `[lang]`). Thanks @JadedBlueEyes & @epoxide!
- `0.14.13` - Support route files named to allow [breaking out of a layout](https://kit.svelte.dev/docs/advanced-routing#advanced-layouts-breaking-out-of-layouts).
- `0.14.12` - Adds [`i18n`](#i18n) support.
- `0.14.11` - Adds [`optional params`](#optional-params) support.
- `0.14.0` - Adds [`sitemap index`](#sitemap-index) support.
- `0.13.0` - Added legacy `sampledUrls()` and `sampledPaths()` utilities.
- `0.12.0` - Adds config option to sort `'alpha'` or `false` (default).
- `0.11.0` - BREAKING: Rename to `super-sitemap` on npm! 🚀
- `0.10.0` - Adds ability to use unlimited dynamic params per route! 🎉
- `0.9.0` - BREAKING: Adds configurable `changefreq` and `priority` and
  _excludes these by default_. See the README's features list for why.
- `0.8.0` - Adds ability to specify `additionalPaths` that live outside
  `/src/routes`, such as `/foo.pdf` located at `/static/foo.pdf`.

## Contributing

```bash
git clone https://github.com/jasongitmail/super-sitemap.git
bun install
bun run test      # unit tests for src/core and src/adapters
bun run check     # type checking
bun run lint
```

Runnable example apps live in `examples/sveltekit` and `examples/tanstack-start`.
Each is a self-contained app that imports the library from source and serves as
both an integration test and a dev playground:

```bash
cd examples/sveltekit   # or examples/tanstack-start
bun install
bun run test            # end-to-end sitemap tests against the real framework
bun run dev             # browse the example, including /sitemap.xml
```

## Publishing

Main release:

A new version of this npm package is automatically published when the semver
version within `package.json` is incremented.

TanStack prerelease:

```sh
git switch tanstack
npm run npm:version:tanstack
npm run npm:publish:tanstack
```

## Credits

- Built by [x.com/@zkjason\_](https://twitter.com/zkjason_)
- Made possible by [SvelteKit](https://kit.svelte.dev/) & [Svelte](https://svelte.dev/).
