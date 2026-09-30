import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const LOCALES = [
  { name: 'pt', root: '/docs/quickstart/' },
  { name: 'en', root: '/en/docs/quickstart/' },
] as const;

/** Every doc page reachable from the sidebar of `path`, including `path` itself. */
async function docsRoutesFrom(page: Page, path: string): Promise<string[]> {
  await page.goto(path);
  const hrefs = await page
    .locator('.docs-sidebar a.docs-link')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  return [...new Set(hrefs)].filter(Boolean).sort();
}

interface TocReport {
  route: string;
  headings: number;
  items: number;
  active: number;
  broken: string[];
}

/** Compare the TOC with the article headings on every doc reachable from `start`. */
async function tocReports(page: Page, start: string): Promise<TocReport[]> {
  const routes = await docsRoutesFrom(page, start);
  expect(
    routes.length,
    `expected docs routes in the sidebar | received: ${routes.length}`
  ).toBeGreaterThan(0);
  const reports: TocReport[] = [];
  for (const route of routes) {
    await page.goto(route);
    const report = await page.evaluate(() => {
      const headings = document.querySelectorAll('.docs-markdown h2, .docs-markdown h3');
      const items = [...document.querySelectorAll<HTMLAnchorElement>('.docs-toc-item')];
      const ids = new Set([...headings].map((heading) => heading.id));
      return {
        headings: headings.length,
        items: items.length,
        active: items.filter(
          (item) => item.classList.contains('is-active') || item.hasAttribute('aria-current')
        ).length,
        broken: items
          .map((item) => item.getAttribute('href') ?? '')
          .filter((href) => !ids.has(href.slice(1))),
      };
    });
    reports.push({ route, ...report });
  }
  return reports;
}

for (const locale of LOCALES) {
  test.describe(`${locale.name}: table of contents`, () => {
    test.use({ viewport: { width: 1280, height: 700 } });

    test('lists every h2/h3 of every doc', async ({ page }) => {
      const reports = await tocReports(page, locale.root);
      const mismatches = reports
        .filter((r) => r.headings !== r.items)
        .map((r) => `${r.route} headings=${r.headings} toc=${r.items}`);
      expect(
        mismatches,
        `expected TOC entries == article h2/h3 count on ${reports.length} pages | received ${mismatches.length} mismatches:\n${mismatches.join('\n')}`
      ).toEqual([]);
    });

    test('marks no item active by default', async ({ page }) => {
      const reports = await tocReports(page, locale.root);
      const active = reports
        .filter((r) => r.active > 0)
        .map((r) => `${r.route} active=${r.active}`);
      expect(
        active,
        `expected no TOC item marked active on load | received ${active.length} pages:\n${active.join('\n')}`
      ).toEqual([]);
    });

    test('links every item to an existing heading id', async ({ page }) => {
      const reports = await tocReports(page, locale.root);
      const broken = reports
        .filter((r) => r.broken.length > 0)
        .map((r) => `${r.route} ${r.broken.join(',')}`);
      expect(
        broken,
        `expected every TOC href to match a heading id | received:\n${broken.join('\n')}`
      ).toEqual([]);
    });

    test('long tables of contents scroll inside the sticky column', async ({ page }) => {
      await page.goto(locale.root);
      const box = await page.locator('.docs-toc').evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return { height: rect.height, viewport: window.innerHeight };
      });
      expect(
        box.height,
        `expected .docs-toc height <= viewport ${box.viewport}px | received: ${Math.round(box.height)}px`
      ).toBeLessThanOrEqual(box.viewport);
    });
  });
}
