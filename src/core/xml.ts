import type { PathObj } from './types.js';

/**
 * Generates an XML response body based on the provided paths, using the sitemap protocol
 * structure.
 *
 * @remarks
 * - Google ignores changefreq and priority, but we support these optionally.
 *
 * @param origin - The origin URL. E.g. `https://example.com`. No trailing slash
 *                 because "/" is the index page.
 * @param pathObjs - Array of path objects to include in the sitemap. Each path within it should
 *                 start with a '/'; but if not, it will be added.
 * @returns The generated XML sitemap.
 */
export function renderSitemapXml(origin: string, pathObjs: PathObj[]): string {
  const urlElements = pathObjs
    .map((pathObj) => {
      const { alternates, changefreq, lastmod, path, priority } = pathObj;

      let url = '\n  <url>\n';
      url += `    <loc>${origin}${path}</loc>\n`;
      url += lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : '';
      url += changefreq ? `    <changefreq>${changefreq}</changefreq>\n` : '';
      url += priority ? `    <priority>${priority}</priority>\n` : '';

      if (alternates) {
        url += alternates
          .map(
            ({ lang, path }) =>
              `    <xhtml:link rel="alternate" hreflang="${lang}" href="${origin}${path}" />\n`
          )
          .join('');
      }

      url += '  </url>';

      return url;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" ?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
>${urlElements}
</urlset>`;
}

/**
 * Generates a sitemap index XML string.
 *
 * @param origin - The origin URL. E.g. `https://example.com`. No trailing slash.
 * @param pages - The number of sitemap pages to include in the index.
 * @returns The generated XML sitemap index.
 */
export function renderSitemapIndexXml(origin: string, pages: number): string {
  let str = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  for (let i = 1; i <= pages; i++) {
    str += `
  <sitemap>
    <loc>${origin}/sitemap${i}.xml</loc>
  </sitemap>`;
  }
  str += `
</sitemapindex>`;

  return str;
}
