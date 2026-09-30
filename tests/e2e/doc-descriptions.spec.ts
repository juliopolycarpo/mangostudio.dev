import { expect, test } from '@playwright/test';

import { DOCS_NAV } from '../../src/data/docs.generated';
import type { Lang } from '../../src/i18n/types';
import { routes } from '../../src/i18n/ui';

/** Search snippets cut off near this length; the docs sync trims to it. */
const MAX_LENGTH = 160;
const LANGS: readonly Lang[] = ['pt', 'en'];

async function metaContent(
  page: import('@playwright/test').Page,
  selector: string
): Promise<string | null> {
  return page.locator(selector).getAttribute('content');
}

for (const lang of LANGS) {
  test.describe(`docs descriptions (${lang})`, () => {
    const slugs = DOCS_NAV[lang].flatMap((group) => group.items.map((item) => item.slug));

    test('every docs page has its own description and og:description', async ({ page }) => {
      await page.goto(routes.home(lang));
      const home = await metaContent(page, 'meta[name="description"]');
      const seen = new Map<string, string>();

      expect(
        slugs.length,
        `expected ${lang} docs pages | received ${slugs.length}`
      ).toBeGreaterThan(0);

      for (const slug of slugs) {
        const path = routes.doc(lang, slug);

        await page.goto(path);
        const description = await metaContent(page, 'meta[name="description"]');
        const og = await metaContent(page, 'meta[property="og:description"]');

        expect(
          description,
          `expected a description on ${path} | received: ${description}`
        ).toBeTruthy();
        expect(
          description,
          `expected ${path} description to differ from the ${lang} home page | received: ${description}`
        ).not.toBe(home);
        expect(
          (description as string).length,
          `expected ${path} description within ${MAX_LENGTH} chars | received ${(description as string).length}`
        ).toBeLessThanOrEqual(MAX_LENGTH);
        expect(og, `expected og:description to match the description on ${path}`).toBe(description);
        expect(
          seen.get(description as string),
          `expected a unique description on ${path} | received the same as ${seen.get(description as string)}`
        ).toBeUndefined();
        seen.set(description as string, path);
      }
    });
  });
}
