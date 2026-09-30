import { deepStrictEqual } from 'node:assert/strict';

import {
  extractCrawlHrefs,
  extractFragmentTargets,
  findBrokenLinks,
  formatBrokenLink,
  parseRedirects,
  resolveServedPath,
} from './link-crawl';

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
