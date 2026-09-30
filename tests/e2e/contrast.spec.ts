import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const MIN_TEXT_CONTRAST = 4.5;
const LOCALES = [
  { name: 'pt', prefix: '' },
  { name: 'en', prefix: '/en' },
] as const;
const THEMES = ['dark', 'light'] as const;

type Rgb = readonly [number, number, number];

interface CodeSpan {
  text: string;
  color: string;
  background: string;
}

// Parses "rgb(r, g, b)" / "rgba(r, g, b, a)" computed colors; throws with the offending value.
function parseRgb(value: string): Rgb {
  const match = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (!match) throw new Error(`expected color shape: rgb(r, g, b) | received: ${value}`);
  if (match[4] !== undefined && Number(match[4]) < 1) {
    throw new Error(`expected opaque color | received: ${value}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function luminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrastRatio(foreground: string, background: string): number {
  const [light, dark] = [luminance(parseRgb(foreground)), luminance(parseRgb(background))].sort(
    (a, b) => b - a
  ) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

async function setTheme(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
  await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme);
}

// Every syntax token span inside a highlighted block, with its computed color and the
// computed background of the block that contains it.
async function readCodeSpans(page: Page): Promise<CodeSpan[]> {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>('.docs-markdown pre code span:not(:has(span))')
    ).flatMap((span) => {
      const text = span.textContent?.trim() ?? '';
      const pre = span.closest('pre');
      if (!text || !pre) return [];
      return [
        {
          text,
          color: getComputedStyle(span).color,
          background: getComputedStyle(pre).backgroundColor,
        },
      ];
    })
  );
}

const COMMENT_TEXT = /^(#|\/\/|\/\*)/;

async function docsPaths(page: Page, prefix: string): Promise<string[]> {
  await page.goto(`${prefix}/docs/quickstart`);
  const hrefs = await page
    .locator('.docs-sidebar a[href*="/docs/"]')
    .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).pathname));
  return Array.from(new Set([`${prefix}/docs/quickstart`, ...hrefs]));
}

test.describe('docs code comment contrast', () => {
  for (const locale of LOCALES) {
    for (const theme of THEMES) {
      test(`${locale.name} ${theme}: code tokens reach ${MIN_TEXT_CONTRAST}:1 on the block`, async ({
        page,
      }) => {
        const paths = await docsPaths(page, locale.prefix);
        let commentSpans = 0;
        const failures: string[] = [];

        for (const path of paths) {
          await page.goto(path);
          await setTheme(page, theme);
          for (const span of await readCodeSpans(page)) {
            const ratio = contrastRatio(span.color, span.background);
            if (COMMENT_TEXT.test(span.text)) commentSpans += 1;
            if (ratio >= MIN_TEXT_CONTRAST) continue;
            failures.push(
              `${path} "${span.text.slice(0, 30)}" expected contrast >= ${MIN_TEXT_CONTRAST} | received: ${ratio.toFixed(2)} (${span.color} on ${span.background})`
            );
          }
        }

        expect(
          commentSpans,
          `expected comment tokens in ${locale.name} docs | received: ${commentSpans}`
        ).toBeGreaterThan(0);
        expect(
          failures,
          `${failures.length} low-contrast code tokens:\n${failures.slice(0, 5).join('\n')}`
        ).toEqual([]);
      });
    }
  }
});
