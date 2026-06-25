import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
  return Response.json({ ok: true });
};
