/** Small HTML and pattern helpers shared by the dist smoke checks and the link crawl. */

/** Reads the attributes of one start tag into a map keyed by lower-cased name.
 *
 * @example
 * parseAttributes('<a href="/x" class=y>').get('href'); // '/x'
 */
export function parseAttributes(tag: string): Map<string, string> {
  const attrs = new Map<string, string>();
  const attrPattern =
    /\s([A-Za-z_:][-A-Za-z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match = attrPattern.exec(tag);

  while (match !== null) {
    const name = match[1]?.toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? '';

    if (name) {
      attrs.set(name, value);
    }

    match = attrPattern.exec(tag);
  }

  return attrs;
}

/** Decodes the character references an HTML attribute value can carry.
 *
 * @example
 * decodeHtmlAttribute('a&amp;b'); // 'a&b'
 */
export function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (match: string, codePoint: string) =>
      decodeCodePoint(Number.parseInt(codePoint, 16), match)
    )
    .replace(/&#(\d+);/g, (match: string, codePoint: string) =>
      decodeCodePoint(Number.parseInt(codePoint, 10), match)
    )
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function decodeCodePoint(codePoint: number, original: string): string {
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return original;
  }

  return String.fromCodePoint(codePoint);
}

/** Escapes `value` so it matches literally inside a `RegExp`.
 *
 * @example
 * escapeRegExp('a.b'); // 'a\\.b'
 */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
