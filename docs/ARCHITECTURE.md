# Architecture

Super Sitemap is one npm package with framework-specific entrypoints and a
shared, framework-agnostic core:

```text
super-sitemap/sveltekit        → src/adapters/sveltekit/
super-sitemap/tanstack-start   → src/adapters/tanstack-start/
(not importable by consumers)  → src/core/
```

## Layering

```text
┌─────────────────────────────────────────────────────────────┐
│ Adapter (sveltekit | tanstack-start)                        │
│   • discovers routes using the framework's own mechanism    │
│   • parses framework route syntax into NormalizedRoute[]    │
│   • re-exports the public API with framework-worded docs    │
├─────────────────────────────────────────────────────────────┤
│ Core (src/core/internal/)                                   │
│   • path generation, i18n expansion, dedupe, sort           │
│   • pagination, XML rendering, headers, Response building   │
│   • sample-path selection                                   │
│   • zero framework imports, zero Node built-ins             │
└─────────────────────────────────────────────────────────────┘
```

The boundary rule: **core never parses framework route syntax; adapters never
render XML or make pagination decisions.** Everything crossing the boundary is
expressed as `NormalizedRoute[]` or `PathObj[]`.

Each adapter owns exactly one job beyond re-exporting: producing ordered
`NormalizedRoute[]` from its framework.

- **SvelteKit** discovers page files via Vite's `import.meta.glob('/src/routes/**/+page*.{svelte,md,svx}')`
  (a build-time manifest, so it works for prerendered and runtime sitemaps),
  then parses SvelteKit conventions: route groups `(group)`, `[param]`,
  `[[optional]]`, `[param=matcher]`, `[...rest]`, and the `[[locale]]`/`[locale]`
  locale convention.
- **TanStack Start** never reads files. The consumer passes their app's
  `getRouter` function and the adapter reads the resolved `router.routesByPath`
  map, parsing TanStack syntax: `$param`, `{-$optional}`, `$` (splat), and
  `$locale`/`{-$locale}` locale routes.
  Server-only routes are excluded automatically (see
  [Server route exclusion](#server-route-exclusion-pages-only-endpoints-never)).

### Server route exclusion: pages only, endpoints never

Both adapters include only page routes in the sitemap — endpoints can never
appear — but each enforces it with its framework's own mechanics:

- **SvelteKit**: structural. Discovery globs only `+page.{svelte,md,svx}`
  files, so `+server.ts` endpoints (the sitemap route itself, robots.txt, API
  routes) are never seen in the first place.
- **TanStack Start**: detected. `routesByPath` contains _every_ route,
  including server routes, so the adapter inspects each resolved route's
  `options`: a route that declares `options.server` (server handlers) and has
  no `options.component` is server-only and is excluded. This means the sitemap
  never lists itself and users never need `excludeRoutePatterns` entries for
  endpoints. The check is conservative in the direction that matters: any route
  with a component is always kept (even with server handlers, even when neither
  field is present), so a misread shape can leak an endpoint at worst — never
  silently drop a page.

TanStack has an open discussion about exposing route "type" more directly
(<https://github.com/TanStack/router/discussions/7397>); until that lands,
inspecting `options.server`/`options.component` on the resolved route is the
only available signal, verified against the real router in
`examples/tanstack-start`.

### TanStack route-definition styles: all supported

TanStack Router offers several ways to define routes — file-based routing
(generated `routeTree.gen.ts`), code-based routing (`createRootRoute` /
`createRoute` by hand), and virtual file routes. The adapter supports **all of
them by construction**: it consumes the _resolved router instance_
(`getRouter().routesByPath`), which exists identically regardless of how the
route tree was authored. This is exactly why the adapter takes `getRouter`
instead of globbing files. Pathless/layout entries and `__root__` are filtered
out.

## Data flow

```text
adapter route source ──parse──▶ NormalizedRoute[] ─┐
paramValues, locales, defaults ────────────────────┼──▶ core.preparePaths()
additionalPaths, processPaths, sort ───────────────┘         │
                                                             ▼
                                                         PathObj[]
                                                             │
                          ┌──────────────────────────────────┼─────────────────┐
                          ▼                                  ▼                 ▼
                 core.getBody() / core.response()   selectSamplePaths()   (user's
                 pagination + XML rendering         one path per route    processPaths
                 + headers/status                   shape                 already applied)
```

`preparePaths()` pipeline order: interpolate normalized routes → append
`additionalPaths` → `processPaths()` callback → deduplicate (last occurrence
wins) → sort (only when `sort: 'alpha'`).

## Naming and definitions

| Term                                              | Meaning                                                                                                                                                                                                                                                   |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Normalized route** (`NormalizedRoute`)          | The IR: one routable URL pattern, normalized out of framework syntax. Ordered `segments`, optional `params` metadata, optional `locale` slot, and a `source`. Adapters produce them; core consumes them.                                                  |
| **Segment** (`RouteSegment`)                      | One path segment of a normalized route. Discriminated union: `static` (literal text), `param` (placeholder, optionally `rest` for splats), `locale` (the locale slot).                                                                                    |
| **Compatibility key** (`source.compatibilityKey`) | The framework-native route string users write in `paramValues` and see in error messages — `/blog/[slug]` for SvelteKit, `/blog/$slug` for TanStack. The external contract is framework-native; the IR is internal.                                       |
| **`paramValues`**                                 | User-supplied data for parameterized routes, keyed by compatibility key. Values: `string[]` (one param), `string[][]` (multi param), or `ParamValue[]` (values + per-path `lastmod`/`changefreq`/`priority`).                                             |
| **`PathObj`**                                     | One concrete sitemap entry: `path` plus optional `lastmod`, `changefreq`, `priority`, `alternates`.                                                                                                                                                       |
| **Alternate**                                     | One hreflang variant (`hreflang` + `path`) emitted as `<xhtml:link rel="alternate">`.                                                                                                                                                                     |
| **`locales`**                                     | Config declaring _which locales the site has_: `{ default, alternates }`. Shared by both adapters; consumed by core.                                                                                                                                      |
| **Locale route param**                            | A route param named `locale`. SvelteKit uses `[[locale]]`/`[locale]`; TanStack Start uses `{-$locale}`/`$locale`. Optional vs required behavior is inferred from route syntax.                                                                            |
| **`SitemapRouteParamError`**                      | Structured error thrown by core path generation (`code` + `route`) so callers never parse message strings. `preparePaths` formats it into the user-facing message.                                                                                        |
| **`error` discriminant**                          | Result types that represent success-or-failure (`PaginatedPathsResult`, render results) discriminate on `error: null \| '<code>'` — machine-readable codes, never display strings, so callers can map them to statuses (400/404) without string matching. |
| **`kind` discriminant**                           | Variant-tag unions that are not success/failure (`RouteSegment`, `ParsedSitemapXml`) discriminate on `kind`.                                                                                                                                              |
| **Error prefix**                                  | All user-facing errors are prefixed `super-sitemap:` and name routes by compatibility key, with remediation guidance. Formatting lives in one place (`core/internal/sitemap.ts`); adapters contain no try/catch.                                          |
| **Sitemap index**                                 | When paths exceed `maxPerPage` (default 50,000), the root sitemap becomes an index linking `/sitemap1.xml`, `/sitemap2.xml`, …; the `page` config selects a page.                                                                                         |
| **Sample paths**                                  | One concrete, visitable path per route shape, selected from the final prepared sitemap paths (`getSamplePaths` → core `selectSamplePaths`). Used for SEO smoke tests.                                                                                     |

## Repository layout

```text
src/core/            framework-agnostic engine (internal, not exported)
src/adapters/        one directory per framework entrypoint
src/test-utils/      test-only helpers (may use node:fs; never shipped)
examples/sveltekit/      runnable SvelteKit app — integration tests + demo
examples/tanstack-start/ runnable TanStack Start app — integration tests + demo
scripts/             publish guards and packaging verification
dist/                build output (gitignored; the only published directory)
```

- **`examples/`** — each example is a self-contained app with its own
  `package.json`, importing the library as `super-sitemap/<framework>` via a
  Vite alias to `src/`. They serve three purposes: (1) integration-test the
  things unit tests can't — real `import.meta.glob` discovery in a live
  SvelteKit app, and a real generated TanStack `routeTree` — (2) prove the
  README examples actually run, and (3) give contributors a dev playground.
  The SvelteKit example must be a real SvelteKit app because
  `import.meta.glob('/src/routes/**')` patterns are static strings rooted at
  the consuming app's Vite project root.
- **`src/test-utils/`** — test-only helpers, notably on-disk SvelteKit route
  discovery using `node:fs`. Kept outside `src/core`/`src/adapters` so Node
  built-ins can never ship (the package must stay edge-runtime safe; a
  packaging guard enforces this).

## Build and packaging

`npm run package`:

1. `tsc -p tsconfig.build.json` compiles `src/core` + `src/adapters` (tests
   excluded) to JS + `.d.ts` under `dist/`, preserving structure
   (`dist/core`, `dist/adapters`).
2. `publint` validates the package, then `scripts/verify-package-output.mjs`
   asserts no `node:` imports exist in `dist/` and every `exports` subpath
   resolves.

The `files` allowlist publishes only `dist/` (tests excluded). There are no
runtime or peer dependencies; both adapters use structural typing instead of
importing framework packages. The build is plain `tsc` — the library contains
no `.svelte` files, so no framework packager is involved; `import.meta.glob`
ships verbatim and is transformed by the consumer's Vite.

## Testing

- `src/**/*.test.ts` (root, Vitest) — unit tests for the core engine and both
  adapters' parsing/wiring, asserted black-box through
  `getBody`/`response`/`getSamplePaths`. These are plain TS with no framework
  runtime; the root Vite config has no framework plugins. (`import.meta.glob`
  is a Vite feature, available under Vitest without any plugin.)
- `examples/sveltekit` — end-to-end through the demo app's real
  `sitemap[[page]].xml` route handler, including real `import.meta.glob`
  discovery of `.svelte`/`.md`/`.svx` pages.
- `examples/tanstack-start` — end-to-end against a real generated
  `routeTree.gen.ts` and the current TanStack Start server-route API, proving
  the documented `createFileRoute(...)({ server: { handlers: { GET } } })`
  syntax.

Each example has its own `npm test`; CI runs the root suite and both examples.
