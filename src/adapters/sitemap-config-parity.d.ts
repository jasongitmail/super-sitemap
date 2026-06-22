/**
 * Type-only compile check that keeps public adapter sitemap configs aligned.
 *
 * SvelteKit and TanStack Start intentionally define explicit config types so
 * editor hovers show adapter-specific docs instead of an opaque shared alias.
 * This file makes TypeScript fail if those duplicated public shapes drift,
 * while still allowing TanStack Start to keep its adapter-only `router` field.
 *
 * This file has no runtime behavior and exports no public API.
 */
import type { SitemapConfig as SvelteKitSitemapConfig } from './sveltekit/internal/types.js';
import type {
  SitemapConfig as TanStackStartSitemapConfig,
  TanStackStartRouterFactory,
} from './tanstack-start/internal/types.js';

type Same<Actual, Expected> = [Actual] extends [Expected]
  ? [Expected] extends [Actual]
    ? true
    : false
  : false;

type Expect<T extends true> = T;

type _SitemapConfigsStayInSync = Expect<
  Same<Omit<TanStackStartSitemapConfig, 'router'>, SvelteKitSitemapConfig>
>;

type _TanStackRouterStaysAdapterOnly = Expect<
  Same<TanStackStartSitemapConfig['router'], TanStackStartRouterFactory>
>;
