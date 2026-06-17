<div align="center">
  <img src="/docs/assets/readme-header.webp" alt="Super Sitemap">

  <p>Sitemap library focused on ease of use <br>and making it impossible to forget to add your paths.</p>
  <p>For TanStack Start and SvelteKit.</p>

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
  - [Sample Paths](#sample-paths)
- [Robots.txt](#robotstxt)
- [Playwright test](#playwright-test)
- [Tip: Querying your database to get param values](#tip-querying-your-database-to-get-param-values)
- [Example sitemap output](#example-sitemap-output)
- [Migrating from v1](#migrating-from-v1)
- [Changelog](#changelog)

## Features

- 🤓 Supports any rendering method.
- 🪄 Automatically gathered routes + data for route parameters provided by you.
- 🧠 Easy maintenance. Accidental omission of data for a parameterized route
  throws an error until either, a.) the route excluded via
  `excludeRoutePatterns`, or b.) data is provided for its param value(s).
- 👻 Exclude routes via `excludeRoutePatterns` (e.g. `/^\/dashboard/`, paginated routes, etc)
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

<details>
<summary>View TanStack Start example</summary>

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

</details>

<details>
<summary>View SvelteKit example</summary>

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

</details>

- Always include the `.xml` extension on your route name–e.g. `sitemap.xml`.
  This ensures your web server sends the correct `application/xml` content type
  even if you decide to prerender your sitemap to a static file.
- Automatic route discovery:
  - The SvelteKit adapter discovers routes using Vite's `import.meta.glob`.
  - The TanStack Start adapter discovers routes via TanStack Start's official
    `getRouter`, which is derived from generated route manifest file. This means
    that _all_ TanStack Start routing methods are fully supported: file-based
    routing, code-based routing, or virtual file routes.
- For all frameworks: server-only routes are excluded automatically and do not
  need to be listed in your route exclusions.

## The "everything" example

_**All aspects of the below example are optional, except for `origin` and
`paramValues` to provide data for parameterized routes.**_

<details>
<summary>View TanStack Start example</summary>

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
<summary>View SvelteKit example</summary>

```ts
// /src/routes/sitemap.xml/+server.ts
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

_**You only need to enable or read this if you will have >=50,000 URLs in your sitemap, which is the number
recommended by Google.**_

You can enable sitemap index support with just two changes:

1. Rename your route so it serves `/sitemap.xml` and `/sitemap1.xml`, `/sitemap2.xml`, etc.
2. Pass the page param via your sitemap config

<details>
<summary>View TanStack Start example</summary>

Name the route file `sitemap{-$page}[.]xml.ts` — an optional `page` param with
a `sitemap` prefix and an escaped-dot `.xml` suffix:

```ts
// /src/routes/sitemap{-$page}[.]xml.ts
export const Route = createFileRoute('/sitemap{-$page}.xml')({
  server: {
    handlers: {
      GET: ({ params }) =>
        response({
          origin: 'https://example.com',
          page: params.page,
        }),
    },
  },
});
```

</details>

<details>
<summary>View SvelteKit example</summary>

```ts
// /src/routes/sitemap[[page]].xml/+server.ts
import type { RequestHandler } from '@sveltejs/kit';
import * as sitemap from 'super-sitemap/sveltekit';

export const GET: RequestHandler = async ({ params }) => {
  return await sitemap.response({
    origin: 'https://example.com',
    page: params.page,
    // maxPerPage: 45_000 // optional; default is 50_000
  });
};
```

</details>

**Feel free to always set up your sitemap as a sitemap index, given it will work
optimally whether you have few or many URLs.**

Your `sitemap.xml` route will now return a sitemap index when it contains more URLs than the `maxPerPage` setting (optional & defaults to 50,000 as recommended by [sitemaps.org](https://www.sitemaps.org/protocol.html)). Your sitemap will be a non-index, regular sitemap when fewer URLs than `maxPerPage` are present.

Example sitemap index:

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

## Param Values

When specifying values for the params of your parameterized routes,
you can use any of the following types:
`string[]`, `string[][]`, or `ParamValue[]`.

Property names use your framework's own route syntax: SvelteKit routes use
square brackets (`/blog/[slug]`, `/[[lang]]/about`) and TanStack Start routes
use TanStack syntax (`/blog/$slug`, `/docs/$`, `/blog/{-$category}`). Values
work identically for both adapters.

<details>
<summary>View TanStack Start example</summary>

```ts
paramValues: {
  '/blog/$slug': ['hello-world', 'another-post'],
  '/campsites/$country/$state': [
    ['usa', 'colorado'],
    ['canada', 'toronto']
  ],
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
<summary>View SvelteKit example</summary>

```ts
paramValues: {
  '/blog/[slug]': ['hello-world', 'another-post']
  '/campsites/[country]/[state]': [
    ['usa', 'colorado'],
    ['canada', 'toronto']
  ],
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

If any of the optional properties of `ParamValue` are not provided (`lastmod`,
`changefreq`, `priority`), the sitemap will use the default
value. If a default value is not defined, the property will be excluded from that sitemap entry.

## Optional Params

_**You only need to read this if you want to understand how super sitemap handles optional params and why.**_

Optional params expand into route variants. Super Sitemap will include each
path variation and will require you to either exclude those route patterns using
`excludeRoutePatterns` or provide param values for them using `paramValues`,
within your sitemap config object.

<details>
<summary>View TanStack Start example</summary>

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
<summary>View SvelteKit example</summary>

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

_**The `processPaths()` callback is powerful, but rarely needed.**_

It allows you to arbitrarily process the path objects for your site before they become XML, with the
only requirement that your callback function must return the expected `PathObj[]`
shape.

This can be useful to do something bespoke that would not otherwise be possible. For example:

1. Excluding a specific path, when `excludeRoutePatterns` based on the _route
   pattern_ would be too broad. (For example, you might want to exclude a path
   when you have not yet translated its content into one or more of your site’s
   supported languages; e.g. to exclude only `/zh/about`, but retain all others
   like `/about`, `/es/about`, etc.)
2. Adding a trailing slash to URLs (not a recommended style, but possible).
3. Appending paths from an external sitemap, like from a hosted headless blog
   backend. However, you can also accomplish this by providing these within the
   `additionalPaths` array in your super sitemap config, which is a more concise approach.

`processPaths()` runs after all paths have been generated for your site, but prior to de-duplication
of paths based on unique path names, sorting (if enabled by your config), and creation of XML.

Note that `processPaths()` is intentionally NOT async. This design decision is
to encourage a consistent pattern within the sitemap request handler where all HTTP
requests, including any to fetch param values from a database, [occur
together using `Promise.all()`](<https://github.com/jasongitmail/super-sitemap/blob/main/src/routes/(public)/%5B%5Blang%5D%5D/sitemap%5B%5Bpage%5D%5D.xml/%2Bserver.ts#L14-L20>), for best performance and consistent code pattern
among super sitemap users for best DX.

### Example code - to remove specific paths

```ts
return await sitemap.response({
  // ...
  processPaths: (paths: sitemap.PathObj[]) => {
    const pathsToExclude = ['/zh/about', '/de/team'];
    return paths.filter(({ path }) => !pathsToExclude.includes(path));
  },
});
```

Note: If using `excludeRoutePatterns`–which matches again the _route_ pattern–would
be sufficient for your needs, you should prefer it for performance reasons. This
is because a site will have fewer routes than paths, consequently route-based
exclusions are more performant than path-based exclusions. Although, the
difference will be inconsequential in virtually all cases, unless you have a
very large number of excluded paths and many millions of generated paths to
search within.

### Example code - to add trailing slashes

```ts
return await sitemap.response({
  // ...
  processPaths: (paths: sitemap.PathObj[]) => {
    // Add trailing slashes to all paths. (This is just an example and not
    // actually recommended. Using SvelteKit's default of no trailing slash is
    // preferable because it provides consistency among all possible paths,
    // even files like `/foo.pdf`.)
    return paths.map(({ path, alternates, ...rest }) => {
      const rtrn = { path: path === '/' ? path : `${path}/`, ...rest };

      if (alternates) {
        rtrn.alternates = alternates.map((alternate: sitemap.Alternate) => ({
          ...alternate,
          path: alternate.path === '/' ? alternate.path : `${alternate.path}/`,
        }));
      }

      return rtrn;
    });
  },
});
```

## i18n

Super Sitemap supports [multilingual site
annotations](https://developers.google.com/search/blog/2012/05/multilingual-and-multinational-site)
within your sitemap. This allows search engines to be aware of alternate
language versions of your pages.

<details>
<summary>View TanStack Start example</summary>

TanStack Start has no equivalent of SvelteKit's `[[lang]]` convention, so the
TanStack adapter never infers a language param. Instead, declare which route
param holds the language value using the `langParam` config property, alongside
the same `lang` config described above:

```ts
// Routes like /{-$locale}/about (optional) or /$locale/about (required)
const sitemapConfig = {
  origin: 'https://example.com',
  router: getRouter,
  lang: {
    default: 'en', // e.g. /about
    alternates: ['zh', 'de'], // e.g. /zh/about, /de/about
  },
  langParam: {
    paramName: 'locale', // your route param's name, without TanStack syntax
    mode: 'optional', // 'optional' for {-$locale}, 'required' for $locale
  },
} satisfies SitemapConfig;
```

</details>

<details>
<summary>View SvelteKit example</summary>

### Set up

1. Create a directory named `[[lang]]` at `src/routes/[[lang]]`. Place any
   routes that you intend to translate inside here.
   - **This parameter must be named `lang`.**
   - This parameter can specify a [param
     matcher](https://kit.svelte.dev/docs/advanced-routing#matching), if
     desired. For example: `src/routes/(public)/[[lang=lang]]`, when you defined
     a param matcher at `src/params/lang.js`. The param matcher can have any
     name as long as it uses only lowercase letters.
   - This directory can be located within a route group, if desired, e.g.
     `src/routes/(public)/[[lang]]`.
   - Advanced: If you want to _require_ a language parameter as part of _all_
     your urls, use single square brackets like `src/routes/[lang]` or
     `src/routes/[lang=lang]`. Importantly, **if you take this approach, you
     should redirect your index route (`/`) to one of your language-specific
     index paths (e.g. `/en`, `/es`, etc)**, because a root url of `/` will not be
     included in the sitemap when you have _required_ the language param to
     exist. (The remainder of these docs will assume you are using an
     _optional_ lang parameter.)

2. Within your `sitemap.xml` route, update your Super Sitemap config object to
   add a `lang` property specifying your desired languages.

   ```js
   lang: {
     default: 'en',           // e.g. /about
     alternates: ['zh', 'de'] // e.g. /zh/about, /de/about
   }
   ```

   The default language will not appear in your URLs (e.g. `/about`). Alternate
   languages will appear as part of the URLs within your sitemap (e.g.
   `/zh/about`, `/de/about`).

   These language properties accept any string value, but choose a valid
   language code. They will appear in two places: 1.) as a slug within your
   paths (e.g. `/zh/about`), and 2.) as `hreflang` attributes within the sitemap
   output.

   Note: If you used a _required_ lang param (e.g. `[lang]`), you can set
   _any_ of your desired languages as the `default` and the rest as the `alternates`; they will _all_ be
   processed in the same way though.

3. Within your `sitemap.xml` route again, update your Super Sitemap config
   object's `paramValues` to prepend `/[[lang]]` (or `/[[lang=lang]]`, `[lang]`, etc–whatever you used earlier) onto the property names of all routes you moved
   into your `/src/routes/[[lang]]` directory, e.g.:

   ```js
   paramValues: {
     '/[[lang]]/blog/[slug]': ['hello-world', 'post-2'], // was '/blog/[slug]'
     '/[[lang]]/campsites/[country]/[state]': [ // was '/campsites/[country]/[state]'
       ['usa', 'new-york'],
       ['canada', 'toronto'],
     ],
   },
   ```

### Example

1. Create `/src/routes/[[lang]]/about/+page.svelte` with any content.
2. Assuming you have a [basic sitemap](#basic-example) set up at
   `/src/routes/sitemap.xml/+server.ts`, add a `lang` property to your sitemap's
   config object, as described in Step 2 in the previous section.
3. Your `sitemap.xml` will then include the following:

```xml
  ...
  <url>
    <loc>https://example.com/about</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/about" />
    <xhtml:link rel="alternate" hreflang="zh" href="https://example.com/zh/about" />
    <xhtml:link rel="alternate" hreflang="de" href="https://example.com/de/about" />
  </url>
  <url>
    <loc>https://example.com/de/about</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/about" />
    <xhtml:link rel="alternate" hreflang="zh" href="https://example.com/zh/about" />
    <xhtml:link rel="alternate" hreflang="de" href="https://example.com/de/about" />
  </url>
  <url>
    <loc>https://example.com/zh/about</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/about" />
    <xhtml:link rel="alternate" hreflang="zh" href="https://example.com/zh/about" />
    <xhtml:link rel="alternate" hreflang="de" href="https://example.com/de/about" />
  </url>
  ...
```

</details>

### Note on i18n

- Super Sitemap handles creation of URLs within your sitemap, but it is
  _not_ an i18n library.

You need a separate i18n library to translate strings within your app. Just
ensure the library you choose allows a similar URL pattern as described here,
with a default language (e.g. `/about`) and lang slugs for alternate languages
(e.g. `/zh/about`, `/de/about`).

- Using [Paraglide](https://github.com/opral/paraglide-js)? See the [example code here](https://github.com/jasongitmail/super-sitemap/issues/24#issuecomment-2813870191) if you use Paraglide to localize path names on your site.

### Q&A on i18n

- **What about translated paths like `/about` (English), `/acerca` (Spanish), `/uber` (German)?**

  Realistically, this would break the route patterns and assumptions that Super
  Sitemap relies on to identify your routes, to know what language to use, and
  to build the sitemap. "Never say never", but there are no plans to support this.

## Sample Paths

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

## Robots.txt

It's important to create a `robots.txt` so search engines know where to find your sitemap.

You can create it at `/static/robots.txt` (SvelteKit) or `/public/robots.txt`
(TanStack Start):

```text
User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml
```

Or, if you have defined `PUBLIC_ORIGIN` within your project's `.env` and want
to access it, you can generate `robots.txt` from a route:

<details>
<summary>View TanStack Start example</summary>

```ts
// /src/routes/robots[.]txt.ts
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: () => {
        // prettier-ignore
        const body = [
          'User-agent: *',
          'Allow: /',
          '',
          `Sitemap: ${process.env.PUBLIC_ORIGIN}/sitemap.xml`
        ].join('\n').trim();

        const headers = {
          'Content-Type': 'text/plain',
        };

        return new Response(body, { headers });
      },
    },
  },
});
```

</details>

<details>
<summary>View SvelteKit example</summary>

```ts
import * as env from '$env/static/public';

export const prerender = true;

export async function GET(): Promise<Response> {
  // prettier-ignore
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${env.PUBLIC_ORIGIN}/sitemap.xml`
  ].join('\n').trim();

  const headers = {
    'Content-Type': 'text/plain',
  };

  return new Response(body, { headers });
}
```

</details>

## Playwright Test

It's recommended to add a Playwright test that calls your sitemap.

For pre-rendered sitemaps, you'll receive an error _at build time_ if your data
param values are misconfigured. But for non-prerendered sitemaps, your data is
loaded when the sitemap is loaded, and consequently a functional test is more
important to confirm you have not misconfigured data for your param values.

Feel free to use or adapt this example test:

<details>
  <summary>Click to expand</summary>

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

Below are a few examples demonstrating how to query an SQL database to obtain
data to provide as `paramValues` for your routes:

```SQL
-- Route: /blog/[slug]
SELECT slug FROM blog_posts WHERE status = 'published';

-- Route: /blog/category/[category]
SELECT DISTINCT LOWER(category) FROM blog_posts WHERE status = 'published';

-- Route: /campsites/[country]/[state]
SELECT DISTINCT LOWER(country), LOWER(state) FROM campsites;
```

Using `DISTINCT` will prevent duplicates in your result set. Use this when your
table could contain multiple rows with the same params, like in the 2nd and 3rd
examples. This will be the case for routes that show a list of items.

Then if your result is an array of objects, convert into a 2D array containing
string values:

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
- **`excludeRoutePatterns` accepts `RegExp` literals, instead of string regex sources.**
  - E.g. example in v2: `[/^\/dashboard/, /\(authenticated\)/]`.
- **`sampledUrls()` and `sampledPaths()` were removed.** Use
  [`getSamplePaths()`](#sample-paths) instead.

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
