import { describe, expect, it } from 'vitest';

import { hasValidXmlStructure, parseSitemapXml } from './xml.js';

describe('sitemap-xml.ts', () => {
  describe('parseSitemapXml()', () => {
    it('should parse sitemap loc values and decode entities', () => {
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

    it('should parse sitemap index loc values', () => {
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
  });

  describe('hasValidXmlStructure()', () => {
    it('should return true for balanced XML tags', () => {
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

    it('should return false for mismatched XML tags', () => {
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
});
