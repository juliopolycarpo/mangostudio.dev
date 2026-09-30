import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const MIN_TEXT_CONTRAST = 4.5;
const MIN_TARGET_PX = 24;
const LOCALES = [
  { name: 'pt', prefix: '' },
  { name: 'en', prefix: '/en' },
] as const;
const THEMES = ['dark', 'light'] as const;
const BADGE_WIDTHS = [320, 390, 768, 1024] as const;

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

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

// True when the two boxes share area; boxes that wrap onto separate lines do not overlap.
function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function describeBox(box: Box): string {
  return `[x=${box.x.toFixed(1)} y=${box.y.toFixed(1)} ${box.width.toFixed(1)}x${box.height.toFixed(1)}]`;
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

test.describe('docs code token contrast', () => {
  for (const locale of LOCALES) {
    for (const theme of THEMES) {
      test(`${locale.name} ${theme}: code tokens reach ${MIN_TEXT_CONTRAST}:1 on the block`, async ({
        page,
      }) => {
        const paths = await docsPaths(page, locale.prefix);
        let commentSpans = 0; // sanity check that comment tokens exist; every token is asserted
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

test.describe('quickstart badge links', () => {
  for (const locale of LOCALES) {
    for (const width of BADGE_WIDTHS) {
      test(`${locale.name} @${width}px: CI and Release badges are at least ${MIN_TARGET_PX}px targets`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(`${locale.prefix}/docs/quickstart`);
        const badges = page.locator('.docs-markdown a[href*="/actions/workflows/"]');
        const count = await badges.count();
        expect(count, `expected 2 badge links | received: ${count}`).toBe(2);

        const boxes = [];
        for (let index = 0; index < count; index += 1) {
          const box = await badges.nth(index).boundingBox();
          if (!box) throw new Error(`expected badge ${index} to have a box | received: null`);
          boxes.push(box);
          expect(
            Math.min(box.width, box.height),
            `badge ${index} expected size >= ${MIN_TARGET_PX}px | received: ${box.width.toFixed(1)}x${box.height.toFixed(1)}`
          ).toBeGreaterThanOrEqual(MIN_TARGET_PX);
        }

        const [first, second] = boxes as [(typeof boxes)[number], (typeof boxes)[number]];
        expect(
          boxesOverlap(first, second),
          `expected CI and Release badge boxes not to intersect | received: ${describeBox(first)} and ${describeBox(second)}`
        ).toBe(false);
      });
    }
  }

  test('other inline docs links keep their natural inline size', async ({ page }) => {
    await page.goto('/docs/quickstart');
    const link = page.locator('.docs-markdown p a:not([href*="/actions/workflows/"])').first();
    const box = await link.boundingBox();
    if (!box) throw new Error('expected a non-badge inline link | received: none');
    const display = await link.evaluate((el) => getComputedStyle(el).display);
    expect(display, `expected non-badge inline link display: inline | received: ${display}`).toBe(
      'inline'
    );
  });
});
