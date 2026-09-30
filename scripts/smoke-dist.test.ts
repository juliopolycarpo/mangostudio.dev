import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  containsCanonicalOrigin,
  deriveDocSlugs,
  deriveRequiredDistFiles,
  expectedDocsRedirects,
  extractMetaDescription,
  findNonCanonicalOrigins,
  findPrefetchAttributeElements,
  findSitemapNotFoundUrls,
  findSlashlessInternalHrefs,
  isAstroPrefetchRuntime,
  resolveInternalHrefToDistFile,
  resolveInternalHrefToRoutePath,
  validateDocsDescriptions,
  validateDocsRedirects,
  validateNotFoundMetadata,
} from './smoke-dist';

run('extractMetaDescription reads the description meta and ignores og:description', () => {
  strictEqual(
    extractMetaDescription(
      '<meta property="og:description" content="Social"><meta name="description" content="Page &amp; more">'
    ),
    'Page &amp; more'
  );
  strictEqual(
    extractMetaDescription('<meta property="og:description" content="Social">'),
    undefined
  );
});

run('validateDocsDescriptions accepts distinct descriptions', () => {
  deepStrictEqual(
    validateDocsDescriptions('pt', 'Home.', [
      { file: 'docs/a/index.html', description: 'A.' },
      { file: 'docs/b/index.html', description: 'B.' },
    ]),
    []
  );
});

run('validateDocsDescriptions reports home reuse, duplicates, gaps, and overlong text', () => {
  const errors = validateDocsDescriptions(
    'en',
    'Home.',
    [
      { file: 'en/docs/a/index.html', description: 'Home.' },
      { file: 'en/docs/b/index.html', description: 'Same.' },
      { file: 'en/docs/c/index.html', description: 'Same.' },
      { file: 'en/docs/d/index.html', description: undefined },
      { file: 'en/docs/e/index.html', description: 'x'.repeat(11) },
    ],
    10
  );

  deepStrictEqual(errors, [
    'dist/en/docs/a/index.html expected a description distinct from the en home page | received: "Home."',
    'dist/en/docs/c/index.html expected a description unique within en | received the same as dist/en/docs/b/index.html: "Same."',
    'dist/en/docs/d/index.html expected a meta description | received: undefined',
    'dist/en/docs/e/index.html expected a description of at most 10 chars | received 11',
  ]);
});

run('deriveDocSlugs returns unique sorted doc slugs from grouped content', () => {
  deepStrictEqual(
    deriveDocSlugs([
      { items: [{ slug: 'quickstart' }, { slug: 'reference/cli' }] },
      { items: [{ slug: 'quickstart' }, { slug: 'providers/development' }] },
    ]),
    ['providers/development', 'quickstart', 'reference/cli']
  );
});

run('deriveRequiredDistFiles derives locale routes from docs groups', () => {
  const required = deriveRequiredDistFiles({
    pt: [{ items: [{ slug: 'quickstart' }, { slug: 'reference/cli' }] }],
    en: [{ items: [{ slug: 'quickstart' }, { slug: 'guides/contributing' }] }],
  });

  for (const expected of [
    'index.html',
    'en/index.html',
    'releases/index.html',
    'en/releases/index.html',
    'docs/quickstart/index.html',
    'docs/reference/cli/index.html',
    'en/docs/quickstart/index.html',
    'en/docs/guides/contributing/index.html',
    '404.html',
    'en/404.html',
    'robots.txt',
    'site.webmanifest',
    'sitemap-index.xml',
  ]) {
    ok(required.includes(expected), `${expected} should be required`);
  }
});

const PT_404 = { file: '404.html', lang: 'pt', home: '/' } as const;
const EN_404 = { file: 'en/404.html', lang: 'en', home: '/en/' } as const;

function notFoundHtml(lang: string, head = '<meta name="robots" content="noindex">'): string {
  return (
    `<!doctype html><html lang="${lang}"><head>${head}</head><body>` +
    '<a href="/" hreflang="pt">PT</a><a href="/en/" hreflang="en">EN</a></body></html>'
  );
}

run('validateNotFoundMetadata accepts a noindex page with home-pointing toggle', () => {
  deepStrictEqual(validateNotFoundMetadata(notFoundHtml('pt'), PT_404), []);
  deepStrictEqual(validateNotFoundMetadata(notFoundHtml('en'), EN_404), []);
});

run('validateNotFoundMetadata reports a wrong lang with expected and received', () => {
  deepStrictEqual(validateNotFoundMetadata(notFoundHtml('pt'), EN_404), [
    'dist/en/404.html must set <html lang="en"> | received: pt',
  ]);
});

run('validateNotFoundMetadata reports missing noindex, canonical, and alternates', () => {
  const errors = validateNotFoundMetadata(
    notFoundHtml(
      'en',
      '<link rel="canonical" href="https://mangostudio.dev/en/404/">' +
        '<link rel="alternate" hreflang="pt" href="https://mangostudio.dev/404/">'
    ),
    EN_404
  );

  strictEqual(errors.length, 3, errors.join('\n'));
  ok(errors[0]?.includes('noindex'), errors[0]);
  ok(errors[1]?.includes('rel="canonical"'), errors[1]);
  ok(errors[2]?.includes('rel="alternate"'), errors[2]);
});

run('validateNotFoundMetadata rejects og:url on an error page', () => {
  const html = notFoundHtml(
    'en',
    '<meta name="robots" content="noindex"><meta property="og:url" content="https://mangostudio.dev/en/404/">'
  );

  deepStrictEqual(validateNotFoundMetadata(html, EN_404), [
    'dist/en/404.html must not set og:url | received: a canonical URL signal',
  ]);
});

run('validateNotFoundMetadata rejects a language toggle that targets a missing 404 twin', () => {
  const html = notFoundHtml('en').replace(
    'href="/en/" hreflang="en"',
    'href="/en/404/" hreflang="en"'
  );

  deepStrictEqual(validateNotFoundMetadata(html, EN_404), [
    'dist/en/404.html language toggle must link to a locale home | received: /en/404/',
  ]);
});

run('findSitemapNotFoundUrls flags root and localized error pages only', () => {
  deepStrictEqual(
    findSitemapNotFoundUrls(
      'https://mangostudio.dev/\nhttps://mangostudio.dev/404/\nhttps://mangostudio.dev/en/404\nhttps://mangostudio.dev/docs/x404/'
    ),
    ['https://mangostudio.dev/404/', 'https://mangostudio.dev/en/404']
  );
});

run('expectedDocsRedirects sends each docs root, with and without slash, to a slash target', () => {
  deepStrictEqual(expectedDocsRedirects(), [
    '/docs /docs/quickstart/ 301',
    '/docs/ /docs/quickstart/ 301',
    '/en/docs /en/docs/quickstart/ 301',
    '/en/docs/ /en/docs/quickstart/ 301',
  ]);
});

run('validateDocsRedirects reports each missing or slashless rule', () => {
  const text = [
    '# comment',
    '/docs   /docs/quickstart/ 301',
    '/en/docs /en/docs/quickstart 301',
  ].join('\n');
  const errors = validateDocsRedirects(text);

  strictEqual(
    errors.length,
    3,
    `expected 3 missing rules | received ${errors.length}: ${errors.join(' | ')}`
  );
  ok(errors[0]?.includes('"/docs/ /docs/quickstart/ 301"'), `received: ${errors[0]}`);
});

run('public/_redirects declares every docs redirect', () => {
  const text = readFileSync(new URL('../public/_redirects', import.meta.url), 'utf8');

  deepStrictEqual(validateDocsRedirects(text), []);
});

run('findSlashlessInternalHrefs flags internal page links without a trailing slash', () => {
  const html = [
    '<a href="/docs/quickstart">a</a>',
    '<a href="/en/releases?x=1#top">b</a>',
    '<a href="https://mangostudio.dev/docs/cli">c</a>',
    '<a href="/docs/quickstart/">ok</a>',
    '<a href="/docs/quickstart/#install">ok</a>',
    '<a href="#install">ok</a>',
    '<a href="/install.sh">file</a>',
    '<a href="https://github.com/juliopolycarpo/mangostudio">external</a>',
  ].join('');

  deepStrictEqual(findSlashlessInternalHrefs(html), [
    '/docs/quickstart',
    '/en/releases?x=1#top',
    'https://mangostudio.dev/docs/cli',
  ]);
});

run('resolveInternalHrefToDistFile maps internal routes to emitted files', () => {
  strictEqual(resolveInternalHrefToDistFile('/'), 'index.html');
  strictEqual(resolveInternalHrefToDistFile('/en/'), 'en/index.html');
  strictEqual(
    resolveInternalHrefToDistFile('/docs/quickstart#install'),
    'docs/quickstart/index.html'
  );
  strictEqual(
    resolveInternalHrefToDistFile('https://mangostudio.dev/en/releases?ref=smoke'),
    'en/releases/index.html'
  );
  strictEqual(resolveInternalHrefToDistFile('/favicon.ico'), 'favicon.ico');
  strictEqual(resolveInternalHrefToDistFile('#features'), null);
  strictEqual(resolveInternalHrefToDistFile('https://github.com/juliopolycarpo/mangostudio'), null);
});

run('resolveInternalHrefToRoutePath normalizes same-origin links', () => {
  strictEqual(resolveInternalHrefToRoutePath('/docs/quickstart#install'), '/docs/quickstart');
  strictEqual(
    resolveInternalHrefToRoutePath('https://mangostudio.dev/en/releases?ref=smoke'),
    '/en/releases'
  );
  strictEqual(
    resolveInternalHrefToRoutePath('https://github.com/juliopolycarpo/mangostudio'),
    null
  );
});

run('findPrefetchAttributeElements reports every element that carries data-astro-prefetch', () => {
  const html = `
    <a href="/docs/quickstart" data-astro-prefetch>Quickstart</a>
    <a data-astro-prefetch="hover" href="/releases">Releases</a>
    <a href="https://github.com/juliopolycarpo/mangostudio" data-astro-prefetch="false">GitHub</a>
    <a href="/docs/reference/cli">CLI</a>
  `;

  deepStrictEqual(findPrefetchAttributeElements(html), [
    '<a href="/docs/quickstart" data-astro-prefetch>',
    '<a data-astro-prefetch="hover" href="/releases">',
    '<a href="https://github.com/juliopolycarpo/mangostudio" data-astro-prefetch="false">',
  ]);
});

run('findPrefetchAttributeElements ignores prefetch-free markup and lookalike attributes', () => {
  const html = `
    <a href="/docs/quickstart" data-astro-prefetched="x">Quickstart</a>
    <link rel="prefetch" href="/releases">
    <p>data-astro-prefetch is documented here</p>
  `;

  deepStrictEqual(findPrefetchAttributeElements(html), []);
});

run('isAstroPrefetchRuntime flags the Astro prefetch bundle and passes app scripts', () => {
  const prefetchRuntime = 'var i=!1;function o(e){i??=e?.prefetchAll??!1}';
  const dataset = 'let n=t.dataset.astroPrefetch;return n===`false`';

  strictEqual(isAstroPrefetchRuntime(prefetchRuntime), true, 'prefetchAll bundle not detected');
  strictEqual(isAstroPrefetchRuntime(dataset), true, 'astroPrefetch dataset read not detected');
  strictEqual(
    isAstroPrefetchRuntime('document.addEventListener(`click`,()=>{})'),
    false,
    'expected app script without prefetch code to pass'
  );
});

run('canonical host helpers accept production origin and reject preview origins', () => {
  const text =
    'Sitemap: https://mangostudio.dev/sitemap-index.xml\n' +
    'Preview: https://mangostudio-dev.pages.dev/sitemap-index.xml\n' +
    'Local: http://localhost:4321/';

  strictEqual(containsCanonicalOrigin(text), true);
  deepStrictEqual(findNonCanonicalOrigins(text), [
    'http://localhost:4321',
    'https://mangostudio-dev.pages.dev',
  ]);
});

run('canonical host helpers reject substring host spoofing', () => {
  const text =
    'Spoofed path: https://example.com/https://mangostudio.dev/sitemap-index.xml\n' +
    'Spoofed host: https://mangostudio.dev.example.com/sitemap-index.xml';

  strictEqual(containsCanonicalOrigin(text), false);
  deepStrictEqual(findNonCanonicalOrigins(text), [
    'https://example.com',
    'https://mangostudio.dev.example.com',
  ]);
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
