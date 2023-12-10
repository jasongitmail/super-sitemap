import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
  // Pretend this is a SvelteKit OG image generation lib; for testing SK
  // Sitemap, we only need the route to exist.
  return new Response('OG route', { headers: { 'content-type': 'text/html' } });
};
