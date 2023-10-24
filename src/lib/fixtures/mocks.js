// Mock Service Worker, to mock HTTP requests for tests.
// https://mswjs.io/docs/basics/mocking-responses
import fs from 'fs';
import { http } from 'msw';
import { setupServer } from 'msw/node';

const sitemap1 = fs.readFileSync('./src/lib/fixtures/expected-sitemap-index1.xml', 'utf8');
const sitemap2 = fs.readFileSync('./src/lib/fixtures/expected-sitemap-index2.xml', 'utf8');
const sitemap3 = fs.readFileSync('./src/lib/fixtures/expected-sitemap-index3.xml', 'utf8');
const sitemap4 = fs.readFileSync('./src/lib/fixtures/expected-sitemap-index4.xml', 'utf8');
const sitemap5 = fs.readFileSync('./src/lib/fixtures/expected-sitemap-index5.xml', 'utf8');

export const handlers = [
  http.get('http://localhost:4173/sitemap1.xml', () => new Response(sitemap1)),
  http.get('http://localhost:4173/sitemap2.xml', () => new Response(sitemap2)),
  http.get('http://localhost:4173/sitemap3.xml', () => new Response(sitemap3)),
  http.get('http://localhost:4173/sitemap4.xml', () => new Response(sitemap4)),
  http.get('http://localhost:4173/sitemap5.xml', () => new Response(sitemap5))
];

export const server = setupServer(...handlers);
