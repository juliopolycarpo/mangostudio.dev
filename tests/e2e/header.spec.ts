import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const LOCALES = [
  { name: 'pt', path: '/' },
  { name: 'en', path: '/en/' },
] as const;
const THEMES = ['light', 'dark'] as const;

// The phone/tablet widths that matter, plus the edges of each layout band: 721 is the
// first tablet width, 1080 the last, 1081 the first full-desktop width.
const WIDTHS = [320, 360, 390, 412, 721, 768, 1024, 1080, 1081, 1280] as const;
const PHONE_MAX = 720;
const TABLET_MAX = 1080;

// WCAG 2.5.8 minimum pointer target.
const MIN_TARGET = 24;
// A header control that wraps its text grows past a single line of padding and text.
const MAX_CONTROL_HEIGHT = 44;
// Sub-pixel layout rounding is not an overlap.
const EPSILON = 0.5;

const CONTROLS = ['brand', 'nav', 'search', 'theme', 'lang', 'github', 'cta'] as const;
type ControlName = (typeof CONTROLS)[number];

const SELECTORS: Record<ControlName, string> = {
  brand: '.site-header .brand',
  nav: '.site-header .nav',
  search: '.site-header .search-btn',
  theme: '.site-header .theme-toggle',
  lang: '.site-header .lang-toggle',
  github: '.site-header .gh-link',
  cta: '.site-header .header-cta',
};

interface Box {
  left: number;
  right: number;
  width: number;
  height: number;
}

interface Icon extends Box {
  declaredWidth: number;
}

interface HeaderMeasure {
  viewport: number;
  controls: Partial<Record<ControlName, Box>>;
  icons: { control: ControlName; box: Icon }[];
  navLinks: { href: string; box: Box }[];
  langOptions: Box[];
  langClientWidth: number;
  langScrollWidth: number;
}

async function measureHeader(page: Page): Promise<HeaderMeasure> {
  return page.evaluate(
    ({ selectors }) => {
      // getClientRects is empty for an element or any ancestor with display: none.
      const rendered = (el: Element | null): el is Element =>
        el !== null &&
        el.getClientRects().length > 0 &&
        getComputedStyle(el).visibility !== 'hidden';
      const box = (el: Element): Box => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, width: r.width, height: r.height };
      };

      const controls: Partial<Record<string, Box>> = {};
      const icons: { control: string; box: Icon }[] = [];
      for (const [name, selector] of Object.entries(selectors)) {
        const el = document.querySelector(selector);
        if (!rendered(el)) continue;
        controls[name] = box(el);
        for (const svg of el.querySelectorAll('svg')) {
          if (!rendered(svg)) continue;
          icons.push({
            control: name,
            box: { ...box(svg), declaredWidth: Number(svg.getAttribute('width')) },
          });
        }
      }

      const navLinks = Array.from(document.querySelectorAll('.site-header .nav-link'))
        .filter(rendered)
        .map((el) => ({ href: el.getAttribute('href') ?? '', box: box(el) }));
      const lang = document.querySelector('.site-header .lang-toggle') as HTMLElement;
      return {
        viewport: document.documentElement.clientWidth,
        controls,
        icons,
        navLinks,
        langOptions: Array.from(lang.querySelectorAll('.lang-opt')).map(box),
        langClientWidth: lang.clientWidth,
        langScrollWidth: lang.scrollWidth,
      };
    },
    { selectors: SELECTORS }
  ) as Promise<HeaderMeasure>;
}

function fmt(box: Box): string {
  return `${Math.round(box.left)}-${Math.round(box.right)} (${Math.round(box.width)}x${Math.round(box.height)})`;
}

/** Every rendered control keeps a usable box, stays in the viewport and clears its neighbours. */
function assertControlsFit(m: HeaderMeasure, context: string): void {
  const entries = Object.entries(m.controls) as [ControlName, Box][];

  for (const [name, box] of entries) {
    expect
      .soft(
        box.width,
        `${context}: expected ${name} width >= ${MIN_TARGET}px | received: ${fmt(box)}`
      )
      .toBeGreaterThanOrEqual(MIN_TARGET);
    expect
      .soft(
        box.height,
        `${context}: expected ${name} height >= ${MIN_TARGET}px | received: ${fmt(box)}`
      )
      .toBeGreaterThanOrEqual(MIN_TARGET);
    expect
      .soft(
        box.height,
        `${context}: expected ${name} height <= ${MAX_CONTROL_HEIGHT}px (one line, no wrapping) | received: ${fmt(box)}`
      )
      .toBeLessThanOrEqual(MAX_CONTROL_HEIGHT);
    expect
      .soft(
        box.left,
        `${context}: expected ${name} inside the viewport (0-${m.viewport}) | received: ${fmt(box)}`
      )
      .toBeGreaterThanOrEqual(-EPSILON);
    expect
      .soft(
        box.right,
        `${context}: expected ${name} inside the viewport (0-${m.viewport}) | received: ${fmt(box)}`
      )
      .toBeLessThanOrEqual(m.viewport + EPSILON);
  }

  const ordered = [...entries].sort((a, b) => a[1].left - b[1].left);
  for (let i = 1; i < ordered.length; i++) {
    const [prevName, prev] = ordered[i - 1];
    const [name, box] = ordered[i];
    expect
      .soft(
        box.left,
        `${context}: expected ${name} to start after ${prevName} ends (no overlap) | received: ${prevName} ${fmt(prev)}, ${name} ${fmt(box)}`
      )
      .toBeGreaterThanOrEqual(prev.right - EPSILON);
  }

  for (const { control, box } of m.icons) {
    expect
      .soft(
        box.width,
        `${context}: expected ${control} icon width >= declared ${box.declaredWidth}px (not shrunk) | received: ${fmt(box)}`
      )
      .toBeGreaterThanOrEqual(box.declaredWidth - EPSILON);
  }
}

/** The segmented language control shows both options in full. */
function assertLangNotClipped(m: HeaderMeasure, context: string): void {
  const lang = m.controls.lang;
  if (!lang) return;
  const optionsWidth = m.langOptions.reduce((sum, o) => sum + o.width, 0);
  expect
    .soft(
      lang.width,
      `${context}: expected lang toggle width >= its options' ${Math.round(optionsWidth)}px | received: ${fmt(lang)}`
    )
    .toBeGreaterThanOrEqual(optionsWidth);
  expect
    .soft(
      m.langScrollWidth,
      `${context}: expected lang toggle to show all content (scrollWidth <= clientWidth ${m.langClientWidth}px) | received: scrollWidth ${m.langScrollWidth}px`
    )
    .toBeLessThanOrEqual(m.langClientWidth);
  for (const [i, option] of m.langOptions.entries()) {
    expect
      .soft(
        option.width,
        `${context}: expected lang option ${i + 1} width >= ${MIN_TARGET}px | received: ${fmt(option)}`
      )
      .toBeGreaterThanOrEqual(MIN_TARGET);
    expect
      .soft(
        option.right,
        `${context}: expected lang option ${i + 1} inside the toggle (right <= ${Math.round(lang.right)}) | received: ${fmt(option)}`
      )
      .toBeLessThanOrEqual(lang.right + EPSILON);
  }
}

async function setTheme(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
  await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme);
}

function expectedNavHrefs(width: number): RegExp[] {
  if (width <= PHONE_MAX) return [];
  if (width <= TABLET_MAX) return [/\/releases\/?$/, /\/docs\/quickstart\/?$/];
  return [/\/$/, /#features$/, /\/releases\/?$/, /\/docs\/quickstart\/?$/];
}

test.describe('header controls', () => {
  test.skip(({ isMobile }) => isMobile, 'viewport is set explicitly per test');

  for (const locale of LOCALES) {
    for (const width of WIDTHS) {
      test(`${locale.name} ${width}px: every control keeps a usable box`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(locale.path);
        await expect(page.locator(SELECTORS.search)).toBeVisible();

        for (const theme of THEMES) {
          await setTheme(page, theme);
          const context = `${locale.name} ${width}px ${theme}`;
          const m = await measureHeader(page);

          const required: ControlName[] = ['brand', 'search', 'theme', 'lang', 'github'];
          if (width > PHONE_MAX) required.push('cta');
          for (const name of required) {
            expect(
              m.controls[name],
              `${context}: expected ${name} to be rendered | received: hidden`
            ).toBeDefined();
          }
          if (width <= PHONE_MAX) {
            expect(
              m.controls.cta,
              `${context}: expected the header CTA hidden on phones | received: ${m.controls.cta ? fmt(m.controls.cta) : 'hidden'}`
            ).toBeUndefined();
          }
          expect(
            m.icons.some((i) => i.control === 'search'),
            `${context}: expected a search icon | received: none`
          ).toBe(true);

          assertControlsFit(m, context);
          assertLangNotClipped(m, context);
        }
      });

      test(`${locale.name} ${width}px: nav links appear only where they fit`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(locale.path);
        await expect(page.locator(SELECTORS.search)).toBeVisible();

        const expected = expectedNavHrefs(width);
        const m = await measureHeader(page);
        const received = m.navLinks.map((l) => l.href);
        expect(
          received.length,
          `${locale.name} ${width}px: expected ${expected.length} nav links | received: ${received.length} [${received.join(', ')}]`
        ).toBe(expected.length);
        for (const [i, pattern] of expected.entries()) {
          expect(
            received[i],
            `${locale.name} ${width}px: expected nav link ${i + 1} to match ${pattern} | received: ${received[i]}`
          ).toMatch(pattern);
        }
        for (const link of m.navLinks) {
          expect(
            link.box.width,
            `${locale.name} ${width}px: expected nav link ${link.href} width >= ${MIN_TARGET}px | received: ${fmt(link.box)}`
          ).toBeGreaterThanOrEqual(MIN_TARGET);
        }
      });
    }
  }
});

test.describe('header without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test.skip(({ isMobile }) => isMobile, 'viewport is set explicitly per test');

  // The server-rendered shortcut hint is the widest header content ("Ctrl K / ⌘K").
  for (const locale of LOCALES) {
    for (const width of [320, 390, 721, 1081] as const) {
      test(`${locale.name} ${width}px: rendered controls do not overlap or clip`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(locale.path);

        const context = `${locale.name} ${width}px no-JS`;
        const m = await measureHeader(page);
        assertControlsFit(m, context);
        assertLangNotClipped(m, context);
      });
    }
  }
});

test.describe('header keyboard order', () => {
  test.skip(({ isMobile }) => isMobile, 'viewport is set explicitly per test');

  async function tabThrough(page: Page, controls: Locator[]): Promise<string[]> {
    const reached: string[] = [];
    for (const [i, control] of controls.entries()) {
      if (i === 0) await control.focus();
      else await page.keyboard.press('Tab');
      const name = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return el ? `${el.tagName.toLowerCase()}.${el.className}` : 'none';
      });
      const focused = await control.evaluate((el) => el === document.activeElement);
      reached.push(`${focused ? 'ok' : 'miss'} ${name}`);
    }
    return reached;
  }

  for (const locale of LOCALES) {
    for (const width of [320, 768] as const) {
      test(`${locale.name} ${width}px: Tab reaches each visible control inside the viewport`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(locale.path);
        await expect(page.locator(SELECTORS.search)).toBeVisible();

        const header = page.locator('.site-header');
        const focusable = header.locator('a[href], button');
        const visible: Locator[] = [];
        for (let i = 0; i < (await focusable.count()); i++) {
          const item = focusable.nth(i);
          if (await item.isVisible()) visible.push(item);
        }
        expect(
          visible.length,
          `${locale.name} ${width}px: expected at least 5 focusable header controls | received: ${visible.length}`
        ).toBeGreaterThanOrEqual(5);

        const reached = await tabThrough(page, visible);
        for (const [i, entry] of reached.entries()) {
          expect(
            entry.startsWith('ok'),
            `${locale.name} ${width}px: expected Tab stop ${i + 1} to be header control ${i + 1} in DOM order | received: ${entry}`
          ).toBe(true);
          const box = await visible[i].boundingBox();
          expect(
            box && box.x >= -EPSILON && box.x + box.width <= width + EPSILON,
            `${locale.name} ${width}px: expected Tab stop ${i + 1} inside the viewport (0-${width}) | received: ${box ? `${Math.round(box.x)}-${Math.round(box.x + box.width)}` : 'no box'}`
          ).toBe(true);
        }
      });
    }
  }
});
