import { createFileRoute } from '@tanstack/react-router';
import { response, type SitemapConfig } from 'super-sitemap/tanstack-start';

import { getRouter } from '../router';

const sitemapConfig = {
  origin: 'https://example.com',
  router: getRouter,
  paramValues: {
    '/blog/$slug': ['hello-world', 'another-post'],
  },
} satisfies SitemapConfig;

// Serves /sitemap.xml (no page param) and /sitemap1.xml, /sitemap2.xml, etc.
export const Route = createFileRoute('/sitemap{-$page}.xml')({
  server: {
    handlers: {
      GET: ({ params }) => response({ ...sitemapConfig, page: params.page }),
    },
  },
});
