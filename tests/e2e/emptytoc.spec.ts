import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const LOCALES = [
  { name: 'pt', path: '/docs/quickstart/' },
  { name: 'en', path: '/en/docs/quickstart/' },
] as const;

// Above 1120px the table of contents has its own column; at or below it the list is hidden
// and the page is two columns (one under 821px).
const TOC_WIDTHS = [1121, 1280, 1440] as const;
const NO_TOC_COLUMN_WIDTHS = [768, 1024, 1120] as const;

interface Layout {
  columns: number;
  docsRight: number;
  articleRight: number;
  articleWidth: number;
  hasAside: boolean;
  hasTocClass: boolean;
  items: number;
}

async function layout(page: Page): Promise<Layout> {
  return page.evaluate(() => {
    const docs = document.querySelector('.docs');
    const article = document.querySelector('.docs-article');
    if (!docs || !article) throw new Error('expected .docs and .docs-article on a docs page');
    const docsBox = docs.getBoundingClientRect();
    const articleBox = article.getBoundingClientRect();
    return {
      columns: getComputedStyle(docs).gridTemplateColumns.split(' ').length,
      docsRight: docsBox.right,
      articleRight: articleBox.right,
      articleWidth: articleBox.width,
      hasAside: document.querySelector('aside.docs-toc') !== null,
      hasTocClass: docs.classList.contains('has-toc'),
      items: document.querySelectorAll('.docs-toc-item').length,
    };
  });
}

/** Turn a rendered page into what the template emits for a page without h2/h3 headings. */
async function dropToc(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelector('aside.docs-toc')?.remove();
    document.querySelector('.docs')?.classList.remove('has-toc');
  });
}

test.describe('docs table of contents column', () => {
  test.skip(({ isMobile }) => isMobile, 'viewport is set explicitly per test');

  for (const locale of LOCALES) {
    test(`${locale.name}: every docs page renders the aside only when it has entries`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(locale.path);
      const hrefs = await page
        .locator('.docs-sidebar a.docs-link')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
      expect(hrefs.length, `expected docs links: >= 1 | received: ${hrefs.length}`).toBeGreaterThan(
        0
      );

      for (const href of hrefs) {
        await page.goto(href);
        const { hasAside, hasTocClass, items, columns } = await layout(page);
        expect(
          hasAside,
          `${href}: expected aside.docs-toc only with entries | received: aside=${hasAside}, entries=${items}`
        ).toBe(items > 0);
        expect(
          hasTocClass,
          `${href}: expected .docs.has-toc only with entries | received: has-toc=${hasTocClass}, entries=${items}`
        ).toBe(items > 0);
        expect(
          columns,
          `${href}: expected grid columns: ${items > 0 ? 3 : 2} | received: ${columns}`
        ).toBe(items > 0 ? 3 : 2);
      }
    });

    for (const width of TOC_WIDTHS) {
      test(`${locale.name} ${width}px: a page without a table of contents gives the article the column`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(locale.path);
        const withToc = await layout(page);
        expect(
          withToc.columns,
          `${width}px: expected a page with entries to keep 3 columns | received: ${withToc.columns}`
        ).toBe(3);

        await dropToc(page);
        const withoutToc = await layout(page);
        expect(
          withoutToc.articleRight,
          `${width}px: expected article to reach the page edge: ${withoutToc.docsRight} | received: ${withoutToc.articleRight} (grid columns: ${withoutToc.columns})`
        ).toBeCloseTo(withoutToc.docsRight, 1);
        expect(
          withoutToc.articleWidth,
          `${width}px: expected article wider than with the list by 220px | received: ${withoutToc.articleWidth} vs ${withToc.articleWidth}`
        ).toBeCloseTo(withToc.articleWidth + 220, 1);
      });
    }

    for (const width of NO_TOC_COLUMN_WIDTHS) {
      test(`${locale.name} ${width}px: the list stays hidden and the layout is unchanged`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(locale.path);
        const withToc = await layout(page);
        await dropToc(page);
        const withoutToc = await layout(page);

        expect(
          withoutToc.articleWidth,
          `${width}px: expected the same article width with or without entries | received: ${withToc.articleWidth} vs ${withoutToc.articleWidth}`
        ).toBeCloseTo(withToc.articleWidth, 1);
        expect(
          withToc.columns,
          `${width}px: expected columns: ${width > 820 ? 2 : 1} | received: ${withToc.columns}`
        ).toBe(width > 820 ? 2 : 1);
      });
    }
  }
});
