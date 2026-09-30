import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  containsCanonicalOrigin,
  deriveDocSlugs,
  deriveRequiredDistFiles,
  expectedDocsRedirects,
  extractCrawlHrefs,
  extractFragmentTargets,
  findBrokenLinks,
  findNonCanonicalOrigins,
  findPrefetchAttributeElements,
  findSitemapNotFoundUrls,
  findSlashlessInternalHrefs,
  formatBrokenLink,
  isAstroPrefetchRuntime,
  parseRedirects,
  resolveInternalHrefToDistFile,
  resolveInternalHrefToRoutePath,
  resolveServedPath,
  validateDocsRedirects,
  validateNotFoundMetadata,
} from './smoke-dist';

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

function snapshot(
  pages: Record<string, string>,
  extraFiles: string[] = [],
  redirectsText?: string
) {
  const html = new Map(Object.entries(pages));
  const files = new Set([...html.keys(), ...extraFiles]);
  return { files, html, redirectsText };
}

function page(body: string, head = ''): string {
  return `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
}

run('findBrokenLinks accepts links that resolve to emitted pages', () => {
  const broken = findBrokenLinks(
    snapshot({
      'index.html': page('<a href="/docs/quickstart/">docs</a><a href="/releases">releases</a>'),
      'docs/quickstart/index.html': page('<h2 id="install">Install</h2>'),
      'releases/index.html': page(''),
    })
  );

  deepStrictEqual(broken, []);
});

run('findBrokenLinks reports a missing page with page, href, expected and received', () => {
  const broken = findBrokenLinks(
    snapshot({ 'docs/index.html': page('<a href="/docs/missing/">gone</a>') })
  );

  deepStrictEqual(broken.map(formatBrokenLink), [
    'dist/docs/index.html links to /docs/missing/ | expected: dist/docs/missing/index.html or dist/docs/missing.html | received: no such file and no matching redirect',
  ]);
});

run('findBrokenLinks reports a missing fragment on another page and on the same page', () => {
  const broken = findBrokenLinks(
    snapshot({
      'index.html': page(
        '<a href="/docs/#nope">a</a><a href="#also-nope">b</a><a href="#here">c</a><h1 id="here">x</h1>'
      ),
      'docs/index.html': page('<h2 id="real">Real</h2>'),
    })
  );

  deepStrictEqual(broken.map(formatBrokenLink), [
    'dist/index.html links to #also-nope | expected: id="also-nope" in dist/index.html | received: no element with that id or name',
    'dist/index.html links to /docs/#nope | expected: id="nope" in dist/docs/index.html | received: no element with that id or name',
  ]);
});

run('findBrokenLinks accepts slash and slashless forms for directory and flat pages', () => {
  const broken = findBrokenLinks(
    snapshot({
      'index.html': page(
        '<a href="/docs/x">1</a><a href="/docs/x/">2</a><a href="/404">3</a><a href="/404/">4</a>' +
          '<a href="/en/">5</a><a href="/en">6</a>'
      ),
      'docs/x/index.html': page(''),
      '404.html': page(''),
      'en/index.html': page(''),
    })
  );

  deepStrictEqual(broken, []);
});

run('findBrokenLinks resolves relative hrefs against the page route', () => {
  const broken = findBrokenLinks(
    snapshot({
      'docs/a/index.html': page('<a href="../b/">b</a><a href="c/">c</a>'),
      'docs/b/index.html': page(''),
    })
  );

  deepStrictEqual(
    broken.map((link) => link.href),
    ['c/']
  );
});

run('findBrokenLinks ignores external, mailto, tel and other-origin links', () => {
  const broken = findBrokenLinks(
    snapshot({
      'index.html': page(
        '<a href="https://github.com/x/y#nope">gh</a><a href="mailto:a@b.c">m</a>' +
          '<a href="tel:123">t</a><a href="//cdn.example/x">cdn</a>' +
          '<a href="https://preview.mangostudio.dev/missing">preview</a>'
      ),
    })
  );

  deepStrictEqual(broken, []);
});

run('findBrokenLinks checks canonical, alternate and stylesheet link tags', () => {
  const broken = findBrokenLinks(
    snapshot({
      'index.html': page(
        '',
        '<link rel="canonical" href="https://mangostudio.dev/">' +
          '<link rel="alternate" hreflang="en" href="https://mangostudio.dev/en/">' +
          '<link rel="stylesheet" href="/_astro/app.css">'
      ),
    })
  );

  deepStrictEqual(
    broken.map((link) => link.href),
    ['/_astro/app.css', 'https://mangostudio.dev/en/']
  );
});

run('findBrokenLinks ignores markup inside scripts, styles and comments', () => {
  const broken = findBrokenLinks(
    snapshot({
      'index.html': page(
        '<script>const s = \'<a href="/ghost/">x</a>\';</script><!-- <a href="/ghost2/">y</a> -->' +
          '<style>a[href="/ghost3/"]{}</style>'
      ),
    })
  );

  deepStrictEqual(broken, []);
});

run('findBrokenLinks treats #top, empty fragments and non-html targets as valid', () => {
  const broken = findBrokenLinks(
    snapshot(
      { 'index.html': page('<a href="#top">t</a><a href="#">e</a><a href="/install.sh#L1">s</a>') },
      ['install.sh']
    )
  );

  deepStrictEqual(broken, []);
});

run('findBrokenLinks follows _redirects rules and checks the destination', () => {
  const pages = {
    'index.html': page(
      '<a href="/docs">docs</a><a href="/old/thing">old</a><a href="/bad">bad</a>'
    ),
    'docs/quickstart/index.html': page(''),
    'new/thing/index.html': page(''),
  };
  const redirectsText = [
    '# comment',
    '/docs /docs/quickstart 302',
    '/old/* /new/:splat 301',
    '/bad /nowhere/ 301',
    '',
  ].join('\n');

  deepStrictEqual(
    findBrokenLinks(snapshot(pages, [], redirectsText)).map((link) => link.href),
    ['/bad']
  );
  deepStrictEqual(
    findBrokenLinks(snapshot(pages)).map((link) => link.href),
    ['/bad', '/docs', '/old/thing']
  );
});

run('resolveServedPath mirrors auto-trailing-slash lookup order', () => {
  const files = new Set(['index.html', 'a/index.html', 'b.html', 'c.txt']);

  deepStrictEqual(resolveServedPath('/', files, []), { kind: 'file', file: 'index.html' });
  deepStrictEqual(resolveServedPath('/a', files, []), { kind: 'file', file: 'a/index.html' });
  deepStrictEqual(resolveServedPath('/a/', files, []), { kind: 'file', file: 'a/index.html' });
  deepStrictEqual(resolveServedPath('/b/', files, []), { kind: 'file', file: 'b.html' });
  deepStrictEqual(resolveServedPath('/c.txt', files, []), { kind: 'file', file: 'c.txt' });
  deepStrictEqual(resolveServedPath('/c.txt/', files, []), { kind: 'missing' });
  deepStrictEqual(resolveServedPath('/zzz', files, []), { kind: 'missing' });
});

run('resolveServedPath stops redirect loops and passes external destinations', () => {
  const loop = parseRedirects('/a /b\n/b /a');

  deepStrictEqual(resolveServedPath('/a', new Set(), loop), { kind: 'missing' });
  deepStrictEqual(resolveServedPath('/x', new Set(), parseRedirects('/x https://example.com/y')), {
    kind: 'external',
  });
});

run(
  'extractCrawlHrefs returns anchors and link tags; extractFragmentTargets reads ids and names',
  () => {
    const html = page(
      '<a href="/a" class="x">a</a><a name="legacy"></a><h2 id="one">1</h2><p id=two>2</p>',
      '<link rel="canonical" href="https://mangostudio.dev/">'
    );

    deepStrictEqual(extractCrawlHrefs(html), ['/a', 'https://mangostudio.dev/']);
    deepStrictEqual([...extractFragmentTargets(html)].sort(), ['legacy', 'one', 'two']);
  }
);

run('parseRedirects skips comments and defaults the status to 301', () => {
  deepStrictEqual(parseRedirects('# c\n\n/a /b\n/c /d 302\n'), [
    { source: '/a', destination: '/b', status: 301 },
    { source: '/c', destination: '/d', status: 302 },
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
