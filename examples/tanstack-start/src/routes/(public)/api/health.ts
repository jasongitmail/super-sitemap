import { createFileRoute } from '@tanstack/react-router';

// Example server-only endpoint. It should not appear in the generated sitemap.
export const Route = createFileRoute('/(public)/api/health')({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true }),
    },
  },
});
