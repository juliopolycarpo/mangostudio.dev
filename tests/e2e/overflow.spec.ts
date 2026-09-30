import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const DIST = join(import.meta.dirname, '..', '..', 'dist');
const LOCALES = [
  { name: 'pt', root: '' },
  { name: 'en', root: 'en' },
] as const;

function isRedirectStub(file: string): boolean {
  return readFileSync(file, 'utf8').includes('http-equiv="refresh"');
}

/**
 * Every emitted docs page under `<locale root>/docs`, derived from dist. Meta-refresh stubs
 * (the `/docs/` redirect to the default page) are skipped: navigating them destroys the page.
 */
function docsRoutes(localeRoot: string): string[] {
  const docsDir = join(DIST, localeRoot, 'docs');
  const routes: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'index.html' && !isRedirectStub(full)) {
        routes.push(`/${relative(DIST, dir).split(sep).join('/')}/`);
      }
    }
  };
  walk(docsDir);
  return routes.sort();
}

async function documentScrollWidth(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

// Viewport-sensitive: run once on the desktop project with a fixed, non-mobile viewport.
test.beforeEach(({ isMobile }) => {
  test.skip(isMobile, 'viewport is set explicitly per test');
});

test.describe('docs pages at 320px', () => {
  test.use({ viewport: { width: 320, height: 800 } });

  for (const locale of LOCALES) {
    test(`${locale.name}: no page scrolls horizontally`, async ({ page }) => {
      const routes = docsRoutes(locale.root);
      expect(
        routes.length,
        `expected docs pages in dist/${locale.root}/docs (run bun run build first) | received: ${routes.length}`
      ).toBeGreaterThan(0);

      const offenders: string[] = [];
      for (const route of routes) {
        await page.goto(route);
        const width = await documentScrollWidth(page);
        if (width > 320) offenders.push(`${route} scrollWidth=${width}`);
      }

      expect(
        offenders,
        `expected document scrollWidth <= 320 on ${routes.length} pages | received ${offenders.length} overflowing:\n${offenders.join('\n')}`
      ).toEqual([]);
    });
  }
});

test.describe('home with animations running', () => {
  for (const width of [768, 1024]) {
    for (const locale of LOCALES) {
      test(`${locale.name}: no horizontal scroll at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/${locale.root}${locale.root ? '/' : ''}`);

        const running = await page.evaluate(() =>
          document
            .getAnimations()
            .some((a) => a instanceof CSSAnimation && a.animationName === 'glowpulse')
        );
        expect(running, 'expected glowpulse animation running | received: not running').toBe(true);

        // Sample the pulse at its start and peak; the peak is where the overflow appeared.
        for (const time of [0, 3500]) {
          await page.evaluate((t) => {
            for (const a of document.getAnimations()) {
              if (a instanceof CSSAnimation && a.animationName === 'glowpulse') {
                a.pause();
                a.currentTime = t;
              }
            }
          }, time);
          const measured = await documentScrollWidth(page);
          expect(
            measured,
            `expected document scrollWidth <= ${width} at glowpulse t=${time}ms | received: ${measured}`
          ).toBeLessThanOrEqual(width);
        }
      });
    }
  }

  test('hero glow stays horizontally centered at the pulse peak', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto('/');
    await page.evaluate(() => {
      for (const a of document.getAnimations()) {
        if (a instanceof CSSAnimation && a.animationName === 'glowpulse') {
          a.pause();
          a.currentTime = 3500;
        }
      }
    });

    const offset = await page.evaluate(() => {
      const glow = document.querySelector('.hero-glow');
      const host = glow?.parentElement;
      if (!glow || !host) return Number.NaN;
      const g = glow.getBoundingClientRect();
      const h = host.getBoundingClientRect();
      return g.left + g.width / 2 - (h.left + h.width / 2);
    });
    expect(
      Math.abs(offset),
      `expected .hero-glow center within 1px of its container center | received offset: ${offset}px`
    ).toBeLessThanOrEqual(1);
  });
});
