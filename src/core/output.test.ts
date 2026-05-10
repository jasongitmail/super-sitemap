import { describe, expect, it } from 'vitest';

import type { PathObj } from './types.js';

import {
  deduplicatePaths,
  generateAdditionalPaths,
  paginatePaths,
  renderSitemapIndexXml,
  renderSitemapXml,
  sortPaths,
} from './index.js';

describe('core output helpers', () => {
  it('normalizes additional paths with defaults without locale expansion', () => {
    expect(
      generateAdditionalPaths({
        additionalPaths: ['manual.pdf', '/already-normalized'],
        defaultChangefreq: 'weekly',
        defaultPriority: 0.4,
      })
    ).toEqual([
      {
        changefreq: 'weekly',
        lastmod: undefined,
        path: '/manual.pdf',
        priority: 0.4,
      },
      {
        changefreq: 'weekly',
        lastmod: undefined,
        path: '/already-normalized',
        priority: 0.4,
      },
    ]);
  });

  it('deduplicates paths by keeping first position and last object metadata', () => {
    const paths: PathObj[] = [
      { path: '/first' },
      { changefreq: 'daily', path: '/duplicate', priority: 0.3 },
      { path: '/middle' },
      { changefreq: 'monthly', path: '/duplicate', priority: 0.9 },
    ];

    expect(deduplicatePaths(paths)).toEqual([
      { path: '/first' },
      { changefreq: 'monthly', path: '/duplicate', priority: 0.9 },
      { path: '/middle' },
    ]);
  });

  it('sorts paths alphabetically only when requested', () => {
    const paths = [{ path: '/z' }, { path: '/a' }, { path: '/m' }];

    expect(sortPaths(paths, false).map(({ path }) => path)).toEqual(['/z', '/a', '/m']);
    expect(sortPaths(paths, 'alpha').map(({ path }) => path)).toEqual(['/a', '/m', '/z']);
  });

  it('paginates path arrays and reports invalid or unavailable pages', () => {
    const paths = [{ path: '/one' }, { path: '/two' }, { path: '/three' }];

    expect(paginatePaths({ maxPerPage: 2, page: '2', paths })).toEqual({
      kind: 'ok',
      paths: [{ path: '/three' }],
    });
    expect(paginatePaths({ maxPerPage: 2, page: '0', paths })).toEqual({
      kind: 'invalid-page',
    });
    expect(paginatePaths({ maxPerPage: 2, page: '3', paths })).toEqual({
      kind: 'not-found',
    });
  });

  it('renders sitemap XML with optional fields and alternates in compatible order', () => {
    const xml = renderSitemapXml('https://example.com', [
      {
        alternates: [
          { lang: 'en', path: '/about' },
          { lang: 'de', path: '/de/about' },
        ],
        changefreq: 'weekly',
        lastmod: '2026-01-02',
        path: '/about',
        priority: 0.8,
      },
      { path: '/minimal' },
    ]);

    expect(xml).toBe(`<?xml version="1.0" encoding="UTF-8" ?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
>
  <url>
    <loc>https://example.com/about</loc>
    <lastmod>2026-01-02</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/about" />
    <xhtml:link rel="alternate" hreflang="de" href="https://example.com/de/about" />
  </url>
  <url>
    <loc>https://example.com/minimal</loc>
  </url>
</urlset>`);
  });

  it('renders sitemap index XML with compatible page URLs', () => {
    expect(renderSitemapIndexXml('https://example.com', 2))
      .toBe(`<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap1.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap2.xml</loc>
  </sitemap>
</sitemapindex>`);
  });
});
