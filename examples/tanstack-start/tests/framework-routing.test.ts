import { fileURLToPath } from 'node:url';

import {
  describeFrameworkRoutingContract,
  optionalStaticSuffixRoutingCases,
} from '../../test-utils/framework-routing-contract.js';

// These tests assert the framework routing behavior Super Sitemap mirrors.
// They intentionally check status codes only, not rendering details.
describeFrameworkRoutingContract({
  appName: 'TanStack Start',
  cases: optionalStaticSuffixRoutingCases,
  rootDir: fileURLToPath(new URL('..', import.meta.url)),
});
