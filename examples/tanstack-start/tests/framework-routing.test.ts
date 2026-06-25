import { fileURLToPath } from 'node:url';

import {
  describeFrameworkRoutingContract,
  optionalStaticSuffixRoutingCases,
} from '../../test-utils/framework-routing-contract.js';

// These tests assert the framework routing behavior Super Sitemap mirrors, ensuring consistency of implementation with actual framework routing behavior.
describeFrameworkRoutingContract({
  appName: 'TanStack Start',
  cases: optionalStaticSuffixRoutingCases,
  rootDir: fileURLToPath(new URL('..', import.meta.url)),
});
