import { deepStrictEqual, strictEqual } from 'node:assert/strict';

import type { Lang } from './types';
import { alternatePath, routes, withTrailingSlash } from './ui';

const LANGS: readonly Lang[] = ['pt', 'en'];
const SAMPLE_DOC_IDS = ['quickstart', 'reference/cli', 'guides/contributing'];

await run('withTrailingSlash appends the slash before any query or fragment', () => {
  const cases: [string, string][] = [
    ['/docs/quickstart', '/docs/quickstart/'],
    ['/docs/quickstart/', '/docs/quickstart/'],
    ['/docs/quickstart#install', '/docs/quickstart/#install'],
    ['/docs/quickstart?tab=1#install', '/docs/quickstart/?tab=1#install'],
    ['/', '/'],
  ];

  for (const [input, expected] of cases) {
    strictEqual(
      withTrailingSlash(input),
      expected,
      `expected withTrailingSlash(${JSON.stringify(input)}) to be ${expected}`
    );
  }
});

await run('routes emit the canonical trailing-slash URL for both locales', () => {
  deepStrictEqual(
    [
      routes.home('pt'),
      routes.home('en'),
      routes.releases('pt'),
      routes.releases('en'),
      routes.doc('pt', 'reference/cli'),
      routes.doc('en', 'reference/cli'),
    ],
    ['/', '/en/', '/releases/', '/en/releases/', '/docs/reference/cli/', '/en/docs/reference/cli/']
  );
});

await run('every routes builder returns a slash-terminated internal path', () => {
  for (const lang of LANGS) {
    const built = [
      routes.home(lang),
      routes.releases(lang),
      ...SAMPLE_DOC_IDS.map((id) => routes.doc(lang, id)),
    ];

    for (const href of built) {
      strictEqual(
        href.startsWith('/') && href.endsWith('/'),
        true,
        `expected ${lang} route to be a root-relative path ending in "/" | received: ${JSON.stringify(href)}`
      );
    }
  }
});

await run('alternatePath keeps the slash form when switching locale', () => {
  strictEqual(alternatePath('/docs/quickstart/', 'en'), '/en/docs/quickstart/');
  strictEqual(alternatePath('/en/releases/', 'pt'), '/releases/');
});

async function run(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    process.stdout.write(`[ok] ${name}\n`);
  } catch (error) {
    process.stderr.write(`[fail] ${name}\n`);
    throw error;
  }
}
