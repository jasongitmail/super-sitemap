<div align="center">
  <img src="https://github.com/jasongitmail/super-sitemap/assets/50032291/505f6461-b358-4b6f-a8e0-80c81f57e51e" alt="Svelte Super Sitemap logo" width="550" />
  <h1 align="center">Super Sitemap</h1>

  <a href="https://github.com/jasongitmail/super-sitemap/actions/workflows/ci.yml">
    <img alt="unit tests badge" src="https://img.shields.io/github/actions/workflow/status/jasongitmail/super-sitemap/ci.yml?label=tests">
  </a>
  <a href="https://github.com/jasongitmail/super-sitemap/blob/main/LICENSE">
    <img alt="license badge" src="https://img.shields.io/npm/l/super-sitemap?color=limegreen">
  </a>
  <a href="https://www.npmjs.com/package/super-sitemap">
    <img alt="npm badge" src="https://img.shields.io/npm/v/super-sitemap?color=limegreen">
  </a>
  <br/>
  <p>SvelteKit sitemap focused on ease of use and making it impossible to forget to add your paths.</p>
</div>

## Table of Contents

- [Features](#features)
- [Limitations](#limitations)
- [Installation](#installation)
- [Usage](#usage)
  - [Basic example](#basic-example)
  - [The "everything" example](#the-everything-example)
  - [Sitemap Index](#sitemap-index)
  - [Optional Params](#optional-params)
  - [i18n](#i18n)
  - [Sampled URLs](#sampled-urls)
  - [Sampled Paths](#sampled-paths)
- [Robots.txt](#robotstxt)
- [Playwright test](#playwright-test)
- [Querying your database for param values](#querying-your-database-for-param-values)
- [Example output](#example-output)
- [Changelog](#changelog)

## Features

- 🤓 Supports any rendering method.
- 🪄 Automatically collects routes from `/src/routes` using Vite + data for route
  parameters provided by you.
- 🧠 Easy maintenance–accidental omission of data for parameterized routes
  throws an error and requires the developer to either explicitly exclude the
  route pattern or provide an array of data for that param value.
- 👻 Exclude specific routes or patterns using regex patterns (e.g.
  `^/dashboard.*`, paginated URLs, etc).
- 🚀 Defaults to 1h CDN cache, no browser cache.
- 💆 Set custom headers to override [default headers](https://github.com/jasongitmail/super-sitemap/blob/main/src/lib/sitemap.ts#L84-L85):
  `sitemap.response({ headers: {'cache-control: '...'}, ...})`.
- 🫡 Uses [SvelteKit's recommended sitemap XML
  structure](https://kit.svelte.dev/docs/seo#manual-setup-sitemaps).
- 💡 Google, and other modern search engines, [ignore `priority` and
  `changefreq`](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap#xml)
  and use their own heuristics to determine when to crawl pages on your site. As
  such, these properties are not included by default to minimize KB size and
  enable faster crawling. Optionally, you can enable them like so:
  `sitemap.response({ changefreq:'daily', priority: 0.7, ...})`.
- 🗺️ [Sitemap indexes](#sitemap-index)
- 🌎 [i18n](#i18n)
- 🧪 Well tested.
- 🫶 Built with TypeScript.

## Limitations

- Excludes `lastmod` from each item, but a future version could include it for
  parameterized data items. Obviously, `lastmod` would be indeterminate for
  non-parameterized routes, such as `/about`. Due to this, Google would likely
  ignore `lastmod` anyway since they only respect if it's ["consistently and
  verifiably
  accurate"](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap#additional-notes-about-xml-sitemaps).
- [Image](https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps)
  or
  [video](https://developers.google.com/search/docs/crawling-indexing/sitemaps/video-sitemaps)
  sitemap extensions.

## Installation

`npm i -D super-sitemap`

or

`bun add -d super-sitemap`

Then see the [Usage](#usage), [Robots.txt](#robotstxt), & [Playwright Test](#playwright-test) sections.

## Usage

## Basic example

JavaScript:

```js
// /src/routes/sitemap.xml/+server.js
import * as sitemap from 'super-sitemap';

export const GET = async () => {
  return await sitemap.response({
    origin: 'https://example.com',
  });
};
```

TypeScript:

```ts
// /src/routes/sitemap.xml/+server.ts
import * as sitemap from 'super-sitemap';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
  return await sitemap.response({
    origin: 'https://example.com',
  });
};
```

## The "everything" example

All aspects of the below example are optional, except for `origin` and
`paramValues` to provide data for parameterized routes.

JavaScript:

```js
// /src/routes/sitemap.xml/+server.js
import * as sitemap from 'super-sitemap';
import * as blog from '$lib/data/blog';

export const prerender = true; // optional

export const GET = async () => {
  // Get data for parameterized routes however you need to; this is only an example.
  let blogSlugs, blogTags;
  try {
    [blogSlugs, blogTags] = await Promise.all([blog.getSlugs(), blog.getTags()]);
  } catch (err) {
    throw error(500, 'Could not load data for param values.');
  }

  return await sitemap.response({
    origin: 'https://example.com',
    excludePatterns: [
      '^/dashboard.*', // i.e. routes starting with `/dashboard`
      '.*\\[page=integer\\].*', // i.e. routes containing `[page=integer]`–e.g. `/blog/2`
      '.*\\(authenticated\\).*', // i.e. routes within a group
    ],
    paramValues: {
      '/blog/[slug]': blogSlugs, // e.g. ['hello-world', 'another-post']
      '/blog/tag/[tag]': blogTags, // e.g. ['red', 'green', 'blue']
      '/campsites/[country]/[state]': [
        ['usa', 'new-york'],
        ['usa', 'california'],
        ['canada', 'toronto'],
      ],
    },
    headers: {
      'custom-header': 'foo', // case insensitive; xml content type & 1h CDN cache by default
    },
    additionalPaths: [
      '/foo.pdf', // e.g. to a file in your static dir
    ],
    changefreq: 'daily', // excluded by default b/c ignored by modern search engines
    priority: 0.7, // excluded by default b/c ignored by modern search engines
    sort: 'alpha', // default is false; 'alpha' sorts all paths alphabetically.
  });
};
```

TypeScript:

```ts
// /src/routes/sitemap.xml/+server.ts
import type { RequestHandler } from '@sveltejs/kit';
import * as sitemap from 'super-sitemap';
import * as blog from '$lib/data/blog';

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
    excludePatterns: [
      '^/dashboard.*', // i.e. routes starting with `/dashboard`
      '.*\\[page=integer\\].*', // i.e. routes containing `[page=integer]`–e.g. `/blog/2`
      '.*\\(authenticated\\).*', // i.e. routes within a group
    ],
    paramValues: {
      '/blog/[slug]': blogSlugs, // e.g. ['hello-world', 'another-post']
      '/blog/tag/[tag]': blogTags, // e.g. ['red', 'green', 'blue']
      '/campsites/[country]/[state]': [
        ['usa', 'new-york'],
        ['usa', 'california'],
        ['canada', 'toronto'],
      ],
    },
    headers: {
      'custom-header': 'foo', // case insensitive; xml content type & 1h CDN cache by default
    },
    additionalPaths: [
      '/foo.pdf', // e.g. to a file in your static dir
    ],
    changefreq: 'daily', // excluded by default b/c ignored by modern search engines
    priority: 0.7, // excluded by default b/c ignored by modern search engines
    sort: 'alpha', // default is false; 'alpha' sorts all paths alphabetically.
  });
};
```

## Sitemap Index

You can enable sitemap index support with just two changes:

1. Rename your route to `sitemap[[page]].xml`
2. Pass the page param via your sitemap config

JavaScript:

```js
// /src/routes/sitemap[[page]].xml/+server.js
import * as sitemap from 'super-sitemap';

export const GET = async ({ params }) => {
  return await sitemap.response({
    origin: 'https://example.com',
    page: params.page,
    // maxPerPage: 45_000 // optional; defaults to 50_000
  });
};
```

TypeScript:

```ts
// /src/routes/sitemap[[page]].xml/+server.ts
import * as sitemap from 'super-sitemap';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params }) => {
  return await sitemap.response({
    origin: 'https://example.com',
    page: params.page,
    // maxPerPage: 45_000 // optional; defaults to 50_000
  });
};
```

_**Feel free to always set up your sitemap in this manner given it will work optimally whether you
have few or many URLs.**_

Your `sitemap.xml` route will now return a regular sitemap when your sitemap's total URLs is less than or equal
to `maxPerPage` (defaults to 50,000 per the [sitemap
protocol](https://www.sitemaps.org/protocol.html)) or it will contain a sitemap index when exceeding
`maxPerPage`.

The sitemap index will contain links to `sitemap1.xml`, `sitemap2.xml`, etc, which contain your
paginated URLs automatically.

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

## Optional Params

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
sitemap and will require you to either exclude these using `excludePatterns` or
provide param values for them using `paramValues`, within your sitemap
config object.

### For example:

- `/something` will exist in your sitemap unless excluded with a pattern of
  `/something$`.
- `/something/[[paramA]]` must be either excluded using an `excludePattern` of
  `.*/something/\\[\\[paramA\\]\\]$` _or_ appear within your config's
  `paramValues` like this: `'/something/[[paramA]]': ['foo', 'foo2', 'foo3']`.
- And `/something/[[paramA]]/[[paramB]]` must be either excluded using an
  `excludePattern` of `.*/something/\\[\\[paramA\\]\\]/\\[\\[paramB\\]\\]$` _or_
  appear within your config's `paramValues` like this: `'/something/[[paramA]]':
[['foo','bar'], ['foo2','bar2'], ['foo3','bar3']]`.

Alternatively, you can exclude ALL versions of this route by providing a single
regex pattern within `excludePatterns` that matches all of them, such as
`/something`; notice this do NOT end with a `$`, thereby allowing this pattern
to match all 3 versions of this route.

If you plan to mix and match use of `excludePatterns` and `paramValues` for a
given route that contains optional params, terminate all of your
`excludePatterns` for that route with `$`, to target only the specific desired
versions of that route.

## i18n

Super Sitemap supports [multilingual site
annotations](https://developers.google.com/search/blog/2012/05/multilingual-and-multinational-site)
within your sitemap. This allows search engines to be aware of alternate
language versions of your pages.

### Set up

1. Create a directory named `[[lang]]` at `src/routes/[[lang]]`. Place any
   routes that you intend to translate inside here.

   **This parameter must be named `lang`.** It can be within a group if you want, e.g.
   `src/routes/(public)/[[lang]]`.

   To require a language to be specified, name the directory `[lang]`. You may also use a [matcher](https://kit.svelte.dev/docs/advanced-routing#matching).

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

3. Within your `sitemap.xml` route again, update your Super Sitemap config
   object's `paramValues` to prepend `/[[lang]]` onto the property names of all
   routes you moved into your `/src/routes/[[lang]]` directory, e.g.:

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
   config object, as described earlier.
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

### Note on i18n

Super Sitemap handles creation of URLs within your sitemap, but it is
_not_ an i18n library.

You need a separate i18n library to translate strings within your app. Just
ensure the library you choose allows a similar URL pattern as described here,
with a default language (e.g. `/about`) and lang slugs for alternate languages
(e.g. `/zh/about`, `/de/about`).

### Q&A on i18n

- **What about translated paths like `/about` (English), `/acerca` (Spanish), `/uber` (Germany)?**

  Realistically, this would break the route patterns and assumptions that Super
  Sitemap relies on to identify your routes, know what language to use, and
  build the sitemap. "Never say never", but there are no plans to support this.

## Sampled URLs

Sampled URLs provides a utility to obtain a sample URL for each unique route on your site–i.e.:

1.  the URL for every static route (e.g. `/`, `/about`, `/pricing`, etc.), and
2.  one URL for each parameterized route (e.g. `/blog/[slug]`)

This can be helpful for writing functional tests, performing SEO analyses of your public pages, &
similar.

This data is generated by analyzing your site's `sitemap.xml`, so keep in mind that it will not
contain any URLs excluded by `excludePatterns` in your sitemap config.

```js
import { sampledUrls } from 'super-sitemap';

const urls = await sampledUrls('http://localhost:5173/sitemap.xml');
// [
//   'http://localhost:5173/',
//   'http://localhost:5173/about',
//   'http://localhost:5173/pricing',
//   'http://localhost:5173/features',
//   'http://localhost:5173/login',
//   'http://localhost:5173/signup',
//   'http://localhost:5173/blog',
//   'http://localhost:5173/blog/hello-world',
//   'http://localhost:5173/blog/tag/red',
// ]
```

### Limitations

1. Result URLs will not include any `additionalPaths` from your sitemap config because it's
   impossible to identify those by a pattern given only your routes and `sitemap.xml` as inputs.
2. `sampledUrls()` does not distinguish between routes that differ only due to a pattern matcher.
   For example, `/foo/[foo]` and `/foo/[foo=integer]` will evaluated as `/foo/[foo]` and one sample
   URL will be returned.

### Designed as a testing utility

Both `sampledUrls()` and `sampledPaths()` are intended as utilities for use
within your Playwright tests. Their design aims for developer convenience (i.e.
no need to set up a 2nd sitemap config), not for performance, and they require a
runtime with access to the file system like Node, to read your `/src/routes`. In
other words, use for testing, not as a data source for production.

You can use it in a Playwright test like below, then you'll have `sampledPublicPaths` available to use within your tests in this file.

```js
// foo.test.js
import { expect, test } from '@playwright/test';
import { sampledPaths } from 'super-sitemap';

let sampledPublicPaths = [];
try {
  sampledPublicPaths = await sampledPaths('http://localhost:4173/sitemap.xml');
} catch (err) {
  console.error('Error:', err);
}

// ...
```

## Sampled Paths

Same as [Sampled URLs](#sampled-urls), except it returns paths.

```js
import { sampledPaths } from 'super-sitemap';

const urls = await sampledPaths('http://localhost:5173/sitemap.xml');
// [
//   '/about',
//   '/pricing',
//   '/features',
//   '/login',
//   '/signup',
//   '/blog',
//   '/blog/hello-world',
//   '/blog/tag/red',
// ]
```

## Robots.txt

It's important to create a `robots.txt` so search engines know where to find your sitemap.

You can create it at `/static/robots.txt`:

```text
User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml
```

Or, at `/src/routes/robots.txt/+server.ts`, if you have defined `PUBLIC_ORIGIN` within your
project's `.env` and want to access it:

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

## Playwright Test

It's recommended to add a Playwright test that calls your sitemap.

For pre-rendered sitemaps, you'll receive an error _at build time_ if your data param values are
misconfigured. But for non-prerendered sitemaps, your data is loaded when the sitemap is loaded, and
consequently a functional test is more important to confirm you have not misconfigured data for your
param values.

Feel free to use or adapt this example test:

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

## Querying your database for param values

As a helpful tip, below are a few examples demonstrating how to query an SQL
database to obtain data to provide as `paramValues` for your routes:

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

Then if your result is an array of objects, convert into an array of arrays of
string values:

```js
const arrayOfArrays = resultFromDB.map((row) => Object.values(row));
// [['usa','new-york'],['usa', 'california']]
```

That's it.

Going in the other direction, i.e. when loading data for a component for your
UI, your database query should typically lowercase both the URL param and value
in the database during comparison–e.g.:

```sql
-- Obviously, remember to escape your `params.slug` values to prevent SQL injection.
SELECT * FROM campsites WHERE LOWER(country) = LOWER(params.country) AND LOWER(state) = LOWER(params.state) LIMIT 10;
```

<details id="example-output">
  <summary><h2>Example output</h2></summary>

```xml
<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">
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

## Changelog

- `0.14.13` - Support route files named to allow [breaking out of a layout](https://kit.svelte.dev/docs/advanced-routing#advanced-layouts-breaking-out-of-layouts).
- `0.14.12` - Adds [`i18n`](#i18n) support.
- `0.14.11` - Adds [`optional params`](#optional-params) support.
- `0.14.0` - Adds [`sitemap index`](#sitemap-index) support.
- `0.13.0` - Adds [`sampledUrls()`](#sampled-urls) and [`sampledPaths()`](#sampled-paths).
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
# Then edit files in `/src/lib`
```

## Publishing

A new version of this npm package is automatically published when the semver
version within `package.json` is incremented.

## Credits

- Built by [x.com/@zkjason\_](https://twitter.com/zkjason_)
- Made possible by [SvelteKit](https://kit.svelte.dev/) & [Svelte](https://svelte.dev/).
