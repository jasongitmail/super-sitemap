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
 *
 * @param xml - XML string to normalize.
 * @returns XML without the declaration prefix.
 */
function stripXmlDeclaration(xml: string): string {
  return xml.replace(XML_DECLARATION_REGEX, '');
}

/**
 * Extracts `<loc>` values from repeated sitemap entry elements.
 *
 * @param xml - XML string to inspect.
 * @param entryTagName - Parent entry tag, e.g. `url` or `sitemap`.
 * @returns Decoded `<loc>` text values.
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
 *
 * @param value - Escaped XML text.
 * @returns Decoded text.
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
 *
 * @param codePoint - Unicode code point.
 * @param fallback - Original entity text to preserve on invalid input.
 * @returns Decoded character or the original entity.
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
 *
 * @param tag - Raw tag content without angle brackets.
 * @returns Tag name when valid.
 */
function getTagName(tag: string): string | undefined {
  return tag.trim().match(/^[^\s/]+/)?.[0];
}
