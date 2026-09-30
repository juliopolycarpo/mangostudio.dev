import { expect, test } from '@playwright/test';

const PAGES = [
  { lang: 'pt', path: '/docs/quickstart/', activeDoc: '/docs/quickstart/' },
  { lang: 'en', path: '/en/docs/quickstart/', activeDoc: '/en/docs/quickstart/' },
  { lang: 'pt', path: '/docs/reference/cli/', activeDoc: '/docs/reference/cli/' },
  { lang: 'en', path: '/en/releases/', activeDoc: undefined },
  { lang: 'pt', path: '/', activeDoc: undefined },
  { lang: 'en', path: '/en/', activeDoc: undefined },
] as const;

for (const { lang, path, activeDoc } of PAGES) {
  test.describe(`trailing slashes (${lang}) ${path}`, () => {
    test('every internal page href ends in a slash', async ({ page }) => {
      await page.goto(path);

      const hrefs = await page.$$eval('a[href^="/"]', (anchors) =>
        anchors
          .map((a) => a.getAttribute('href') ?? '')
          .filter((href) => !href.startsWith('//'))
          .map((href) => href.split(/[?#]/)[0] ?? '')
          .filter((pathname) => !/\.[a-z0-9]+$/i.test(pathname))
      );
      const slashless = [...new Set(hrefs.filter((pathname) => !pathname.endsWith('/')))];

      expect(
        slashless,
        `expected every internal href to end in "/" | received ${slashless.length} slashless: ${slashless.slice(0, 5).join(', ')}`
      ).toEqual([]);
    });

    test('the current docs page keeps a single aria-current sidebar link', async ({ page }) => {
      test.skip(!activeDoc, 'only docs pages render the sidebar');
      await page.goto(path);

      const current = page.locator('.docs-sidebar a[aria-current="page"]');

      await expect(current, `expected exactly one current sidebar link for ${path}`).toHaveCount(1);
      await expect(current).toHaveAttribute('href', activeDoc as string);
    });
  });
}
