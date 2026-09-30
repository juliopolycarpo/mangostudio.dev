import type { Browser, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const LOCALES = [
  { name: 'pt', path: '/' },
  { name: 'en', path: '/en/' },
] as const;

// Every install command that must be readable as plain text without JavaScript.
const INSTALL_COMMANDS = [
  'irm https://mangostudio.dev/install.ps1 | iex',
  'curl -fsSL https://mangostudio.dev/install.sh | bash',
  'npm i -g mangostudio',
  'scoop bucket add juliopolycarpo https://github.com/juliopolycarpo/scoop-bucket && scoop install mangostudio',
  'brew install juliopolycarpo/tap/mangostudio',
  'cargo install mangostudio',
  'docker run -p 3001:3001 -v mango-data:/data ghcr.io/juliopolycarpo/mangostudio',
];

type JsState = 'disabled' | 'blocked';

/** Opens a page where scripts either never run or fail to load. */
async function openWithoutScripts(
  browser: Browser,
  baseURL: string | undefined,
  state: JsState,
  path: string
): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: state === 'blocked',
  });
  const page = await context.newPage();
  if (state === 'blocked') {
    await page.route('**/*.js', (route) => route.abort());
  }
  await page.goto(path);
  return { page, close: () => context.close() };
}

async function visibleButtonLabels(page: Page): Promise<string[]> {
  return page.locator('button').evaluateAll((buttons) =>
    buttons
      .filter((button) => {
        const box = button.getBoundingClientRect();
        const style = getComputedStyle(button);
        return (
          box.width > 0 &&
          box.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        );
      })
      .map(
        (button) =>
          button.getAttribute('aria-label') ||
          button.textContent?.trim() ||
          button.id ||
          button.className
      )
  );
}

for (const state of ['disabled', 'blocked'] as const) {
  for (const locale of LOCALES) {
    test.describe(`scripts ${state}, ${locale.name}`, () => {
      test('shows no dead buttons', async ({ browser, baseURL }) => {
        const { page, close } = await openWithoutScripts(browser, baseURL, state, locale.path);
        const labels = await visibleButtonLabels(page);
        await close();

        expect(
          labels,
          `expected visible buttons: 0 | received: ${labels.length} (${labels.join(', ')})`
        ).toEqual([]);
      });

      test('renders every install command as readable text', async ({ browser, baseURL }) => {
        const { page, close } = await openWithoutScripts(browser, baseURL, state, locale.path);
        const text = await page.locator('.install').innerText();
        await close();

        const missing = INSTALL_COMMANDS.filter((cmd) => !text.includes(cmd));
        expect(
          missing,
          `expected install commands readable: ${INSTALL_COMMANDS.length} | missing: ${missing.join(' ; ')}`
        ).toEqual([]);
        // The bun command comes from the release data, so assert its shape.
        expect(text, 'expected a readable bun install command | received none').toMatch(
          /bun (add|install) -g mangostudio/
        );
      });

      test('keeps terminal lines visible', async ({ browser, baseURL }) => {
        const { page, close } = await openWithoutScripts(browser, baseURL, state, locale.path);
        const opacities = await page
          .locator('.term-line')
          .evaluateAll((lines) => lines.map((line) => getComputedStyle(line).opacity));
        const hasJsFlag = await page.evaluate(() =>
          document.documentElement.classList.contains('js')
        );
        await close();

        expect(opacities.length, 'expected .term-line count: 4').toBe(4);
        expect(
          opacities,
          `expected term-line opacity: 1 x4 | received: ${opacities.join(', ')} (html.js: ${hasJsFlag})`
        ).toEqual(['1', '1', '1', '1']);
      });
    });
  }
}

test.describe('scripts enabled', () => {
  for (const locale of LOCALES) {
    test(`hides the static fallback and keeps the tabs, ${locale.name}`, async ({ page }) => {
      await page.goto(locale.path);

      await expect(page.locator('#install-platform-tabs')).toBeVisible();
      await expect(page.locator('#install-tabs')).toBeVisible();
      await expect(page.locator('#hero-copy')).toBeVisible();
      await expect(
        page.locator('[data-enhance]'),
        'expected pending [data-enhance]: 0'
      ).toHaveCount(0);
      await expect(
        page.locator('.install-static'),
        'expected static install list hidden once enhanced'
      ).toBeHidden();
    });

    test(`animates terminal lines in, ${locale.name}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.goto(locale.path);

      await expect(page.locator('#terminal-demo')).toHaveAttribute('data-terminal', 'ready');
      await expect(page.locator('.term-line.is-visible')).toHaveCount(4, { timeout: 8000 });
      // The fade-in runs for 0.3s after each line gains .is-visible.
      await expect
        .poll(
          () =>
            page
              .locator('.term-line')
              .evaluateAll((lines) => lines.map((line) => getComputedStyle(line).opacity)),
          { message: 'expected settled term-line opacity: 1 x4', timeout: 3000 }
        )
        .toEqual(['1', '1', '1', '1']);
    });
  }
});

test.describe('docs page controls', () => {
  test('reveals search and theme controls once scripts run', async ({ page }) => {
    await page.goto('/docs/reference/cli');

    await expect(
      page.locator('.docs-search'),
      'expected docs search visible after init'
    ).toBeVisible();
    await expect(page.locator('[data-theme-toggle]').first()).toBeVisible();
    await expect(page.locator('[data-enhance]'), 'expected pending [data-enhance]: 0').toHaveCount(
      0
    );
  });

  for (const state of ['disabled', 'blocked'] as const) {
    test(`shows no dead buttons with scripts ${state}`, async ({ browser, baseURL }) => {
      const { page, close } = await openWithoutScripts(
        browser,
        baseURL,
        state,
        '/docs/reference/cli'
      );
      const labels = await visibleButtonLabels(page);
      await close();

      expect(
        labels,
        `expected visible buttons: 0 | received: ${labels.length} (${labels.join(', ')})`
      ).toEqual([]);
    });
  }
});
