import { describe, expect, it } from 'vitest';

import { renderSitemapIndexXml, renderSitemapXml } from './xml.js';

describe('core XML helpers', () => {
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
