import { expect, type Page, test } from '@playwright/test';

const LOCALES = [
  { name: 'pt', home: '/', quickstart: '/docs/quickstart', cli: '/docs/reference/cli' },
  { name: 'en', home: '/en/', quickstart: '/en/docs/quickstart', cli: '/en/docs/reference/cli' },
] as const;

const UPSTREAM_BLOB = 'https://github.com/juliopolycarpo/mangostudio/blob/';

/** Same-origin hrefs of a page, resolved against the page URL, without fragments. */
async function internalHrefs(page: Page, selector: string): Promise<string[]> {
  const hrefs = await page
    .locator(selector)
    .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
  const origin = new URL(page.url()).origin;

  return [...new Set(hrefs.filter((href) => href.startsWith(origin)))].map(
    (href) => href.split('#')[0] ?? href
  );
}

for (const locale of LOCALES) {
  test.describe(`links (${locale.name})`, () => {
    test('contribution CTA opens the contributing guide', async ({ page }) => {
      await page.goto(locale.home);
      const cta = page.locator('.contribute-cta a.btn:not(.btn-primary)');
      const href = await cta.getAttribute('href');

      expect(href, `expected CTA href to point at guides/contributing | received: ${href}`).toMatch(
        /\/docs\/guides\/contributing\/$/
      );

      const response = await page.request.get(href ?? '');
      expect(
        response.status(),
        `expected CTA target ${href} to respond 200 | received: ${response.status()}`
      ).toBe(200);
    });

    for (const [label, path] of [
      ['quickstart', locale.quickstart],
      ['CLI reference', locale.cli],
    ] as const) {
      test(`${label} doc has no broken internal links`, async ({ page }) => {
        await page.goto(path);
        const hrefs = await internalHrefs(page, '.docs-article a[href]');
        const broken: string[] = [];

        for (const href of hrefs) {
          const status = (await page.request.get(href)).status();
          if (status >= 400) broken.push(`${href} (${status})`);
        }

        expect(
          broken,
          `expected 0 broken internal links on ${path} | received: ${broken.join(', ')}`
        ).toEqual([]);
      });
    }

    test('repository files link to the upstream blob, not a site route', async ({ page }) => {
      await page.goto(locale.quickstart);
      const license = page.locator('article a', { hasText: /MIT/ }).first();
      const href = await license.getAttribute('href');

      expect(
        href?.startsWith(UPSTREAM_BLOB) && href.endsWith('/LICENSE'),
        `expected license link to start with ${UPSTREAM_BLOB} and end with /LICENSE | received: ${href}`
      ).toBe(true);
    });
  });
}
