# SK (SvelteKit) Sitemap

A [SvelteKit](https://kit.svelte.dev/) sitemap that just works and makes it
impossible to forget to add paths, while allowing flexibility to exclude any
specific paths or path patterns.

## Features

- 🤓 Supports any rendering method.
- 🪄 Routes automatically found from `/src/routes` using Vite + data for route
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

```ts
export const GET = async () => {
  return await sitemap.response({
    origin: 'https://example.com'
  });
};
```

### Realistic example

```ts
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
    '/blog/tag/[tag]': blogTags // e.g. ['red', 'blue', 'green']
  };

  // Optionally, you can pass an object of custom headers as a 2nd arg,
  // for example, to set custom cache control headers.
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
        <loc>http://example/</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>http://example/about</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>http://example/blog</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>http://example/login</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>http://example/pricing</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>http://example/privacy</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>http://example/signup</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>http://example/support</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>http://example/terms</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>http://example/blog/15-post</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>http://example/blog/14-post</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    ...
    <url>
        <loc>http://example/blog/02-post</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>http://example/blog/01-post</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>http://example/blog/tag/tag1</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>http://example/blog/tag/tag2</loc>
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
