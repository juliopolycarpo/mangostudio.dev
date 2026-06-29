import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const HERO_TITLE = '.hero-title';

// These run on both the desktop and mobile projects defined in playwright.config.ts.
test.describe('home page', () => {
  test('renders the hero without uncaught page errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');

    await expect(page.locator(HERO_TITLE)).toBeVisible();
    await expect(page.locator(HERO_TITLE)).not.toBeEmpty();
    expect(errors, `unexpected page errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('serves the English locale at /en/ with hero parity', async ({ page }) => {
    await page.goto('/en/');

    await expect(page.locator(HERO_TITLE)).toBeVisible();
    await expect(page.locator(HERO_TITLE)).not.toBeEmpty();
  });

  test('command palette opens by button and shortcut, closes on Escape', async ({ page }) => {
    await page.goto('/');
    const dialog = page.locator('#cmdk');
    const input = page.locator('[data-cmdk-input]');

    // Button trigger focuses the search input.
    await page.locator('[data-cmdk-open]').first().click();
    await expect(dialog).toBeVisible();
    await expect(input).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // Keyboard shortcut toggles the same dialog.
    await page.keyboard.press('ControlOrMeta+k');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('install widget filters methods by selected platform', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('tab', { name: 'Windows' }).click();
    await expect(page.locator('#hero-cmd')).toHaveText(
      'irm https://mangostudio.dev/install.ps1 | iex'
    );
    await expect(page.locator('#hero-copy')).toHaveAttribute(
      'data-copy',
      'irm https://mangostudio.dev/install.ps1 | iex'
    );
    await expect(page.locator('#install-tab-powershell')).toBeVisible();
    await expect(page.locator('#install-tab-curl')).toBeHidden();
    await expect(visibleInstallMethodLabels(page)).resolves.toEqual([
      'powershell',
      'bun',
      'npm',
      'scoop',
      'cargo',
    ]);

    await page.getByRole('tab', { name: 'Linux' }).click();
    await expect(page.locator('#hero-cmd')).toHaveText(
      'curl -fsSL https://mangostudio.dev/install.sh | bash'
    );
    await expect(page.locator('#install-tab-brew')).toBeVisible();
    await expect(page.locator('#install-tab-docker')).toBeHidden();
    await expect(visibleInstallMethodLabels(page)).resolves.toEqual([
      'shell',
      'bun',
      'npm',
      'brew',
      'cargo',
    ]);

    await page.getByRole('tab', { name: 'Docker' }).click();
    await expect(page.locator('#hero-cmd')).toHaveText(
      'docker run -p 3001:3001 -v mango-data:/data ghcr.io/juliopolycarpo/mangostudio'
    );
    await expect(page.locator('#install-tab-docker')).toBeVisible();
    await expect(page.locator('#install-tab-bun')).toBeHidden();
    await expect(visibleInstallMethodLabels(page)).resolves.toEqual(['docker']);
  });
});

function visibleInstallMethodLabels(page: Page) {
  return page
    .locator('#install-tabs [role="tab"]:visible')
    .evaluateAll((tabs) => tabs.map((tab) => tab.textContent?.trim() ?? ''));
}

test.describe('docs pages', () => {
  test('renders synced nested docs content', async ({ page }) => {
    await page.goto('/docs/reference/cli');

    await expect(page.getByRole('heading', { name: 'Referência da CLI' })).toBeVisible();
    await expect(page.locator('.docs-sidebar a[href="/docs/reference/cli"]')).toHaveAttribute(
      'aria-current',
      'page'
    );
    await expect(page.locator('.docs-markdown')).toContainText('mangostudio serve');
    await expect(page.locator('.docs-source')).toHaveAttribute(
      'href',
      /^https:\/\/github\.com\/juliopolycarpo\/mangostudio\/blob\//
    );
  });

  test('serves English synced docs at localized routes', async ({ page }) => {
    await page.goto('/en/docs/operations/security');

    await expect(page.getByRole('heading', { name: 'Security Policy' })).toBeVisible();
    await expect(
      page.locator('.docs-sidebar a[href="/en/docs/operations/security"]')
    ).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('constrained viewport guardrails', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(!isMobile, 'phone-profile layout assertions');
  });

  test('layout has no horizontal overflow', async ({ page }) => {
    await page.goto('/');

    const overflow = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth - el.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('decorative hero logo is hidden on phones', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.hero-logo')).toBeHidden();
  });

  test('header remains sticky', async ({ page }) => {
    await page.goto('/');

    const position = await page
      .locator('.site-header')
      .evaluate((el) => getComputedStyle(el).position);
    expect(position).toBe('sticky');
  });

  test('docs layout has no horizontal overflow', async ({ page }) => {
    await page.goto('/docs/reference/cli');

    const overflow = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth - el.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe('reduced motion', () => {
  test.beforeEach(({ isMobile }) => {
    // The phone breakpoint already disables the decorative animation, so assert the
    // global reduced-motion guard where it would otherwise run continuously.
    test.skip(isMobile, 'decorative animation is disabled on the phone breakpoint');
  });

  test('neutralizes continuous decorative animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');

    // Sanity: the glow animates indefinitely without a reduced-motion preference.
    const glow = page.locator('.hero-glow');
    expect(await glow.evaluate((el) => getComputedStyle(el).animationIterationCount)).toBe(
      'infinite'
    );

    await page.emulateMedia({ reducedMotion: 'reduce' });

    expect(await glow.evaluate((el) => getComputedStyle(el).animationIterationCount)).toBe('1');
    expect(
      await page
        .locator('.hero-logo')
        .evaluate((el) => getComputedStyle(el).animationIterationCount)
    ).toBe('1');
  });
});
