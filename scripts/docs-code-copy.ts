import type { ShikiConfig } from 'astro';

type ShikiTransformer = NonNullable<ShikiConfig['transformers']>[number];

/** DOM id of the visually hidden, localized label that names every docs copy button. */
export const DOCS_COPY_LABEL_ID = 'docs-copy-label';

/** Fenced-code languages that hold commands a reader can paste into a terminal. */
export const SHELL_LANGUAGES: ReadonlySet<string> = new Set([
  'bash',
  'sh',
  'shell',
  'zsh',
  'powershell',
  'pwsh',
  'ps1',
  'console',
]);

const PROMPT_PATTERN = /^\$ /;

/**
 * True when a fenced-code language is a shell language.
 *
 * @example isShellLanguage('Bash'); // true
 */
export function isShellLanguage(lang: string | undefined): boolean {
  return lang !== undefined && SHELL_LANGUAGES.has(lang.toLowerCase());
}

/**
 * Text a copy button puts on the clipboard for a shell snippet.
 *
 * The snippet is copied verbatim minus its trailing newline. When it is a transcript that
 * starts with a `$ ` prompt, only the prompted command lines are kept (prompt stripped) so
 * command output is never pasted back into a terminal.
 *
 * @example copyableText('$ bun install\nDone.\n'); // 'bun install'
 */
export function copyableText(source: string): string {
  const text = source.replace(/\r?\n$/, '');
  const lines = text.split('\n');
  const firstLine = lines.find((line) => line.trim() !== '');
  if (firstLine === undefined || !PROMPT_PATTERN.test(firstLine)) return text;

  return lines
    .filter((line) => PROMPT_PATTERN.test(line))
    .map((line) => line.replace(PROMPT_PATTERN, ''))
    .join('\n');
}

// Same geometry as the `copy` glyph in src/components/Icon.astro; duplicated because a
// Shiki transformer emits hast, not Astro components.
function copyIcon() {
  return {
    type: 'element' as const,
    tagName: 'svg',
    properties: {
      width: 14,
      height: 14,
      viewBox: '0 0 24 24',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      ariaHidden: 'true',
    },
    children: [
      {
        type: 'element' as const,
        tagName: 'rect',
        properties: { x: 9, y: 9, width: 11, height: 11, rx: 2 },
        children: [],
      },
      {
        type: 'element' as const,
        tagName: 'path',
        properties: { d: 'M5 15V5a2 2 0 0 1 2-2h10' },
        children: [],
      },
    ],
  };
}

/**
 * Shiki transformer that wraps shell code blocks in `.code-block` and appends a copy button.
 *
 * The button reuses the site-wide `[data-copy]` click handler and the `data-enhance`
 * gate (hidden without JavaScript, space reserved with it, see `src/scripts/enhance.ts`).
 * The transformer cannot see the page locale, so the button is named through
 * `aria-labelledby` pointing at {@link DOCS_COPY_LABEL_ID}, which `DocsPage.astro` renders
 * from `SiteContent`.
 *
 * @example
 * markdown: { shikiConfig: { transformers: [docsCodeCopyTransformer()] } }
 */
export function docsCodeCopyTransformer(): ShikiTransformer {
  return {
    name: 'docs-code-copy',
    root(root) {
      if (!isShellLanguage(this.options.lang)) return;

      const button = {
        type: 'element' as const,
        tagName: 'button',
        properties: {
          type: 'button',
          className: ['code-copy'],
          dataCopy: copyableText(this.source),
          dataEnhance: 'copy',
          dataEnhanceReserve: '',
          ariaLabelledBy: DOCS_COPY_LABEL_ID,
        },
        children: [copyIcon()],
      };

      root.children = [
        {
          type: 'element',
          tagName: 'div',
          properties: { className: ['code-block'] },
          children: [...root.children.filter((node) => node.type !== 'doctype'), button],
        },
      ];
    },
  };
}
