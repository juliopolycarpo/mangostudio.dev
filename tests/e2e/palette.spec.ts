import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const LOCALES = [
  { name: 'pt', path: '/', pageLabel: 'Ir para página' },
  { name: 'en', path: '/en/', pageLabel: 'Go to page' },
] as const;

const NONSENSE_QUERY = 'zzzqqq';

async function openPalette(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.locator('#cmdk'), 'expected palette: open | received: closed').toBeVisible();
  await expect(page.locator('[data-cmdk-input]')).toBeFocused();
}

async function visibleItemCount(items: Locator): Promise<number> {
  return items.evaluateAll(
    (nodes) =>
      nodes.filter((node) => {
        const box = node.getBoundingClientRect();
        return getComputedStyle(node).display !== 'none' && box.width > 0 && box.height > 0;
      }).length
  );
}

async function focusedDescription(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return 'none';
    const label = el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 40) ?? '';
    return `<${el.tagName.toLowerCase()} class="${el.className}"> ${label}`;
  });
}

for (const locale of LOCALES) {
  test.describe(`command palette (${locale.name})`, () => {
    test('shows no items and the empty state for a nonsense query', async ({ page }) => {
      await openPalette(page, locale.path);
      await page.locator('[data-cmdk-input]').fill(NONSENSE_QUERY);

      const visible = await visibleItemCount(page.locator('.cmdk-item'));
      expect(visible, `expected visible items: 0 | received: ${visible}`).toBe(0);
      await expect(page.locator('[data-cmdk-empty]')).toBeVisible();
      await expect(page.locator('[data-cmdk-query]')).toHaveText(NONSENSE_QUERY);
    });

    test('Tab never lands on an unmatched item', async ({ page }) => {
      await openPalette(page, locale.path);
      await page.locator('[data-cmdk-input]').fill(NONSENSE_QUERY);
      await page.keyboard.press('Tab');

      const focused = await focusedDescription(page);
      expect(
        focused.includes('cmdk-item'),
        `expected focus: outside .cmdk-item | received: ${focused}`
      ).toBe(false);
    });

    test('Tab from a narrowed list reaches the matching item first', async ({ page }) => {
      await openPalette(page, locale.path);
      await page.locator('[data-cmdk-input]').fill('github');
      await page.keyboard.press('Tab');

      const focused = await focusedDescription(page);
      expect(
        focused.toLowerCase().includes('github'),
        `expected focus: GitHub item | received: ${focused}`
      ).toBe(true);
    });

    test('Enter with no matches does nothing', async ({ page }) => {
      await openPalette(page, locale.path);
      const before = page.url();
      await page.locator('[data-cmdk-input]').fill(NONSENSE_QUERY);
      await page.keyboard.press('Enter');

      expect(page.url(), `expected url: ${before} | received: ${page.url()}`).toBe(before);
      await expect(page.locator('#cmdk')).toBeVisible();
    });

    test('Arrow keys and Enter act only on matching items', async ({ page }) => {
      await openPalette(page, locale.path);
      const input = page.locator('[data-cmdk-input]');
      await input.fill('releases');

      const total = await page.locator('.cmdk-item').count();
      const visible = await visibleItemCount(page.locator('.cmdk-item'));
      expect(
        visible > 0 && visible < total,
        `expected visible items: 1..${total - 1} | received: ${visible}`
      ).toBe(true);

      const activeIds = new Set<string | null>();
      for (let i = 0; i < visible + 1; i += 1) {
        await page.keyboard.press('ArrowDown');
        const id = await input.getAttribute('aria-activedescendant');
        const hidden = await page.locator(`#${id}`).evaluate((el) => (el as HTMLElement).hidden);
        expect(hidden, `expected active option: visible | received: hidden #${id}`).toBe(false);
        activeIds.add(id);
      }
      expect(
        activeIds.size,
        `expected distinct active options: ${visible} | received: ${activeIds.size}`
      ).toBe(visible);

      await input.fill('releases');
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/releases/);
    });

    test('is labelled as page navigation', async ({ page }) => {
      await page.goto(locale.path);
      const label = await page.locator('#cmdk').getAttribute('aria-label');
      const placeholder = await page.locator('[data-cmdk-input]').getAttribute('placeholder');
      expect(
        `${label} ${placeholder}`.toLowerCase().includes(locale.pageLabel.toLowerCase()),
        `expected label containing: ${locale.pageLabel} | received: aria-label=${label} placeholder=${placeholder}`
      ).toBe(true);
    });
  });
}

test.describe('shortcut hint', () => {
  const HINTS = '[data-cmdk-hint]';

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    for (const locale of LOCALES) {
      test(`states both shortcuts (${locale.name})`, async ({ page }) => {
        await page.goto(locale.path);
        await expect(page.locator(HINTS).first(), 'expected static hint: Ctrl K / ⌘K').toHaveText(
          'Ctrl K / ⌘K'
        );
      });
    }
  });

  for (const [platform, expected] of [
    ['MacIntel', '⌘K'],
    ['Win32', 'Ctrl K'],
    ['Linux x86_64', 'Ctrl K'],
  ] as const) {
    test(`matches the platform (${platform})`, async ({ page }) => {
      await page.addInitScript((value) => {
        Object.defineProperty(Navigator.prototype, 'platform', { get: () => value });
        Object.defineProperty(Navigator.prototype, 'userAgentData', { get: () => undefined });
      }, platform);
      await page.goto('/');
      await expect(
        page.locator(HINTS).first(),
        `expected hint on ${platform}: ${expected}`
      ).toHaveText(expected);
    });
  }

  // Chromium exposes userAgentData.platform, which the initializer prefers over the legacy
  // navigator.platform. The legacy value contradicts it here to prove UA-CH wins.
  for (const [uaPlatform, legacyPlatform, expected] of [
    ['macOS', 'Win32', '⌘K'],
    ['Windows', 'MacIntel', 'Ctrl K'],
  ] as const) {
    test(`prefers userAgentData over navigator.platform (${uaPlatform})`, async ({ page }) => {
      await page.addInitScript(
        ([ua, legacy]) => {
          Object.defineProperty(Navigator.prototype, 'platform', { get: () => legacy });
          Object.defineProperty(Navigator.prototype, 'userAgentData', {
            get: () => ({ platform: ua }),
          });
        },
        [uaPlatform, legacyPlatform]
      );
      await page.goto('/');
      await expect(
        page.locator(HINTS).first(),
        `expected hint for userAgentData.platform=${uaPlatform}: ${expected}`
      ).toHaveText(expected);
    });
  }

  test('docs sidebar hint follows the same rule', async ({ page }) => {
    await page.goto('/docs/quickstart');
    const count = await page.locator(HINTS).count();
    expect(
      count,
      `expected hints on a docs page: >= 2 | received: ${count}`
    ).toBeGreaterThanOrEqual(2);
  });
});
