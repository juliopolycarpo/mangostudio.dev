import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { en } from '../../src/i18n/en';
import { pt } from '../../src/i18n/pt';
import type { SiteContent } from '../../src/i18n/types';

const LOCALES: { name: string; path: string; content: SiteContent }[] = [
  { name: 'pt', path: '/', content: pt },
  { name: 'en', path: '/en/', content: en },
];
// 390 is the phone width where the search button shows only the icon; 1024 is the tablet layout.
const WIDTHS = [390, 1024] as const;
// Labels that used to ship on every page regardless of locale.
const ENGLISH_ONLY_LABELS = ['Primary', 'Language', 'Command menu'];
const SHORTCUT = /Ctrl K|⌘K/;

async function activeElementSummary(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return 'none';
    const text = (el.textContent ?? '').trim().slice(0, 40);
    return `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}> "${text}"`;
  });
}

for (const locale of LOCALES) {
  test.describe(`${locale.name} skip link`, () => {
    test('is the first tab stop, shows on focus and moves focus to main', async ({ page }) => {
      await page.goto(locale.path);
      const skip = page.getByRole('link', { name: locale.content.skipLink });
      await expect(
        skip,
        `expected skip link "${locale.content.skipLink}" in the page | received: none`
      ).toHaveAttribute('href', '#main');

      await page.keyboard.press('Tab');
      const first = await activeElementSummary(page);
      expect(first, `expected first focused element: skip link | received: ${first}`).toContain(
        locale.content.skipLink
      );
      await expect(
        skip,
        'expected skip link: visible in viewport on focus | received: off-screen'
      ).toBeInViewport({
        ratio: 1,
      });

      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/#main$/);
      const afterActivate = await activeElementSummary(page);
      expect(
        afterActivate.startsWith('<main'),
        `expected focus after activation: <main#main> | received: ${afterActivate}`
      ).toBe(true);

      await page.keyboard.press('Tab');
      const inMain = await page.evaluate(
        () => document.querySelector('main')?.contains(document.activeElement) ?? false
      );
      expect(
        inMain,
        `expected next Tab to land inside main | received: ${await activeElementSummary(page)}`
      ).toBe(true);
    });

    test('is hidden until it has focus', async ({ page }) => {
      await page.goto(locale.path);
      const skip = page.getByRole('link', { name: locale.content.skipLink });
      await expect(
        skip,
        `expected skip link "${locale.content.skipLink}" | received: none`
      ).toHaveCount(1);
      await expect(
        skip,
        'expected skip link: outside the viewport before focus | received: in viewport'
      ).not.toBeInViewport();
    });
  });

  for (const width of WIDTHS) {
    test.describe(`${locale.name} accessible names at ${width}px`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(locale.path);
      });

      test('search button names the action and the shortcut', async ({ page }) => {
        const search = page.getByRole('button', {
          name: new RegExp(`^${locale.content.header.searchLabel} .*(${SHORTCUT.source})`),
        });
        await expect(
          search,
          `expected one button named "${locale.content.header.searchLabel} <shortcut>" | received: ${(
            await page.locator('.site-header .search-btn').ariaSnapshot()
          ).trim()}`
        ).toHaveCount(1);
      });

      test('palette, theme, language and copy controls use localized names', async ({ page }) => {
        const c = locale.content;
        await expect(page.getByRole('button', { name: c.header.theme })).toHaveCount(1);
        await expect(page.getByRole('group', { name: c.langToggle.label }).first()).toBeVisible();
        await expect(page.getByRole('button', { name: c.copyButtonLabel }).first()).toBeVisible();

        await page.getByRole('button', { name: new RegExp(`^${c.header.searchLabel}`) }).click();
        await expect(page.getByRole('dialog', { name: c.cmdk.label })).toBeVisible();
        await expect(page.getByRole('combobox', { name: c.cmdk.placeholder })).toBeVisible();
      });

      test('ships no English-only labels', async ({ page }) => {
        test.skip(locale.name !== 'pt', 'English labels are expected on /en/');
        const labels = await page.$$eval('[aria-label]', (els) =>
          els.map((el) => el.getAttribute('aria-label') ?? '')
        );
        const leaked = labels.filter((label) => ENGLISH_ONLY_LABELS.includes(label));
        expect(
          leaked,
          `expected no English labels on pt | received: ${JSON.stringify(leaked)}`
        ).toEqual([]);
      });
    });
  }

  for (const width of [390, 1024, 1280] as const) {
    test(`${locale.name} GitHub link names the destination and keeps its visible text at ${width}px`, async ({
      page,
    }) => {
      const c = locale.content;
      await page.setViewportSize({ width, height: 800 });
      await page.goto(locale.path);
      const link = page.locator('.site-header .gh-link');
      await expect(
        page.getByRole('link', { name: c.header.github, exact: true }).first(),
        `expected link named "${c.header.github}" | received: ${(await link.ariaSnapshot()).trim()}`
      ).toHaveAttribute('href', /github\.com/);
      // WCAG 2.5.3: when the visible label shows, the accessible name must contain it.
      const label = page.locator('.site-header .gh-label');
      const name = (await link.getAttribute('aria-label')) ?? '';
      const visibleText = (await label.isVisible()) ? ((await label.textContent()) ?? '') : '';
      expect(
        name.includes(visibleText),
        `expected name containing visible text "${visibleText}" | received: "${name}"`
      ).toBe(true);
      expect(
        width === 1280 ? visibleText : c.header.star,
        `expected visible label "${c.header.star}" at ${width}px | received: "${visibleText}"`
      ).toBe(c.header.star);
    });
  }

  test(`${locale.name} primary navigation uses the localized landmark name`, async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto(locale.path);
    await expect(page.getByRole('navigation', { name: locale.content.nav.label })).toHaveCount(1);
  });
}
