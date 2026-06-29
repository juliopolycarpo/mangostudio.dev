import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict';

import {
  containsCanonicalOrigin,
  deriveDocSlugs,
  deriveRequiredDistFiles,
  extractPrefetchHrefs,
  extractRouteIntegrityHrefs,
  findNonCanonicalOrigins,
  redirectHtmlReferencesTarget,
  resolveInternalHrefToDistFile,
  resolveInternalHrefToRoutePath,
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
    'robots.txt',
    'site.webmanifest',
    'sitemap-index.xml',
  ]) {
    ok(required.includes(expected), `${expected} should be required`);
  }
});

run('redirectHtmlReferencesTarget matches Astro redirect output form', () => {
  const html =
    '<!doctype html><title>Redirecting to: /docs/quickstart</title>' +
    '<meta http-equiv="refresh" content="0;url=/docs/quickstart">' +
    '<link rel="canonical" href="https://mangostudio.dev/docs/quickstart">' +
    '<body><a href="/docs/quickstart">Redirect</a></body>';

  strictEqual(redirectHtmlReferencesTarget(html, '/docs/quickstart'), true);
  strictEqual(redirectHtmlReferencesTarget(html, '/en/docs/quickstart'), false);
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

run('extractPrefetchHrefs returns only active Astro prefetch anchors', () => {
  const html = `
    <a href="/docs/quickstart" data-astro-prefetch>Quickstart</a>
    <a data-astro-prefetch="hover" href="/releases">Releases</a>
    <a href="https://github.com/juliopolycarpo/mangostudio" data-astro-prefetch="false">GitHub</a>
    <a href="/docs/reference/cli">CLI</a>
  `;

  deepStrictEqual(extractPrefetchHrefs(html), ['/docs/quickstart', '/releases']);
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

run('extractRouteIntegrityHrefs scopes links to cmdk, docs sidebar, and footer', () => {
  const html = `
    <header><a href="/not-checked">Header</a></header>
    <a class="cmdk-item" data-cmdk-item href="/docs/quickstart">Quickstart</a>
    <aside class="docs-sidebar">
      <a class="docs-link" href="/docs/reference/cli">CLI</a>
    </aside>
    <footer class="site-footer">
      <a href="/releases">Releases</a>
      <a href="https://github.com/juliopolycarpo/mangostudio">GitHub</a>
    </footer>
  `;

  deepStrictEqual(extractRouteIntegrityHrefs(html), [
    '/docs/quickstart',
    '/docs/reference/cli',
    '/releases',
    'https://github.com/juliopolycarpo/mangostudio',
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
