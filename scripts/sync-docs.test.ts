import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  collectDocDefinitions,
  renderManifest,
  rewriteMarkdownLinks,
  sanitizeMarkdown,
  syncDocs,
} from './sync-docs';

await run('sanitizeMarkdown removes externally loaded images while preserving badge links', () => {
  strictEqual(
    sanitizeMarkdown(`<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/banner.png" />
</div>

[![CI](https://github.com/badge.svg)](https://github.com/actions)
![Remote](//cdn.example.com/remote.png)
# Title
`),
    `[CI](https://github.com/actions)
Remote
# Title
`
  );
});

await run('rewriteMarkdownLinks routes synced docs locally and repo files to GitHub blobs', () => {
  const sourcePathMap = new Map([
    ['README.md', { lang: 'en' as const, slug: 'quickstart' }],
    ['docs/pt-br/README.md', { lang: 'pt' as const, slug: 'quickstart' }],
    ['docs/reference/cli.md', { lang: 'en' as const, slug: 'reference/cli' }],
    ['docs/pt-br/reference/cli.md', { lang: 'pt' as const, slug: 'reference/cli' }],
  ]);

  strictEqual(
    rewriteMarkdownLinks(
      [
        '[CLI](./cli.md#commands)',
        '[Português](../pt-br/README.md)',
        '[Package](../../packages/cli/README.md)',
      ].join('\n'),
      {
        lang: 'en',
        sourcePath: 'docs/reference/testing.md',
        sourceCommit: 'abc123',
        sourcePathMap,
      }
    ),
    [
      '[CLI](/en/docs/reference/cli#commands)',
      '[Português](/docs/quickstart)',
      '[Package](https://github.com/juliopolycarpo/mangostudio/blob/abc123/packages/cli/README.md)',
    ].join('\n')
  );
});

await run(
  'collectDocDefinitions includes special root and .github docs with mirrored docs',
  async () => {
    const sourceDir = await createSourceFixture();

    try {
      const definitions = await collectDocDefinitions(sourceDir);

      deepStrictEqual(
        definitions.map((definition) => definition.slug),
        [
          'quickstart',
          'guides/contributing',
          'guides/contributor-quickstart',
          'features/tools',
          'reference/cli',
          'operations/security',
        ]
      );
    } finally {
      await rm(sourceDir, { force: true, recursive: true });
    }
  }
);

await run('syncDocs writes localized content and a deterministic manifest', async () => {
  const sourceDir = await createSourceFixture();
  const repoRoot = await mkdtemp(join(tmpdir(), 'mango-site-'));

  try {
    await syncDocs({ sourceDir, repoRoot, sourceCommit: 'abc123' });

    const manifest = await readFile(join(repoRoot, 'src/data/docs.generated.ts'), 'utf8');
    const englishCli = await readFile(
      join(repoRoot, 'src/content/docs/en/reference/cli.md'),
      'utf8'
    );

    ok(manifest.includes('DOCS_NAV'));
    ok(manifest.includes('"sourcePath": "docs/reference/cli.md"'));
    ok(englishCli.includes('sourceCommit: "abc123"'));
    ok(englishCli.includes('[Quickstart](/en/docs/quickstart)'));

    await syncDocs({ sourceDir, repoRoot, sourceCommit: 'abc123', check: true });

    await writeFile(join(repoRoot, 'src/content/docs/en/reference/cli.md'), 'drift', 'utf8');

    await syncDocs({ sourceDir, repoRoot, sourceCommit: 'abc123', check: true })
      .then(() => {
        throw new Error('Expected sync check to fail.');
      })
      .catch((error) => {
        ok(error instanceof Error);
        ok(error.message.includes('src/content/docs/en/reference/cli.md is out of sync.'));
      });
  } finally {
    await rm(sourceDir, { force: true, recursive: true });
    await rm(repoRoot, { force: true, recursive: true });
  }
});

await run('renderManifest includes source commit and per-locale slug lookup', () => {
  strictEqual(
    renderManifest({
      sourceCommit: 'abc123',
      docs: {
        pt: [
          {
            id: 'getting-started',
            title: 'Começando',
            items: [
              {
                slug: 'quickstart',
                title: 'MangoStudio',
                sidebarLabel: 'Início rápido',
                sourcePath: 'docs/pt-br/README.md',
                sourceUrl:
                  'https://github.com/juliopolycarpo/mangostudio/blob/abc123/docs/pt-br/README.md',
                groupId: 'getting-started',
                groupTitle: 'Começando',
                order: 10,
              },
            ],
          },
        ],
        en: [
          {
            id: 'getting-started',
            title: 'Getting Started',
            items: [
              {
                slug: 'quickstart',
                title: 'MangoStudio',
                sidebarLabel: 'Quickstart',
                sourcePath: 'README.md',
                sourceUrl: 'https://github.com/juliopolycarpo/mangostudio/blob/abc123/README.md',
                groupId: 'getting-started',
                groupTitle: 'Getting Started',
                order: 10,
              },
            ],
          },
        ],
      },
    }).includes('commit: "abc123"'),
    true
  );
});

async function createSourceFixture(): Promise<string> {
  const sourceDir = await mkdtemp(join(tmpdir(), 'mangostudio-source-'));
  const files = {
    'README.md': '# MangoStudio\n\nSee [CLI](docs/reference/cli.md).\n',
    '.github/CONTRIBUTING.md': '# Contributing\n',
    '.github/SECURITY.md': '# Security Policy\n',
    'docs/README.md': '# Documentation\n',
    'docs/guides/contributor-quickstart.md': '# Contributor Quickstart\n',
    'docs/features/tools.md': '# Tools\n',
    'docs/reference/cli.md': '# CLI Reference\n\n[Quickstart](../../README.md)\n',
    'docs/pt-br/README.md': '# MangoStudio\n\nVeja [CLI](reference/cli.md).\n',
    'docs/pt-br/CONTRIBUTING.md': '# Contribuindo com o MangoStudio\n',
    'docs/pt-br/guides/contributor-quickstart.md': '# Onboarding De Contribuidor\n',
    'docs/pt-br/features/tools.md': '# Ferramentas\n',
    'docs/pt-br/reference/cli.md': '# Referência da CLI\n',
    'docs/pt-br/operations/security.md': '# Política De Segurança\n',
  };

  for (const [path, content] of Object.entries(files)) {
    const filePath = join(sourceDir, path);
    await writeFileWithDir(filePath, content);
  }

  return sourceDir;
}

async function writeFileWithDir(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}

async function run(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    process.stdout.write(`[ok] ${name}\n`);
  } catch (error) {
    process.stderr.write(`[fail] ${name}\n`);
    throw error;
  }
}
