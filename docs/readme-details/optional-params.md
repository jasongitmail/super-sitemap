# Optional Params

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
