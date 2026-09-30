import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// The header button on the landing pages, plus the docs page that also carries the sidebar
// search button and the page list that sits under it.
const PAGES = [
  { name: 'pt home', path: '/' },
  { name: 'en home', path: '/en/' },
  { name: 'pt docs', path: '/docs/quickstart/' },
  { name: 'en docs', path: '/en/docs/quickstart/' },
] as const;

// Desktop widths where the header hint is part of the layout (it leaves the layout below
// 480px), plus a tablet and a phone width for the sidebar search button.
const WIDTHS = [390, 768, 1024, 1280] as const;

// The hint text the platform initializer settles on. Both must reserve the same box.
const PLATFORMS = [
  { name: 'Linux', platform: 'Linux x86_64', hint: 'Ctrl K' },
  { name: 'macOS', platform: 'MacIntel', hint: '⌘K' },
] as const;

const SEARCH = '.site-header .search-btn';
const HINT = `${SEARCH} [data-cmdk-hint]`;
const BOXES = '.site-header > *, .docs-search, .docs-nav';

interface HeaderBoxes {
  search: string;
  hint: string;
  children: string[];
}

async function measure(page: Page): Promise<HeaderBoxes> {
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(
    ([search, hint, children]) => {
      const fmt = (el: Element) => {
        const { x, y, width, height } = el.getBoundingClientRect();
        return `${x.toFixed(2)},${y.toFixed(2)},${width.toFixed(2)}x${height.toFixed(2)}`;
      };
      const searchEl = document.querySelector(search);
      const hintEl = document.querySelector(hint);
      if (!searchEl || !hintEl)
        throw new Error(
          `expected header search button and hint | received: ${search}=${searchEl}, ${hint}=${hintEl}`
        );
      return {
        search: fmt(searchEl),
        hint: fmt(hintEl),
        children: [...document.querySelectorAll(children)].map(
          (el) => `${el.className || el.tagName}@${fmt(el)}`
        ),
      };
    },
    [SEARCH, HINT, BOXES]
  );
}

test.describe('shortcut hint init keeps layout boxes stable', () => {
  test.skip(({ isMobile }) => isMobile, 'viewport is set explicitly per test');

  for (const target of PAGES) {
    for (const width of WIDTHS) {
      for (const { name, platform, hint } of PLATFORMS) {
        test(`${target.name} ${width}px ${name}: boxes are identical before and after init`, async ({
          page,
        }) => {
          await page.addInitScript((value) => {
            Object.defineProperty(Navigator.prototype, 'platform', { get: () => value });
            Object.defineProperty(Navigator.prototype, 'userAgentData', { get: () => undefined });
          }, platform);

          let release: () => void = () => {};
          const gate = new Promise<void>((resolve) => {
            release = resolve;
          });
          await page.route('**/*.js', async (route) => {
            await gate;
            await route.continue();
          });

          await page.setViewportSize({ width, height: 800 });
          await page.goto(target.path, { waitUntil: 'commit' });
          await page.locator('footer').waitFor({ state: 'attached' });
          await expect(
            page.locator(HINT),
            'expected static hint before init: Ctrl K / ⌘K'
          ).toHaveText('Ctrl K / ⌘K');
          const before = await measure(page);

          release();
          await expect(page.locator(HINT), `expected hint after init: ${hint}`).toHaveText(hint);
          await expect(
            page.locator('[data-enhance]'),
            'expected pending [data-enhance]: 0'
          ).toHaveCount(0);
          const after = await measure(page);

          const context = `${target.name} ${width}px ${name}`;
          expect(
            after.search,
            `${context}: expected search button box (x,y,w x h) identical across init | received before: ${before.search}, after: ${after.search}`
          ).toBe(before.search);
          expect(
            after.hint,
            `${context}: expected hint box identical across init | received before: ${before.hint}, after: ${after.hint}`
          ).toBe(before.hint);
          expect(
            after.children,
            `${context}: expected every header control, docs search button and page list box identical across init`
          ).toEqual(before.children);
        });
      }
    }
  }
});
