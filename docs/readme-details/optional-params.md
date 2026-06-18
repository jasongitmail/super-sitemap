# Optional Params

_**You only need to read this if you want to understand how Super Sitemap
handles optional params and why.**_

Optional params let one route definition match multiple URL shapes. For example,
`/products/{-$category}` in TanStack Start or `/products/[[category]]` in
SvelteKit can match both `/products` and `/products/shoes`.

Super Sitemap expands that route into every supported route variant. The base
variant needs no values because it has no params. Every dynamic variant must
either have values in `paramValues` or be excluded with `excludeRoutePatterns`.

## Route Variants

A route with two consecutive optional params expands into three variants:

| Variant | TanStack Start key           | SvelteKit key                | Example URL |
| ------- | ---------------------------- | ---------------------------- | ----------- |
| Base    | `/foo`                       | `/foo`                       | `/foo`      |
| Shorter | `/foo/{-$paramA}`            | `/foo/[[paramA]]`            | `/foo/a`    |
| Longest | `/foo/{-$paramA}/{-$paramB}` | `/foo/[[paramA]]/[[paramB]]` | `/foo/a/b`  |

This is the important rule: optional params create multiple route keys, not just
one key for the route on disk.

## Param Values

Provide values for the dynamic variants you want to keep.

```ts
// TanStack Start
paramValues: {
  '/foo/{-$paramA}': ['a', 'a2'],
  '/foo/{-$paramA}/{-$paramB}': [
    ['a', 'b'],
    ['a2', 'b2'],
  ],
};
```

```ts
// SvelteKit
paramValues: {
  '/foo/[[paramA]]': ['a', 'a2'],
  '/foo/[[paramA]]/[[paramB]]': [
    ['a', 'b'],
    ['a2', 'b2'],
  ],
};
```

## Excluding Variants

`excludeRoutePatterns` match route keys, not generated URLs. Use `$` when you
want to exclude one exact variant.

```ts
// TanStack Start
excludeRoutePatterns: [
  /^\/foo$/, // only `/foo`
  /^\/foo\/\{-\$paramA\}$/, // only `/foo/{-$paramA}`
  /^\/foo\/\{-\$paramA\}\/\{-\$paramB\}$/, // only `/foo/{-$paramA}/{-$paramB}`
  /^\/foo(?:$|\/)/, // all `/foo` variants
];
```

```ts
// SvelteKit
excludeRoutePatterns: [
  /^\/foo$/, // only `/foo`
  /^\/foo\/\[\[paramA\]\]$/, // only `/foo/[[paramA]]`
  /^\/foo\/\[\[paramA\]\]\/\[\[paramB\]\]$/, // only `/foo/[[paramA]]/[[paramB]]`
  /^\/foo(?:$|\/)/, // all `/foo` variants
];
```

If you mix `excludeRoutePatterns` and `paramValues` for the same optional route,
anchor exact exclusions with `$`. Otherwise a broad pattern can remove variants
you intended to populate with `paramValues`.

## Framework Notes

- TanStack Start optional params use `{-$param}` syntax.
- SvelteKit optional params use `[[param]]` syntax.
