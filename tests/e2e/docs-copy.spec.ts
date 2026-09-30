import type { Browser, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { copyableText, SHELL_LANGUAGES } from '../../scripts/docs-code-copy';
import { useContent } from '../../src/i18n/ui';

// The quickstart page carries shell (bash, powershell) and non-shell (toml, plaintext, tsx) blocks.
const LOCALES = [
  { lang: 'pt', path: '/docs/quickstart/' },
  { lang: 'en', path: '/en/docs/quickstart/' },
] as const;

const SHELL_SELECTOR = [...SHELL_LANGUAGES]
  .map((lang) => `pre[data-language="${lang}"]`)
  .join(', ');
const BUTTON_SELECTOR = '.code-block > button[data-copy]';

type ClipboardWindow = Window & { __copied?: string[] };

/** Replaces the clipboard write with a spy (or a rejection) before any page script runs. */
async function stubClipboard(page: Page, mode: 'record' | 'reject'): Promise<void> {
  await page.addInitScript((stubMode) => {
    const win = window as ClipboardWindow;
    win.__copied = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          if (stubMode === 'reject') return Promise.reject(new Error('denied'));
          win.__copied?.push(text);
          return Promise.resolve();
        },
      },
    });
  }, mode);
}

/** Fails fast with a readable message when the page has no docs copy buttons. */
async function expectCopyButtons(page: Page, path: string): Promise<void> {
  await expect(
    page.locator(BUTTON_SELECTOR).first(),
    `expected docs copy buttons on ${path} > 0 | received: 0`
  ).toBeVisible({ timeout: 3000 });
}

/** Opens a page where scripts either never run or fail to load. */
async function openWithoutScripts(
  browser: Browser,
  baseURL: string | undefined,
  state: 'disabled' | 'blocked',
  path: string
): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: state === 'blocked' });
  const page = await context.newPage();
  if (state === 'blocked') await page.route('**/*.js', (route) => route.abort());
  await page.goto(path);
  return { page, close: () => context.close() };
}

for (const { lang, path } of LOCALES) {
  const content = useContent(lang);
  const label = content.docs.copyCode;

  test.describe(`docs code copy (${lang})`, () => {
    test('shell blocks get a copy button and other blocks do not', async ({ page }) => {
      await page.goto(path);

      const summary = await page.evaluate(
        ({ shell }) => {
          const blocks = [...document.querySelectorAll('.docs-markdown pre[data-language]')];
          const isShell = (pre: Element) => pre.matches(shell);
          return {
            shellBlocks: blocks.filter(isShell).length,
            otherBlocks: blocks.filter((pre) => !isShell(pre)).length,
            shellWithButton: blocks
              .filter(isShell)
              .filter((pre) => pre.parentElement?.querySelector(':scope > button[data-copy]'))
              .length,
            otherWithButton: blocks
              .filter((pre) => !isShell(pre))
              .filter((pre) => pre.parentElement?.querySelector(':scope > button[data-copy]'))
              .length,
            totalButtons: document.querySelectorAll('.docs-markdown button[data-copy]').length,
          };
        },
        { shell: SHELL_SELECTOR }
      );

      expect(
        summary.shellBlocks,
        `expected shell blocks on ${path} > 0 | received: ${summary.shellBlocks}`
      ).toBeGreaterThan(0);
      expect(
        summary.otherBlocks,
        `expected non-shell blocks on ${path} > 0 | received: ${summary.otherBlocks}`
      ).toBeGreaterThan(0);
      expect(
        summary.shellWithButton,
        `expected shell blocks with a copy button: ${summary.shellBlocks} | received: ${summary.shellWithButton}`
      ).toBe(summary.shellBlocks);
      expect(
        summary.otherWithButton,
        `expected non-shell blocks with a copy button: 0 | received: ${summary.otherWithButton}`
      ).toBe(0);
      expect(
        summary.totalButtons,
        `expected docs copy buttons: ${summary.shellBlocks} | received: ${summary.totalButtons}`
      ).toBe(summary.shellBlocks);
    });

    test('accessible name is localized', async ({ page }) => {
      await page.goto(path);

      const shellCount = await page.locator(SHELL_SELECTOR).count();
      const named = page.getByRole('button', { name: label, exact: true });
      await expect(
        named,
        `expected buttons named "${label}": ${shellCount} | received a different count`
      ).toHaveCount(shellCount);
    });

    test('copies exactly the snippet text', async ({ page }) => {
      await stubClipboard(page, 'record');
      await page.goto(path);
      await expectCopyButtons(page, path);

      const rendered = await page.evaluate((shell) => {
        return [...document.querySelectorAll(shell)].map(
          (pre) => pre.querySelector('code')?.textContent ?? ''
        );
      }, SHELL_SELECTOR);
      const expected = rendered.map(copyableText);
      expect(
        expected.length,
        `expected shell snippets > 0 | received: ${expected.length}`
      ).toBeGreaterThan(0);

      const buttons = page.locator(BUTTON_SELECTOR);
      for (const [index, snippet] of expected.entries()) {
        await buttons.nth(index).click();
        const copied = await page.evaluate(
          () => (window as ClipboardWindow).__copied?.at(-1) ?? null
        );
        expect(
          copied,
          `expected copied text for block ${index}: ${JSON.stringify(snippet)} | received: ${JSON.stringify(copied)}`
        ).toBe(snippet);
      }
    });

    test('writes the real clipboard and shows the success toast', async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.goto(path);
      await expectCopyButtons(page, path);

      const snippet = copyableText(
        await page
          .locator(SHELL_SELECTOR)
          .first()
          .evaluate((pre) => pre.querySelector('code')?.textContent ?? '')
      );
      await page.locator(BUTTON_SELECTOR).first().click();

      const toast = page.locator('#copy-toast');
      await expect(toast, `expected toast text: ${content.copyToast}`).toContainText(
        content.copyToast
      );
      const clipboard = await page.evaluate(() => navigator.clipboard.readText());
      expect(
        clipboard,
        `expected clipboard: ${JSON.stringify(snippet)} | received: ${JSON.stringify(clipboard)}`
      ).toBe(snippet);
    });

    test('shows the localized error toast when the clipboard rejects', async ({ page }) => {
      await stubClipboard(page, 'reject');
      await page.goto(path);
      await expectCopyButtons(page, path);

      await page.locator(BUTTON_SELECTOR).first().click();

      const toast = page.locator('#copy-toast');
      await expect(toast, `expected error toast text: ${content.copyToastError}`).toContainText(
        content.copyToastError
      );
      await expect(toast, 'expected toast to carry the is-error state').toHaveClass(/is-error/);
    });

    test('is keyboard operable after the code block', async ({ page }) => {
      await stubClipboard(page, 'record');
      await page.goto(path);
      await expectCopyButtons(page, path);

      const block = page.locator('.code-block').first();
      await block.locator('pre').focus();
      await page.keyboard.press('Tab');

      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tag: el?.tagName ?? null,
          name: el?.getAttribute('aria-labelledby') ?? null,
          inBlock: Boolean(el?.closest('.code-block')),
        };
      });
      expect(
        focused,
        `expected Tab from code block to reach its copy button | received: ${JSON.stringify(focused)}`
      ).toMatchObject({ tag: 'BUTTON', inBlock: true });

      await page.keyboard.press('Enter');
      const copied = await page.evaluate(() => (window as ClipboardWindow).__copied ?? []);
      expect(copied.length, `expected one copy after Enter | received: ${copied.length}`).toBe(1);
    });

    test('keeps code selectable and inside the viewport at 320px', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 720 });
      await page.goto(path);
      await expectCopyButtons(page, path);

      const metrics = await page.evaluate(() => {
        const pre = document.querySelector('.code-block > pre');
        const button = document.querySelector('.code-block > button');
        const preBox = pre?.getBoundingClientRect();
        const buttonBox = button?.getBoundingClientRect();
        return {
          userSelect: pre ? getComputedStyle(pre).userSelect : null,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          buttonInside: Boolean(
            preBox &&
              buttonBox &&
              buttonBox.right <= preBox.right + 0.5 &&
              buttonBox.left >= preBox.left - 0.5
          ),
        };
      });
      expect(
        metrics,
        `expected selectable code, no horizontal overflow, button inside block | received: ${JSON.stringify(metrics)}`
      ).toMatchObject({ userSelect: 'auto', overflow: 0, buttonInside: true });
    });

    for (const state of ['disabled', 'blocked'] as const) {
      test(`hides copy buttons and keeps code readable with scripts ${state}`, async ({
        browser,
        baseURL,
      }) => {
        const { page, close } = await openWithoutScripts(browser, baseURL, state, path);

        const visible = await page.locator('.docs-markdown button[data-copy]').evaluateAll(
          (els) =>
            els.filter((el) => {
              const box = el.getBoundingClientRect();
              const style = getComputedStyle(el);
              return (
                box.width > 0 &&
                box.height > 0 &&
                style.display !== 'none' &&
                style.visibility !== 'hidden'
              );
            }).length
        );
        const code = await page.locator(SHELL_SELECTOR).first().locator('code').innerText();
        await close();

        expect(
          visible,
          `expected visible copy buttons with scripts ${state}: 0 | received: ${visible}`
        ).toBe(0);
        expect(
          code.trim().length,
          `expected readable shell code with scripts ${state} | received: ${JSON.stringify(code)}`
        ).toBeGreaterThan(0);
      });
    }

    test('revealing buttons does not shift the layout', async ({ browser, baseURL, page }) => {
      const tops = (target: Page) =>
        target.evaluate(() =>
          [...document.querySelectorAll('.docs-markdown pre')].map((pre) => {
            const box = pre.getBoundingClientRect();
            return [Math.round(box.top + window.scrollY), Math.round(box.height)];
          })
        );

      await page.goto(path);
      await expectCopyButtons(page, path);
      const withScripts = await tops(page);

      const { page: plain, close } = await openWithoutScripts(browser, baseURL, 'blocked', path);
      const withoutScripts = await tops(plain);
      await close();

      expect(
        withScripts,
        `expected code block positions to match the no-script layout: ${JSON.stringify(withoutScripts)} | received: ${JSON.stringify(withScripts)}`
      ).toEqual(withoutScripts);
    });
  });
}
