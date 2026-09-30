import { deepStrictEqual, strictEqual } from 'node:assert/strict';

import { decodeHtmlAttribute, escapeRegExp, parseAttributes } from './dist-html';

run('parseAttributes reads quoted, unquoted and bare attributes with lower-cased names', () => {
  deepStrictEqual(
    [...parseAttributes('<a HREF="/x" class=y data-k=\'v\' hidden>')],
    [
      ['href', '/x'],
      ['class', 'y'],
      ['data-k', 'v'],
      ['hidden', ''],
    ]
  );
});

run('decodeHtmlAttribute decodes named and numeric references and keeps invalid ones', () => {
  strictEqual(decodeHtmlAttribute('a&amp;b&quot;&#39;&lt;&gt;&#x41;&#66;'), 'a&b"\'<>AB');
  strictEqual(
    decodeHtmlAttribute('&#1114112;'),
    '&#1114112;',
    'expected an out-of-range code point to stay as written'
  );
});

run('escapeRegExp makes special characters match literally', () => {
  const pattern = new RegExp(`^${escapeRegExp('a.b*c(d)')}$`);

  strictEqual(pattern.test('a.b*c(d)'), true);
  strictEqual(pattern.test('aXb*c(d)'), false, 'expected "." to match only a literal dot');
});

function run(name: string, fn: () => void): void {
  try {
    fn();
    process.stdout.write(`[ok] ${name}\n`);
  } catch (error) {
    process.stderr.write(`[fail] ${name}\n`);
    throw error;
  }
}
