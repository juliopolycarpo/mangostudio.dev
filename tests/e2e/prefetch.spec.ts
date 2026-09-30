import { expect, test } from '@playwright/test';

// Prefetch is disabled while HTML is served with max-age=0, must-revalidate and no validator:
// the browser re-downloads a prefetched page on click, so a hover prefetch only doubles the bytes.
const LOCALES = [
  { name: 'pt', home: '/', docs: '/docs/quickstart' },
  { name: 'en', home: '/en/', docs: '/en/docs/quickstart' },
] as const;

for (const locale of LOCALES) {
  test.describe(`no prefetch (${locale.name})`, () => {
    test('emits no data-astro-prefetch attributes', async ({ page }) => {
      await page.goto(locale.home);

      const count = await page.locator('[data-astro-prefetch]').count();
      expect(count, `expected data-astro-prefetch elements: 0 | received: ${count}`).toBe(0);
    });

    test('hovering the quickstart call to action fetches nothing and navigation still works', async ({
      page,
    }) => {
      await page.goto(locale.home);
      await page.waitForLoadState('networkidle');

      const docRequests: string[] = [];
      page.on('request', (request) => {
        if (request.url().includes('/docs/quickstart')) {
          docRequests.push(request.url());
        }
      });

      const quickstartLink = page.locator('.hero-cta a.btn-primary').first();
      await quickstartLink.hover();
      await page.waitForTimeout(800);
      expect(
        docRequests,
        `expected requests before click: 0 | received: ${docRequests.join(', ')}`
      ).toEqual([]);

      await quickstartLink.click();
      await expect(page).toHaveURL(new RegExp(`${locale.docs}/?$`));
    });
  });
}
