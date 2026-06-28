import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict';
import {
  extractDataCopyTargets,
  extractInlineStyleBlocks,
  extractLoadedExternalUrls,
  extractRemoteCssUrls,
  findTodoHtmlFiles,
  findUnversionedAppImageReferences,
  isPlaceholderInstallScript,
  isShellInstallerAdvertised,
  parseHeadersFile,
  stripJsonComments,
  validateApexRoute,
  validateCacheHeaders,
  validateInstallChannels,
  validateReleaseSource,
  validateTruthfulSiteMetrics,
} from './audit-static-site';

run('stripJsonComments preserves strings while removing comments', () => {
  const jsonc = `{
    // comment
    "url": "https://example.com//not-a-comment",
    /* block */
    "enabled": true
  }`;

  deepStrictEqual(JSON.parse(stripJsonComments(jsonc)), {
    url: 'https://example.com//not-a-comment',
    enabled: true,
  });
});

run('extractLoadedExternalUrls reports only externally loaded assets', () => {
  const html = `
    <a href="https://github.com/juliopolycarpo/mangostudio">GitHub</a>
    <script type="module" src="/_astro/index.js"></script>
    <link rel="canonical" href="https://mangostudio.dev/docs">
    <link rel="stylesheet" href="https://cdn.example.com/site.css">
    <img src="//cdn.example.com/logo.png" alt="">
  `;

  deepStrictEqual(extractLoadedExternalUrls(html), [
    '//cdn.example.com/logo.png',
    'https://cdn.example.com/site.css',
  ]);
});

run('extractLoadedExternalUrls reports remote srcset candidates', () => {
  const html = `
    <img src="/_astro/logo.png" srcset="/_astro/logo-1x.png 1x, https://cdn.example.com/logo-2x.png 2x">
    <source srcset="//cdn.example.com/wide.avif 1280w" type="image/avif">
    <link rel="preload" as="image" imagesrcset="https://cdn.example.com/hero.webp 2x">
  `;

  deepStrictEqual(extractLoadedExternalUrls(html), [
    '//cdn.example.com/wide.avif',
    'https://cdn.example.com/hero.webp',
    'https://cdn.example.com/logo-2x.png',
  ]);
});

run('extractRemoteCssUrls reports remote CSS url() assets', () => {
  deepStrictEqual(
    extractRemoteCssUrls(`
      .local { background: url("/local.svg"); }
      .remote { background: url("https://cdn.example.com/asset.svg"); }
      .proto { background: url(//cdn.example.com/proto.svg); }
    `),
    ['//cdn.example.com/proto.svg', 'https://cdn.example.com/asset.svg']
  );
});

run('extractRemoteCssUrls reports remote @import statements', () => {
  deepStrictEqual(
    extractRemoteCssUrls(`
      @import "https://cdn.example.com/import.css";
      @import url(//cdn.example.com/proto.css);
      @import "./local.css";
    `),
    ['//cdn.example.com/proto.css', 'https://cdn.example.com/import.css']
  );
});

run('extractInlineStyleBlocks surfaces remote assets in inlined CSS', () => {
  const html = `
    <style>.hero { background: url(https://cdn.example.com/hero.png); }</style>
    <style>.local { background: url(/_astro/logo.svg); }</style>
  `;

  const remote = extractInlineStyleBlocks(html).flatMap(extractRemoteCssUrls);

  deepStrictEqual(remote, ['https://cdn.example.com/hero.png']);
});

run('isPlaceholderInstallScript detects installer placeholder markers', () => {
  strictEqual(
    isPlaceholderInstallScript(`#!/usr/bin/env bash
# PLACEHOLDER
set -euo pipefail
echo "This performs no installation"
`),
    true
  );

  strictEqual(
    isPlaceholderInstallScript(`#!/usr/bin/env bash
set -euo pipefail
echo "Installing MangoStudio"
`),
    false
  );
});

run('isShellInstallerAdvertised reports built pages that mention the shell endpoint', () => {
  strictEqual(
    isShellInstallerAdvertised([
      { relativePath: 'dist/index.html', text: 'curl https://mangostudio.dev/install.sh' },
    ]),
    true
  );

  strictEqual(
    isShellInstallerAdvertised([{ relativePath: 'dist/index.html', text: 'bun add -g cli' }]),
    false
  );
});

run('findTodoHtmlFiles reports TODO placeholder copy in built pages', () => {
  deepStrictEqual(
    findTodoHtmlFiles([
      { relativePath: 'dist/index.html', text: '<main>TODO replace before publish</main>' },
      { relativePath: 'dist/docs/index.html', text: '<main>Planned page</main>' },
    ]),
    ['dist/index.html']
  );
});

run('extractDataCopyTargets decodes data-copy command attributes', () => {
  deepStrictEqual(
    extractDataCopyTargets(
      '<button data-copy="gh release download --pattern &quot;*.tar.gz&quot; &amp;&amp; sha256sum -c SHA256SUMS">Copy</button>'
    ),
    ['gh release download --pattern "*.tar.gz" && sha256sum -c SHA256SUMS']
  );
});

run('extractDataCopyTargets leaves out-of-range numeric entities intact', () => {
  deepStrictEqual(extractDataCopyTargets('<button data-copy="&#x110000;">Copy</button>'), [
    '&#x110000;',
  ]);
});

run('validateInstallChannels accepts ready npm/bun primary channels', () => {
  deepStrictEqual(
    validateInstallChannels({
      installTabs: [
        { id: 'bun', cmd: 'bun add -g @mangostudio/cli@canary', status: 'ready' },
        { id: 'shell', cmd: 'shell installer planned', status: 'planned' },
      ],
      channels: [
        { id: 'bun', cmd: 'bun add -g @mangostudio/cli@canary', status: 'ready' },
        { id: 'shell', cmd: 'shell installer planned', status: 'planned' },
      ],
      copyTargets: ['bun add -g @mangostudio/cli@canary'],
    }),
    []
  );
});

run('validateTruthfulSiteMetrics rejects hardcoded star counts', () => {
  deepStrictEqual(validateTruthfulSiteMetrics({}), []);
  deepStrictEqual(validateTruthfulSiteMetrics({ STARS: '' }), []);
  deepStrictEqual(validateTruthfulSiteMetrics({ STARS: '1.2k' }), [
    'src/data/site.ts must not export a hardcoded STARS metric.',
  ]);
  deepStrictEqual(validateTruthfulSiteMetrics({ STARS: 1200 }), [
    'src/data/site.ts must not export a hardcoded STARS metric.',
  ]);
});

run('validateInstallChannels rejects planned copy targets and missing ready primaries', () => {
  deepStrictEqual(
    validateInstallChannels({
      installTabs: [{ id: 'shell', cmd: 'shell installer planned', status: 'planned' }],
      channels: [
        { id: 'brew', cmd: 'brew install juliopolycarpo/tap/mangostudio', status: 'planned' },
      ],
      copyTargets: ['brew install juliopolycarpo/tap/mangostudio'],
    }),
    [
      'CHANNELS[0] is planned, but its command is exposed as a copy target.',
      'At least one install channel must be ready.',
      'INSTALL_TABS[0] must be the ready npm/bun install command.',
      'CHANNELS[0] must be the ready npm/bun install command.',
    ]
  );
});

run('validateReleaseSource accepts generated facts and curated highlights copy', () => {
  deepStrictEqual(
    validateReleaseSource({
      release: {
        version: 'v0.1.0',
        releaseDate: '2026-06-24',
        installCmd: 'bun add -g @mangostudio/cli',
      },
      localizedReleases: [
        {
          locale: 'en',
          releases: {
            intro:
              'Version and install command are synced from the release pipeline. Highlights are curated per release.',
          },
        },
      ],
    }),
    []
  );
});

run(
  'validateReleaseSource rejects empty generated facts and stale generated-highlights claims',
  () => {
    const errors = validateReleaseSource({
      release: { version: '', releaseDate: '', installCmd: '' },
      localizedReleases: [
        {
          locale: 'pt',
          releases: {
            intro: 'TODO: destaques gerados automaticamente a cada merge via git-cliff.',
          },
        },
      ],
    });

    ok(errors.includes('RELEASE.version must be non-empty.'));
    ok(errors.includes('RELEASE.releaseDate must be non-empty.'));
    ok(errors.includes('RELEASE.installCmd must be non-empty.'));
    ok(errors.includes('pt release copy must not contain TODO placeholder text.'));
    ok(errors.some((error) => error.includes('pt release copy still claims git-cliff')));
    ok(errors.some((error) => error.includes('pt release copy still claims generated highlights')));
  }
);

run('validateApexRoute accepts the apex custom-domain route', () => {
  deepStrictEqual(validateApexRoute([{ pattern: 'mangostudio.dev', custom_domain: true }]), []);
});

run('validateApexRoute rejects a missing routes array', () => {
  deepStrictEqual(validateApexRoute(undefined), [
    'wrangler.jsonc must declare a routes array binding the apex custom domain.',
  ]);
});

run('validateApexRoute rejects more than one route', () => {
  deepStrictEqual(
    validateApexRoute([
      { pattern: 'mangostudio.dev', custom_domain: true },
      { pattern: 'mangostudio.dev/api/*', custom_domain: true },
    ]),
    ['wrangler.jsonc must declare exactly one route (the apex custom domain); found 2.']
  );
});

run('validateApexRoute rejects a www.mangostudio.dev route', () => {
  deepStrictEqual(validateApexRoute([{ pattern: 'www.mangostudio.dev', custom_domain: true }]), [
    'wrangler.jsonc route must not bind www.mangostudio.dev; the www -> apex redirect is external Cloudflare DNS/Redirect Rule config.',
  ]);
});

run('validateApexRoute rejects a non-apex pattern', () => {
  deepStrictEqual(validateApexRoute([{ pattern: 'example.com', custom_domain: true }]), [
    'wrangler.jsonc route pattern must be mangostudio.dev.',
  ]);
});

run('validateApexRoute requires custom_domain: true', () => {
  deepStrictEqual(validateApexRoute([{ pattern: 'mangostudio.dev', custom_domain: false }]), [
    'wrangler.jsonc route must set custom_domain: true for the apex domain.',
  ]);
  deepStrictEqual(validateApexRoute([{ pattern: 'mangostudio.dev' }]), [
    'wrangler.jsonc route must set custom_domain: true for the apex domain.',
  ]);
});

run('parseHeadersFile reads Cloudflare _headers path rules', () => {
  const rules = parseHeadersFile(`/_astro/*
  Cache-Control: public, max-age=31556952, immutable

/install.sh
  Cache-Control: public, max-age=300, must-revalidate
`);

  deepStrictEqual(rules.get('/_astro/*'), {
    'cache-control': 'public, max-age=31556952, immutable',
  });
  deepStrictEqual(rules.get('/install.sh'), {
    'cache-control': 'public, max-age=300, must-revalidate',
  });
});

run('validateCacheHeaders accepts the required static asset cache rules', () => {
  deepStrictEqual(
    validateCacheHeaders(`/_astro/*
  Cache-Control: public, max-age=31556952, immutable

/favicon.ico
  Cache-Control: public, max-age=86400, must-revalidate

/site.webmanifest
  Cache-Control: public, max-age=3600, must-revalidate

/install.sh
  Cache-Control: public, max-age=300, must-revalidate
`),
    []
  );
});

run('validateCacheHeaders rejects missing or weakened cache rules', () => {
  const errors = validateCacheHeaders(`/_astro/*
  Cache-Control: public, max-age=0, must-revalidate

/install.sh
  Cache-Control: public, max-age=31556952, immutable
`);

  ok(errors.some((error) => error.includes('/_astro/*')));
  ok(errors.some((error) => error.includes('/favicon.ico')));
  ok(errors.some((error) => error.includes('/install.sh')));
});

run('validateCacheHeaders rejects immutable on short-lived stable assets', () => {
  const errors = validateCacheHeaders(`/_astro/*
  Cache-Control: public, max-age=31556952, immutable

/favicon.ico
  Cache-Control: public, max-age=31556952, immutable

/site.webmanifest
  Cache-Control: public, max-age=3600, must-revalidate

/install.sh
  Cache-Control: public, max-age=300, must-revalidate, immutable
`);

  deepStrictEqual(errors, [
    'dist/_headers /favicon.ico must not be marked immutable.',
    'dist/_headers /install.sh must not be marked immutable.',
  ]);
});

run('findUnversionedAppImageReferences rejects stable app icon paths', () => {
  deepStrictEqual(
    findUnversionedAppImageReferences({
      relativePath: 'dist/site.webmanifest',
      text: '{"icons":[{"src":"/icon-192.png"},{"src":"/_astro/icon-512.abc123.png"}]}',
    }),
    [
      'dist/site.webmanifest references /icon-192.png; app icons must use src/assets imports so Astro emits hashed URLs.',
    ]
  );
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
