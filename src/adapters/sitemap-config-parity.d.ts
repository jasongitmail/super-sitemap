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
