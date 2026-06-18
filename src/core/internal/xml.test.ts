import { describe, expect, it } from 'vitest';

import {
  hasValidXmlStructure,
  parseSitemapXml,
  renderSitemapIndexXml,
  renderSitemapXml,
} from './xml.js';

describe('core XML helpers', () => {
  it('renders sitemap XML with optional fields and alternates in compatible order', () => {
    const xml = renderSitemapXml('https://example.com', [
      {
        alternates: [
          { hreflang: 'en', path: '/about' },
          { hreflang: 'de', path: '/de/about' },
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

  it('renders zero priority because it is valid sitemap metadata', () => {
    const xml = renderSitemapXml('https://example.com', [
      { path: '/lowest-priority', priority: 0.0 },
    ]);

    expect(xml).toContain('<priority>0</priority>');
  });

  it('escapes sitemap XML text and alternate link attributes', () => {
    const xml = renderSitemapXml('https://example.com', [
      {
        alternates: [
          {
            hreflang: 'en-US"primary\'',
            path: '/search?tag=<news>&quote="fresh"&apostrophe=\'today\'',
          },
        ],
        lastmod: '2026-01-02T00:00:00Z & pending <review>',
        path: '/search?tag=<news>&quote="fresh"&apostrophe=\'today\'',
      },
    ]);

    expect(xml).toContain(
      '<loc>https://example.com/search?tag=&lt;news&gt;&amp;quote="fresh"&amp;apostrophe=\'today\'</loc>'
    );
    expect(xml).toContain('<lastmod>2026-01-02T00:00:00Z &amp; pending &lt;review&gt;</lastmod>');
    expect(xml).toContain('hreflang="en-US&quot;primary&apos;"');
    expect(xml).toContain(
      'href="https://example.com/search?tag=&lt;news&gt;&amp;quote=&quot;fresh&quot;&amp;apostrophe=&apos;today&apos;"'
    );
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

  it('escapes sitemap index loc text', () => {
    expect(renderSitemapIndexXml('https://example.com/root?section=<maps>&draft=yes', 1)).toContain(
      '<loc>https://example.com/root?section=&lt;maps&gt;&amp;draft=yes/sitemap1.xml</loc>'
    );
  });

  it('parses sitemap loc values and decodes entities', () => {
    const result = parseSitemapXml(`
      <?xml version="1.0" encoding="UTF-8" ?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://example.com/about?x=1&amp;y=2</loc>
        </url>
        <url>
          <loc>https://example.com/caf&#233;</loc>
        </url>
      </urlset>
    `);

    expect(result).toEqual({
      kind: 'sitemap',
      locs: ['https://example.com/about?x=1&y=2', 'https://example.com/café'],
    });
  });

  it('parses sitemap index loc values', () => {
    const result = parseSitemapXml(`
      <?xml version="1.0" encoding="UTF-8" ?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap>
          <loc>https://example.com/sitemap1.xml</loc>
        </sitemap>
        <sitemap>
          <loc>https://example.com/sitemap2.xml</loc>
        </sitemap>
      </sitemapindex>
    `);

    expect(result).toEqual({
      kind: 'sitemapindex',
      locs: ['https://example.com/sitemap1.xml', 'https://example.com/sitemap2.xml'],
    });
  });

  it('returns true for balanced XML tags', () => {
    const result = hasValidXmlStructure(`
      <?xml version="1.0" encoding="UTF-8" ?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://example.com/about</loc>
          <xhtml:link rel="alternate" hreflang="en" href="https://example.com/about" />
        </url>
      </urlset>
    `);

    expect(result).toBe(true);
  });

  it('returns false for mismatched XML tags', () => {
    const result = hasValidXmlStructure(`
      <urlset>
        <url>
          <loc>https://example.com/about</loc>
        </sitemap>
      </urlset>
    `);

    expect(result).toBe(false);
  });
});
