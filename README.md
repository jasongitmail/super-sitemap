<div align="center">
  <img src="https://github.com/jasongitmail/sk-sitemap/assets/50032291/21f48ff3-aba5-49b9-a857-3c0b6806750a" alt="project banner" />
  <h1 align="center">SK Sitemap</h1>
  
  <a href="https://github.com/jasongitmail/sk-sitemap/actions/workflows/ci.yml">
    <img alt="Unit Tests" src="https://img.shields.io/github/actions/workflow/status/jasongitmail/sk-sitemap/ci.yml?label=tests">
  </a>
  <a href="https://github.com/jasongitmail/sk-sitemap/blob/main/LICENSE">
    <img alt="NPM" src="https://img.shields.io/npm/l/sk-sitemap?color=limegreen">  
  </a>
  <a href="[https://github.com/jasongitmail/sk-sitemap/blob/main/LICENSE](https://www.npmjs.com/package/sk-sitemap)">
    <img alt="NPM" src="https://img.shields.io/npm/v/sk-sitemap?color=limegreen">  
  </a>
<br/>
  <p>Automatic <a href="https://kit.svelte.dev/">SvelteKit</a> sitemap that makes it
impossible to forget to add your paths.</p>
</div>




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
- 💆 Set custom headers, by passing an object as the 2nd argument to
  `sitemap.response({...}, {'cache-control: '...'})`.
- 🫡 Uses [SvelteKit's recommended sitemap XML
  structure](https://kit.svelte.dev/docs/seo#manual-setup-sitemaps).
- 🤷 Note: Currently, uses priority `0.7` and `changefreq` daily for each item.
  [Google ignores `priority` and
  `changefreq`](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap#xml)
  and these could be excluded to save KB, but I kept them for now in case it
  improves compatibility by dumber bots.
- 🧪 Well tested.
- 🫶 Built with TypeScript.

## Limitations of MVP...that _could_ be supported

- Supports one param per route (`/blog/tag/[tag]`), but could be refactored to
  support unlimited params per route (e.g.`/[lang]/blog/tag/[tag]`).
- A future version could build a [Sitemap
  Index](https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps)
  when total URLs exceed >50,000, which is the max quantity Google will read in
  a single `sitemap.xml` file.
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

`npm i -D sk-sitemap`

or

`bun add -d sk-sitemap`

## Usage

### Basic example

```js
// /src/routes/sitemap.xml/+server.js
import * as sitemap from 'sk-sitemap';

export const GET = async () => {
  return await sitemap.response({
    origin: 'https://example.com'
  });
};
```

TypeScript version:

```ts
// /src/routes/sitemap.xml/+server.ts
import * as sitemap from 'sk-sitemap';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
  return await sitemap.response({
    origin: 'https://example.com'
  });
};
```

### Realistic example

```js
// /src/routes/sitemap.xml/+server.js
import * as sitemap from 'sk-sitemap';
import * as blog from '$lib/data/blog';

export const GET = async () => {
  const excludePatterns = [
    '^/dashboard.*',

    // Exclude routes containing `[page=integer]`–e.g. `/blog/2`
    `.*\\[page\\=integer\\].*`
  ];

  // Get data for parameterized routes
  let blogSlugs, blogTags;
  try {
    [blogSlugs, blogTags] = await Promise.all([blog.getSlugs(), blog.getTags()]);
  } catch (err) {
    throw error(500, 'Could not load paths');
  }

  const paramValues = {
    '/blog/[slug]': blogSlugs, // e.g. ['hello-world', 'another-post']
    '/blog/tag/[tag]': blogTags // e.g. ['red', 'green', 'blue']
  };

  // Optionally, you can pass an object of custom headers as a 2nd arg,
  // for example, to customize cache control headers.
  return await sitemap.response({
    origin: 'https://example.com',
    excludePatterns,
    paramValues
  });
};
```

TypeScript version:

```ts
// /src/routes/sitemap.xml/+server.ts
import * as sitemap from 'sk-sitemap';
import * as blog from '$lib/data/blog';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
  const excludePatterns = [
    '^/dashboard.*',

    // Exclude routes containing `[page=integer]`–e.g. `/blog/2`
    `.*\\[page\\=integer\\].*`
  ];

  // Get data for parameterized routes
  let blogSlugs, blogTags;
  try {
    [blogSlugs, blogTags] = await Promise.all([blog.getSlugs(), blog.getTags()]);
  } catch (err) {
    throw error(500, 'Could not load paths');
  }

  const paramValues = {
    '/blog/[slug]': blogSlugs, // e.g. ['hello-world', 'another-post']
    '/blog/tag/[tag]': blogTags // e.g. ['red', 'green', 'blue']
  };

  // Optionally, you can pass an object of custom headers as a 2nd arg,
  // for example, to customize cache control headers.
  return await sitemap.response({
    origin: 'https://example.com',
    excludePatterns,
    paramValues
  });
};
```

## Result

```xml
<urlset
    xmlns="https://www.sitemaps.org/schemas/sitemap/0.9"
    xmlns:news="https://www.google.com/schemas/sitemap-news/0.9"
    xmlns:xhtml="https://www.w3.org/1999/xhtml"
    xmlns:mobile="https://www.google.com/schemas/sitemap-mobile/1.0"
    xmlns:image="https://www.google.com/schemas/sitemap-image/1.1"
    xmlns:video="https://www.google.com/schemas/sitemap-video/1.1">
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
        <loc>https://example/blog/15-post</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>https://example/blog/14-post</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    ...
    <url>
        <loc>https://example/blog/02-post</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>https://example/blog/01-post</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>https://example/blog/tag/tag1</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>https://example/blog/tag/tag2</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
</urlset>
```

## Developing

```bash
git clone https://github.com/jasongitmail/sk-sitemap.git
bun install
# Then edit files in `/src/lib`
```

## Publishing

A new version of this NPM package is automatically published when the semver
version within `package.json` is incremented.
