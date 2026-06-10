import { createRouter } from '@tanstack/react-router';

import { routeTree } from './routeTree.gen';

/**
 * The app's router factory. Both TanStack Start and super-sitemap call this to
 * obtain the router and its resolved `routesByPath` map.
 */
export function getRouter() {
  return createRouter({ routeTree });
}
