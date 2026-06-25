import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict';

import {
  containsCanonicalOrigin,
  deriveDocIds,
  deriveRequiredDistFiles,
  extractRouteIntegrityHrefs,
  findNonCanonicalOrigins,
  redirectHtmlReferencesTarget,
  resolveInternalHrefToDistFile,
} from './smoke-dist';

run('deriveDocIds returns unique sorted doc ids from grouped content', () => {
  deepStrictEqual(
    deriveDocIds([
      { items: [{ id: 'quickstart' }, { id: 'cli' }] },
      { items: [{ id: 'quickstart' }, { id: 'providers' }] },
    ]),
    ['cli', 'providers', 'quickstart']
  );
});

run('deriveRequiredDistFiles derives locale routes from docs groups', () => {
  const required = deriveRequiredDistFiles({
    pt: {
      docs: {
        plannedBadge: 'Planejado',
        groups: [{ items: [{ id: 'quickstart' }, { id: 'cli' }] }],
      },
    },
    en: {
      docs: {
        plannedBadge: 'Planned',
        groups: [{ items: [{ id: 'quickstart' }, { id: 'install' }] }],
      },
    },
  });

  for (const expected of [
    'index.html',
    'en/index.html',
    'releases/index.html',
    'en/releases/index.html',
    'docs/quickstart/index.html',
    'docs/cli/index.html',
    'en/docs/quickstart/index.html',
    'en/docs/install/index.html',
    '404.html',
    'robots.txt',
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
  strictEqual(resolveInternalHrefToDistFile('/favicon.svg'), 'favicon.svg');
  strictEqual(resolveInternalHrefToDistFile('#features'), null);
  strictEqual(resolveInternalHrefToDistFile('https://github.com/juliopolycarpo/mangostudio'), null);
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
      <a class="docs-link" href="/docs/cli">CLI</a>
    </aside>
    <footer class="site-footer">
      <a href="/releases">Releases</a>
      <a href="https://github.com/juliopolycarpo/mangostudio">GitHub</a>
    </footer>
  `;

  deepStrictEqual(extractRouteIntegrityHrefs(html), [
    '/docs/cli',
    '/docs/quickstart',
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
