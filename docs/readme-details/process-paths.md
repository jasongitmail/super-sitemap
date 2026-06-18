# processPaths() callback

_**The `processPaths()` callback is powerful, but rarely needed.**_

Use `processPaths()` when you need to transform the final sitemap path objects
before XML is rendered. It is an escape hatch for path-level changes that cannot
be expressed cleanly with `excludeRoutePatterns`, `additionalPaths`,
`paramValues`, or default sitemap metadata.

Your callback receives `PathObj[]` and must return `PathObj[]`.

```ts
processPaths: (paths: sitemap.PathObj[]) => {
  return paths;
};
```

## When It Runs

The path pipeline is:

1. Generate route paths from your framework routes and `paramValues`.
2. Append `additionalPaths`.
3. Run `processPaths()`.
4. Deduplicate paths.
5. Sort paths, if `sort: 'alpha'` is enabled.
6. Render XML.

Because deduplication happens after `processPaths()`, a callback can append or
replace paths and still rely on Super Sitemap to remove duplicates.

## Prefer Built-In Options First

Use built-in config when it fits:

- Use `excludeRoutePatterns` to exclude whole route patterns.
- Use `additionalPaths` to append known extra paths.
- Use `paramValues` objects to set per-path `lastmod`, `changefreq`, or
  `priority`.

Use `processPaths()` for path-specific logic after paths have been expanded,
such as excluding only `/zh/about` while keeping `/about`, `/de/about`, and
other locale variants.

## Sync by Design

`processPaths()` is intentionally synchronous. Fetch data before calling
`sitemap.response()`, ideally alongside your other sitemap data with
`Promise.all()`, then use `processPaths()` for the final in-memory transform.

## Remove Specific Paths

```ts
return await sitemap.response({
  // ...
  processPaths: (paths: sitemap.PathObj[]) => {
    const pathsToExclude = new Set(['/zh/about', '/de/team']);
    return paths.filter(({ path }) => !pathsToExclude.has(path));
  },
});
```

Prefer `excludeRoutePatterns` when you can exclude by route key instead of final
path. Route-based exclusions run before path generation and are easier to reason
about when they match your intent.

## Transform Paths

This example adds trailing slashes to generated paths and locale alternates.
Trailing slashes are not recommended, but this shows how to keep alternates in
sync when transforming paths.

```ts
return await sitemap.response({
  // ...
  processPaths: (paths: sitemap.PathObj[]) => {
    return paths.map(({ alternates, path, ...rest }) => ({
      ...rest,
      path: path === '/' ? path : `${path}/`,
      alternates: alternates?.map((alternate) => ({
        ...alternate,
        path: alternate.path === '/' ? alternate.path : `${alternate.path}/`,
      })),
    }));
  },
});
```
