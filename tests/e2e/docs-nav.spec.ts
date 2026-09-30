import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const LOCALES = [
  { name: 'pt', root: '/docs/quickstart/' },
  { name: 'en', root: '/en/docs/quickstart/' },
] as const;

const PHONE = { width: 390, height: 844 };

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

/** Links a user can see. checkVisibility also honors the content-visibility a closed details applies. */
async function sidebarLinksVisible(page: Page): Promise<number> {
  return page
    .locator('.docs-sidebar a.docs-link')
    .evaluateAll(
      (links) => links.filter((link) => link.checkVisibility({ visibilityProperty: true })).length
    );
}

async function expectNavState(page: Page, state: 'open' | 'closed', context: string) {
  const summaries = await page.locator('.docs-nav > summary').count();
  expect(
    summaries,
    `${context}: expected 1 details.docs-nav > summary in the docs sidebar | received: ${summaries}`
  ).toBe(1);
  const open = await page.locator('.docs-nav').evaluate((el) => (el as HTMLDetailsElement).open);
  const visible = await sidebarLinksVisible(page);
  const total = await page.locator('.docs-sidebar a.docs-link').count();
  expect(open, `${context}: expected details.open=${state === 'open'} | received: ${open}`).toBe(
    state === 'open'
  );
  if (state === 'open') {
    expect(
      visible,
      `${context}: expected all ${total} sidebar links visible | received: ${visible}`
    ).toBe(total);
    return;
  }
  expect(visible, `${context}: expected 0 sidebar links visible | received: ${visible}`).toBe(0);
}

for (const locale of LOCALES) {
  test.describe(`${locale.name}: docs navigation at 390px`, () => {
    test.use({ viewport: PHONE });

    test('article title starts inside the first viewport', async ({ page }) => {
      await page.goto(locale.root);
      const top = await page
        .locator('.docs-markdown h1')
        .first()
        .evaluate((el) => {
          return el.getBoundingClientRect().top + window.scrollY;
        });
      expect(
        top,
        `expected article h1 top < ${PHONE.height}px (first viewport) | received: ${Math.round(top)}px`
      ).toBeLessThan(PHONE.height);
    });

    test('sidebar is collapsed by default behind a localized summary', async ({ page }) => {
      await page.goto(locale.root);
      await expectNavState(page, 'closed', 'initial load');
      const summary = page.locator('.docs-nav > summary');
      await expect(summary, 'expected a visible <summary> at 390px').toBeVisible();
      const label = (await summary.innerText()).trim();
      expect(
        label.length,
        `expected a non-empty summary label | received: "${label}"`
      ).toBeGreaterThan(0);
    });

    test('summary toggles from the keyboard', async ({ page }) => {
      await page.goto(locale.root);
      await expectNavState(page, 'closed', 'before toggling');
      await page.locator('.docs-nav > summary').focus();
      await page.keyboard.press('Enter');
      await expectNavState(page, 'open', 'after Enter');
      await page.keyboard.press('Space');
      await expectNavState(page, 'closed', 'after Space');
    });
  });

  test.describe(`${locale.name}: docs navigation at 390px without JavaScript`, () => {
    test.use({ viewport: PHONE, javaScriptEnabled: false });

    test('collapsed by default and opens natively', async ({ page }) => {
      await page.goto(locale.root);
      await expectNavState(page, 'closed', 'JS off, initial');
      await page.locator('.docs-nav > summary').click();
      await expectNavState(page, 'open', 'JS off, after click');
    });

    test('summary toggles from the keyboard', async ({ page }) => {
      await page.goto(locale.root);
      await expectNavState(page, 'closed', 'JS off, before toggling');
      await page.locator('.docs-nav > summary').focus();
      await page.keyboard.press('Enter');
      await expectNavState(page, 'open', 'JS off, after Enter');
    });
  });

  for (const withJs of [true, false]) {
    test.describe(`${locale.name}: docs navigation at 1024px${withJs ? '' : ' without JavaScript'}`, () => {
      test.use({ viewport: { width: 1024, height: 900 }, javaScriptEnabled: withJs });

      test('sidebar list stays expanded regardless of the details state', async ({ page }) => {
        await page.goto(locale.root);
        const summaries = await page.locator('.docs-nav > summary').count();
        expect(
          summaries,
          `expected 1 details.docs-nav > summary in the docs sidebar | received: ${summaries}`
        ).toBe(1);
        const total = await page.locator('.docs-sidebar a.docs-link').count();
        const visible = await sidebarLinksVisible(page);
        expect(
          visible,
          `expected all ${total} sidebar links visible at 1024px | received: ${visible}`
        ).toBe(total);
        await expect(
          page.locator('.docs-nav > summary'),
          'expected the disclosure summary hidden at 1024px'
        ).toBeHidden();
      });
    });
  }

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
