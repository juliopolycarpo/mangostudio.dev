import { expect, test } from '@playwright/test';

const PAGES = [
  { file: '/404.html', lang: 'pt', heading: 'Página não encontrada', home: '/', docs: '/docs/' },
  { file: '/en/404.html', lang: 'en', heading: 'Page not found', home: '/en/', docs: '/en/docs/' },
] as const;

// Serve the flat files directly: `astro preview` does not apply Cloudflare's
// nearest-404 lookup, so the routing itself is covered by the wrangler check in the PR.
for (const { file, lang, heading, home, docs } of PAGES) {
  test.describe(`${file}`, () => {
    test('renders localized copy with lang, noindex, and no canonical or alternates', async ({
      page,
    }) => {
      await page.goto(file);

      await expect(page.locator('html'), `expected <html lang> for ${file}`).toHaveAttribute(
        'lang',
        lang
      );
      await expect(page.locator('h1.nf-title')).toHaveText(heading);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');

      const canonical = await page.locator('link[rel="canonical"]').count();
      expect(canonical, `expected canonical links: 0 | received: ${canonical}`).toBe(0);
      const alternates = await page.locator('link[rel="alternate"]').count();
      expect(alternates, `expected alternate links: 0 | received: ${alternates}`).toBe(0);
    });

    test('language toggle and CTAs point at existing pages, never at a 404 twin', async ({
      page,
    }) => {
      await page.goto(file);

      const toggle = await page
        .locator('.lang-toggle a[hreflang]')
        .evaluateAll((links) =>
          links.map((link) => [link.getAttribute('hreflang'), link.getAttribute('href')])
        );
      expect(toggle.length > 0, `expected toggle links: >0 | received: ${toggle.length}`).toBe(
        true
      );
      for (const [code, href] of toggle) {
        const expected = code === 'en' ? '/en/' : '/';
        expect(href, `expected ${code} toggle href: ${expected} | received: ${href}`).toBe(
          expected
        );
      }

      await expect(page.locator('.nf-cta a').first()).toHaveAttribute('href', home);
      await expect(page.locator('.nf-cta a').nth(1)).toHaveAttribute(
        'href',
        new RegExp(`^${docs}`)
      );
    });

    test('is readable with JavaScript disabled', async ({ browser }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(file);

      await expect(page.locator('h1.nf-title')).toHaveText(heading);
      await context.close();
    });
  });
}
