import { deepStrictEqual, strictEqual } from 'node:assert/strict';

import {
  copyableText,
  DOCS_COPY_LABEL_ID,
  docsCodeCopyTransformer,
  isShellLanguage,
} from './docs-code-copy';

await run('isShellLanguage accepts shell aliases case-insensitively and rejects others', () => {
  deepStrictEqual(
    ['bash', 'Bash', 'sh', 'shell', 'zsh', 'powershell', 'pwsh', 'ps1', 'console'].map(
      isShellLanguage
    ),
    Array(9).fill(true)
  );
  deepStrictEqual(
    ['toml', 'plaintext', 'text', 'typescript', 'json', '', undefined].map(isShellLanguage),
    Array(7).fill(false)
  );
});

await run('copyableText keeps the snippet verbatim minus the trailing newline', () => {
  strictEqual(
    copyableText('git clone <repo-url>\ncd mangostudio\n'),
    'git clone <repo-url>\ncd mangostudio'
  );
  strictEqual(copyableText('# comment\nbun install'), '# comment\nbun install');
});

await run('copyableText strips $ prompts and drops command output', () => {
  strictEqual(
    copyableText('$ bun install\nDone in 1s\n$ bun run dev\n'),
    'bun install\nbun run dev'
  );
});

await run('copyableText leaves a $ that is not a leading prompt untouched', () => {
  strictEqual(
    copyableText('echo "$HOME"\n$ not-a-prompt-transcript'),
    'echo "$HOME"\n$ not-a-prompt-transcript'
  );
});

await run('transformer wraps shell blocks with a gated, labelled copy button', () => {
  const pre = { type: 'element', tagName: 'pre', properties: {}, children: [] };
  const root = { type: 'root', children: [pre] };
  const transformer = docsCodeCopyTransformer();

  // biome-ignore lint/suspicious/noExplicitAny: minimal fake of Shiki's transformer `this`.
  (transformer.root as any).call({ options: { lang: 'bash' }, source: 'bun run dev\n' }, root);

  const wrapper = root.children[0] as unknown as {
    properties: { className: string[] };
    children: { tagName: string; properties: Record<string, unknown> }[];
  };
  deepStrictEqual(wrapper.properties.className, ['code-block']);
  deepStrictEqual(
    wrapper.children.map((child) => child.tagName),
    ['pre', 'button']
  );
  deepStrictEqual(wrapper.children[1]?.properties, {
    type: 'button',
    className: ['code-copy'],
    dataCopy: 'bun run dev',
    dataEnhance: 'copy',
    dataEnhanceReserve: '',
    ariaLabelledBy: DOCS_COPY_LABEL_ID,
  });
});

await run('transformer leaves non-shell blocks untouched', () => {
  const pre = { type: 'element', tagName: 'pre', properties: {}, children: [] };
  const root = { type: 'root', children: [pre] };
  const transformer = docsCodeCopyTransformer();

  // biome-ignore lint/suspicious/noExplicitAny: minimal fake of Shiki's transformer `this`.
  (transformer.root as any).call({ options: { lang: 'toml' }, source: 'a = 1' }, root);

  deepStrictEqual(root.children, [pre]);
});

async function run(name: string, test: () => void | Promise<void>): Promise<void> {
  try {
    await test();
    process.stdout.write(`[ok] ${name}\n`);
  } catch (error) {
    process.stderr.write(`[fail] ${name}\n`);
    throw error;
  }
}
