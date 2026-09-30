import { deepStrictEqual, ok, strictEqual, throws } from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  assertUniqueDescriptions,
  collectDocDefinitions,
  DESCRIPTION_MAX_LENGTH,
  extractDescription,
  renderManifest,
  rewriteMarkdownLinks,
  sanitizeMarkdown,
  syncDocs,
} from './sync-docs';
import { applyHostedInstallers, assertHostedInstallers } from './sync-docs-installers';

const UPSTREAM_SH =
  'https://github.com/juliopolycarpo/mangostudio/releases/latest/download/install.sh';

const UPSTREAM_QUICKSTART = {
  en: [
    '# MangoStudio',
    '',
    '| Channel | Command |',
    '| --- | --- |',
    '| npm / bun | `npm i -g mangostudio` |',
    '| Homebrew (macOS/Linux) | `brew install juliopolycarpo/tap/mangostudio` |',
    `| Shell installer | \`curl -fsSL ${UPSTREAM_SH} \\| bash\` |`,
    '',
    '```bash',
    `curl -fsSL ${UPSTREAM_SH} | bash`,
    '```',
    '',
    'On Windows, download and run `install.ps1` from the',
    '[latest release](https://github.com/juliopolycarpo/mangostudio/releases/latest),',
    'or use Scoop (see table above).',
    '',
  ].join('\n'),
  pt: [
    '# MangoStudio',
    '',
    '| Canal | Comando |',
    '| --- | --- |',
    '| Homebrew (macOS/Linux) | `brew install juliopolycarpo/tap/mangostudio` |',
    `| Instalador shell | \`curl -fsSL ${UPSTREAM_SH} \\| bash\` |`,
    '',
    '```bash',
    `curl -fsSL ${UPSTREAM_SH} | bash`,
    '```',
    '',
    'No Windows, baixe e execute `install.ps1` na',
    '[release mais recente](https://github.com/juliopolycarpo/mangostudio/releases/latest),',
    'ou use Scoop (veja a tabela acima).',
    '',
  ].join('\n'),
};

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

await run('extractDescription returns the first prose paragraph as plain text', () => {
  strictEqual(
    extractDescription(
      '# CLI\n\nRun **mangostudio** from a [shell](/docs/) with `bun` and _care_.\n\n## Next\n\nLater text.\n',
      'CLI'
    ),
    'Run mangostudio from a shell with bun and care.'
  );
});

await run('extractDescription skips badge rows, quotes, and leading code', () => {
  const markdown = [
    '# MangoStudio',
    '',
    '[CI](https://example.com/ci)',
    '[Release](https://example.com/release)',
    '',
    '![logo](./logo.png)',
    '',
    '> Read in English',
    '',
    '```bash',
    'curl -fsSL https://example.com | bash',
    '',
    'echo not prose',
    '```',
    '',
    '| a | b |',
    '| - | - |',
    '',
    '- item',
    '',
    'The studio for local AI chat and images.',
    '',
  ].join('\n');

  strictEqual(
    extractDescription(markdown, 'MangoStudio'),
    'The studio for local AI chat and images.'
  );
});

await run('extractDescription finds prose that follows a heading when the intro is missing', () => {
  strictEqual(
    extractDescription('# Policy\n\n## Reporting\n\nReport issues privately.\n', 'Policy'),
    'Report issues privately.'
  );
});

await run('extractDescription keeps a paragraph that introduced a code block readable', () => {
  strictEqual(
    extractDescription(
      '# Guide\n\nImplement the interface in `types.ts`:\n\n```ts\nx\n```\n',
      'Guide'
    ),
    'Implement the interface in types.ts.'
  );
});

await run('extractDescription joins a wrapped paragraph and stops at the next block', () => {
  strictEqual(
    extractDescription('# T\n\nFirst line\nsecond line.\n- list item\n\nOther.\n', 'T'),
    'First line second line.'
  );
});

await run('extractDescription truncates long paragraphs on a word boundary', () => {
  const words = Array.from({ length: 60 }, (_, index) => `word${index}`).join(' ');
  const description = extractDescription(`# T\n\n${words}\n`, 'T');

  ok(
    description.length <= DESCRIPTION_MAX_LENGTH,
    `expected at most ${DESCRIPTION_MAX_LENGTH} chars | received ${description.length}: ${description}`
  );
  ok(description.endsWith('…'), `expected a trailing ellipsis | received: ${description}`);
  ok(
    words.startsWith(description.slice(0, -1)) && words[description.length - 1] === ' ',
    `expected the cut to fall on a word boundary | received: ${description}`
  );
});

await run('extractDescription falls back to the plain title when the doc has no prose', () => {
  strictEqual(
    extractDescription('# Tools\n\n```ts\nx\n```\n\n| a |\n| - |\n', 'Tools `v2`'),
    'Tools v2'
  );
});

await run('assertUniqueDescriptions names the duplicate value and both docs', () => {
  const item = (slug: string, description: string) => ({
    slug,
    title: slug,
    sidebarLabel: slug,
    description,
    sourcePath: `${slug}.md`,
    sourceUrl: `https://example.com/${slug}.md`,
    groupId: 'guides' as const,
    groupTitle: 'Guides',
    order: 10,
  });
  const docs = (items: ReturnType<typeof item>[]) => ({
    pt: [],
    en: [{ id: 'guides' as const, title: 'Guides', items }],
  });

  assertUniqueDescriptions(docs([item('a', 'One.'), item('b', 'Two.')]));
  throws(
    () => assertUniqueDescriptions(docs([item('a', 'Same.'), item('b', 'Same.')])),
    /invalid: "Same\." shared by en\/a and en\/b/
  );
});

const REPO_BLOB = 'https://github.com/juliopolycarpo/mangostudio/blob/abc123';

function rewriteFrom(sourcePath: string, markdown: string): string {
  return rewriteMarkdownLinks(markdown, {
    lang: 'en',
    sourcePath,
    sourceCommit: 'abc123',
    sourcePathMap: new Map(),
  });
}

await run('rewriteMarkdownLinks resolves repository-relative files against the source path', () => {
  const cases: Array<[string, string, string]> = [
    ['README.md', '[MIT](LICENSE)', `[MIT](${REPO_BLOB}/LICENSE)`],
    ['README.md', '[MIT](./LICENSE)', `[MIT](${REPO_BLOB}/LICENSE)`],
    ['docs/pt-br/README.md', '[MIT](../../LICENSE)', `[MIT](${REPO_BLOB}/LICENSE)`],
    [
      'docs/reference/cli.md',
      '[config](../../apps/api/src/lib/config.ts)',
      `[config](${REPO_BLOB}/apps/api/src/lib/config.ts)`,
    ],
    ['docs/reference/cli.md', '[dir](../../apps/api/)', `[dir](${REPO_BLOB}/apps/api/)`],
    [
      '.github/CONTRIBUTING.md',
      '<a href="../scripts/install/install.sh">installer</a>',
      `<a href="${REPO_BLOB}/scripts/install/install.sh">installer</a>`,
    ],
  ];

  for (const [sourcePath, input, expected] of cases) {
    strictEqual(
      rewriteFrom(sourcePath, input),
      expected,
      `expected ${input} from ${sourcePath} to resolve to ${expected}`
    );
  }
});

await run('rewriteMarkdownLinks keeps fragments and queries on resolved files', () => {
  strictEqual(
    rewriteFrom('docs/reference/cli.md', '[line](../../apps/api/src/lib/config.ts#L10-L20)'),
    `[line](${REPO_BLOB}/apps/api/src/lib/config.ts#L10-L20)`
  );
  strictEqual(
    rewriteFrom('README.md', '[raw](LICENSE?plain=1#L2)'),
    `[raw](${REPO_BLOB}/LICENSE?plain=1#L2)`
  );
});

await run('rewriteMarkdownLinks leaves anchors, site URLs, and external URLs untouched', () => {
  const untouched = [
    '[a](#install)',
    '[b](/docs/quickstart)',
    '[c](/en/docs/reference/cli#commands)',
    '[d](/install.sh)',
    '[e](https://mangostudio.dev/install.sh)',
    '[f](mailto:hello@mangostudio.dev)',
    '[g](//cdn.example.com/x)',
    '<a href="/en/docs/quickstart">h</a>',
  ];

  for (const input of untouched) {
    strictEqual(
      rewriteFrom('docs/reference/cli.md', input),
      input,
      `expected ${input} to stay unchanged`
    );
  }
});

await run('rewriteMarkdownLinks rejects relative links that escape the repository', () => {
  let message = '';

  try {
    rewriteFrom('docs/reference/cli.md', '[out](../../../secrets.txt)');
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }

  ok(
    message.includes('../../../secrets.txt') && message.includes('docs/reference/cli.md'),
    `expected error naming the invalid link and its source | received: ${JSON.stringify(message)}`
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
      '[CLI](/en/docs/reference/cli/#commands)',
      '[Português](/docs/quickstart/)',
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
    ok(englishCli.includes('[Quickstart](/en/docs/quickstart/)'));
    ok(
      englishCli.includes('description: "CLI Reference"'),
      `expected the link-only CLI doc to fall back to its title | received: ${englishCli.slice(0, 200)}`
    );
    ok(
      manifest.includes('"description": "CLI Reference"'),
      'expected the manifest to carry each doc description'
    );

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

for (const lang of ['en', 'pt'] as const) {
  await run(`applyHostedInstallers serves hosted installers in the ${lang} quickstart`, () => {
    const output = applyHostedInstallers(UPSTREAM_QUICKSTART[lang], lang);

    ok(
      !output.includes('releases/latest/download/install'),
      `expected no release-asset installer URL | received: ${output}`
    );
    ok(
      output.includes('curl -fsSL https://mangostudio.dev/install.sh | bash'),
      `expected hosted install.sh command | received: ${output}`
    );
    ok(
      output.includes('irm https://mangostudio.dev/install.ps1 \\| iex'),
      `expected PowerShell table row | received: ${output}`
    );
    ok(
      output.includes('```powershell\nirm https://mangostudio.dev/install.ps1 | iex\n```'),
      `expected PowerShell code block | received: ${output}`
    );
    ok(
      output.indexOf('PowerShell (Windows)') < output.indexOf('Homebrew (macOS/Linux)'),
      `expected PowerShell row before Homebrew | received: ${output}`
    );
    ok(
      !output.includes('install.ps1` '),
      `expected upstream Windows paragraph replaced | received: ${output}`
    );
  });
}

await run('applyHostedInstallers is idempotent and ignores unrelated docs', () => {
  const hosted = applyHostedInstallers(UPSTREAM_QUICKSTART.en, 'en');

  strictEqual(applyHostedInstallers(hosted, 'en'), hosted);
  strictEqual(
    applyHostedInstallers('# CLI\n\nRun `mangostudio serve`.\n', 'en'),
    '# CLI\n\nRun `mangostudio serve`.\n'
  );
});

await run('assertHostedInstallers names the missing commands and source path', () => {
  assertHostedInstallers(applyHostedInstallers(UPSTREAM_QUICKSTART.en, 'en'), 'README.md');

  let message = '';

  try {
    assertHostedInstallers('# MangoStudio\n', 'README.md');
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }

  ok(
    message.includes('README.md') && message.includes('install.ps1'),
    `expected error naming README.md and install.ps1 | received: ${JSON.stringify(message)}`
  );
});

await run('assertHostedInstallers rejects a leftover upstream Windows paragraph', () => {
  const drifted = UPSTREAM_QUICKSTART.en.replace(
    'On Windows, download and run `install.ps1` from the',
    'On Windows, grab `install.ps1` from the'
  );
  let message = '';

  try {
    assertHostedInstallers(applyHostedInstallers(drifted, 'en'), 'README.md');
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }

  ok(
    message.includes('README.md') && message.includes('```powershell'),
    `expected error naming README.md and the missing powershell block | received: ${JSON.stringify(message)}`
  );
  ok(
    message.includes('`install.ps1`'),
    `expected error naming the leftover upstream text | received: ${JSON.stringify(message)}`
  );
});

await run('syncDocs reproduces hosted installers from upstream release-asset text', async () => {
  const sourceDir = await createSourceFixture();
  const repoRoot = await mkdtemp(join(tmpdir(), 'mango-site-'));

  try {
    await syncDocs({ sourceDir, repoRoot, sourceCommit: 'abc123' });

    for (const lang of ['en', 'pt']) {
      const quickstart = await readFile(
        join(repoRoot, `src/content/docs/${lang}/quickstart.md`),
        'utf8'
      );

      ok(
        quickstart.includes('irm https://mangostudio.dev/install.ps1 | iex') &&
          !quickstart.includes('releases/latest/download/install'),
        `expected hosted installers in ${lang} quickstart | received: ${quickstart}`
      );
    }
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
                description: 'Estúdio de IA local.',
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
                description: 'Local AI studio.',
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
    'README.md': `${UPSTREAM_QUICKSTART.en}\nSee [CLI](docs/reference/cli.md).\n`,
    '.github/CONTRIBUTING.md': '# Contributing\n',
    '.github/SECURITY.md': '# Security Policy\n',
    'docs/README.md': '# Documentation\n',
    'docs/guides/contributor-quickstart.md': '# Contributor Quickstart\n',
    'docs/features/tools.md': '# Tools\n',
    'docs/reference/cli.md': '# CLI Reference\n\n[Quickstart](../../README.md)\n',
    'docs/pt-br/README.md': `${UPSTREAM_QUICKSTART.pt}\nVeja [CLI](reference/cli.md).\n`,
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
