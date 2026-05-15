import type { PathObj } from './types.js';

export type ParsedSitemapXml =
  | {
      kind: 'sitemap';
      locs: string[];
    }
  | {
      kind: 'sitemapindex';
      locs: string[];
    };

const XML_DECLARATION_REGEX = /^\s*<\?xml[\s\S]*?\?>\s*/;
const XML_COMMENT_REGEX = /<!--[\s\S]*?-->/g;
const XML_TAG_REGEX = /<([^>]+)>/g;

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

/**
 * Parses the subset of sitemap XML used by this package.
 *
 * @param xml - XML string to parse.
 * @returns Parsed root kind and its `<loc>` values.
 */
export function parseSitemapXml(xml: string): ParsedSitemapXml {
  const normalizedXml = stripXmlDeclaration(xml).trim();

  if (/^<urlset\b/.test(normalizedXml)) {
    return {
      kind: 'sitemap',
      locs: extractLocs(normalizedXml, 'url'),
    };
  }

  if (/^<sitemapindex\b/.test(normalizedXml)) {
    return {
      kind: 'sitemapindex',
      locs: extractLocs(normalizedXml, 'sitemap'),
    };
  }

  throw new Error('Sitemap: unsupported XML root element.');
}

/**
 * Returns whether XML tag structure is valid for generated sitemap assertions.
 *
 * @param xml - XML string to validate.
 * @returns `true` when tags are properly nested and balanced.
 *
 * @remarks
 * This is sufficient for this package's tests because the sitemap generator is
 * deterministic and the tests already assert the exact emitted XML content. The
 * remaining failure mode worth checking here is broken tag nesting or balance.
 * This is not a full XML validator and does not fully validate XML syntax,
 * namespaces, attributes, DTDs, or entity rules.
 */
export function hasValidXmlStructure(xml: string): boolean {
  const stack: string[] = [];
  const sanitizedXml = stripXmlDeclaration(xml).replaceAll(XML_COMMENT_REGEX, '');

  for (const match of sanitizedXml.matchAll(XML_TAG_REGEX)) {
    const tag = match[1]?.trim();
    if (!tag || tag.startsWith('!') || tag.startsWith('?')) {
      continue;
    }

    if (tag.startsWith('/')) {
      const closingTagName = getTagName(tag.slice(1));
      if (!closingTagName || stack.pop() !== closingTagName) {
        return false;
      }
      continue;
    }

    if (tag.endsWith('/')) {
      if (!getTagName(tag.slice(0, -1))) {
        return false;
      }
      continue;
    }

    const openingTagName = getTagName(tag);
    if (!openingTagName) {
      return false;
    }
    stack.push(openingTagName);
  }

  return stack.length === 0;
}

/**
 * Removes a leading XML declaration when present.
 */
function stripXmlDeclaration(xml: string): string {
  return xml.replace(XML_DECLARATION_REGEX, '');
}

/**
 * Extracts `<loc>` values from repeated sitemap entry elements.
 */
function extractLocs(xml: string, entryTagName: 'sitemap' | 'url'): string[] {
  const locs: string[] = [];
  const entryRegex = new RegExp(
    `<${entryTagName}\\b[\\s\\S]*?<loc>([\\s\\S]*?)<\\/loc>[\\s\\S]*?<\\/${entryTagName}>`,
    'g'
  );

  for (const match of xml.matchAll(entryRegex)) {
    const loc = match[1]?.trim();
    if (loc) {
      locs.push(decodeXmlText(loc));
    }
  }

  return locs;
}

/**
 * Decodes XML text entities used within `<loc>` values.
 */
function decodeXmlText(value: string): string {
  return value.replaceAll(
    /&(?:#(?<decimal>\d+)|#x(?<hex>[0-9a-fA-F]+)|(?<named>amp|apos|gt|lt|quot));/g,
    (entity, _decimal, _hex, named, _offset, _input, groups) => {
      const decimal = groups?.decimal;
      const hex = groups?.hex;

      if (decimal) {
        return decodeCodePoint(Number(decimal), entity);
      }

      if (hex) {
        return decodeCodePoint(Number.parseInt(hex, 16), entity);
      }

      switch (named) {
        case 'amp':
          return '&';
        case 'apos':
          return "'";
        case 'gt':
          return '>';
        case 'lt':
          return '<';
        case 'quot':
          return '"';
        default:
          return entity;
      }
    }
  );
}

/**
 * Decodes a numeric XML entity when its code point is valid.
 */
function decodeCodePoint(codePoint: number, fallback: string): string {
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return fallback;
  }

  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return fallback;
  }
}

/**
 * Extracts the tag name from a raw tag body.
 */
function getTagName(tag: string): string | undefined {
  return tag.trim().match(/^[^\s/]+/)?.[0];
}
