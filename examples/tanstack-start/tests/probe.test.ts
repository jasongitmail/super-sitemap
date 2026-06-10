import { it } from 'vitest';

import { getRouter } from '../src/router';

it('probe route record shapes', () => {
  const routesByPath = getRouter().routesByPath as Record<string, any>;
  for (const [key, route] of Object.entries(routesByPath)) {
    const options = route?.options ?? {};
    console.log(
      JSON.stringify({
        key,
        optionKeys: Object.keys(options),
        hasComponent: options.component != null,
        hasServer: options.server != null,
        serverKeys: options.server ? Object.keys(options.server) : null,
      })
    );
  }
});
