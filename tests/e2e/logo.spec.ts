import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const HEADER_LOGO = '.site-header .brand-logo';
const FOOTER_LOGO = '.site-footer .footer-brand img';
const LOCALES = [
  { name: 'pt', path: '/' },
  { name: 'en', path: '/en/' },
] as const;
const DPRS = [1, 2] as const;
const THEMES = ['light', 'dark'] as const;
// Logo files emitted by the build: 28 px, 56 px (header/footer 1x/2x), 40 px (demo), 192 px (hero).
const MAX_LOGO_VARIANTS = 4;

interface LogoMeasure {
  currentSrc: string;
  naturalWidth: number;
  renderedWidth: number;
}

async function measureLogo(page: Page, selector: string): Promise<LogoMeasure> {
  const logo = page.locator(selector).first();
  await logo.scrollIntoViewIfNeeded();
  await expect
    .poll(
      () =>
        logo.evaluate(
          (el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0
        ),
      {
        message: `expected ${selector} to finish loading | received: still loading`,
      }
    )
    .toBe(true);

  // With a density descriptor, img.naturalWidth is the file width divided by the density, so
  // decode currentSrc on a bare Image to read the real pixel width.
  return logo.evaluate(async (el) => {
    const img = el as HTMLImageElement;
    const file = new Image();
    file.src = img.currentSrc;
    await file.decode();
    return {
      currentSrc: img.currentSrc,
      naturalWidth: file.naturalWidth,
      renderedWidth: img.getBoundingClientRect().width,
    };
  });
}

for (const dpr of DPRS) {
  test.describe(`logo sharpness at DPR ${dpr}`, () => {
    test.use({ deviceScaleFactor: dpr });

    for (const locale of LOCALES) {
      for (const theme of THEMES) {
        test(`${locale.name} ${theme}: header and footer logos have enough pixels`, async ({
          page,
        }) => {
          await page.emulateMedia({ colorScheme: theme });
          await page.goto(locale.path);

          for (const [label, selector] of [
            ['header', HEADER_LOGO],
            ['footer', FOOTER_LOGO],
          ] as const) {
            const m = await measureLogo(page, selector);
            const needed = m.renderedWidth * dpr;
            expect(
              m.naturalWidth,
              `${label} logo natural width must cover rendered width x DPR | expected: >= ${needed}px (${m.renderedWidth}px x ${dpr}) | received: ${m.naturalWidth}px from ${m.currentSrc}`
            ).toBeGreaterThanOrEqual(needed);
          }
        });
      }
    }
  });
}

test.describe('logo markup and emitted files', () => {
  test('header and footer share one 1x/2x candidate set', async ({ page }) => {
    await page.goto('/');
    const header = await page.locator(HEADER_LOGO).getAttribute('srcset');
    const footer = await page.locator(FOOTER_LOGO).getAttribute('srcset');

    expect(header, 'header logo srcset | expected: "<url> 1x, <url> 2x" | received: none').toMatch(
      /^\S+ 1x, \S+ 2x$/
    );
    expect(
      footer,
      `footer logo srcset | expected: identical to header (${header}) | received: ${footer}`
    ).toBe(header);
  });

  test('build emits a bounded number of distinct logo variants', () => {
    const assetsDir = join(process.cwd(), 'dist', '_astro');
    const variants = readdirSync(assetsDir).filter((file) => /^icon-192\..+\.webp$/.test(file));

    expect(
      variants.length,
      `distinct icon-192 webp variants in dist/_astro | expected: <= ${MAX_LOGO_VARIANTS} | received: ${variants.length} (${variants.join(', ')})`
    ).toBeLessThanOrEqual(MAX_LOGO_VARIANTS);
  });
});
