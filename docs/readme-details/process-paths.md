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

Note: If using `excludeRoutePatterns` (which matches again the _route_ pattern) is sufficient for your needs, you should prefer it for performance reasons. This
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
