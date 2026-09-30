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

/**
 * Pause every `glowpulse` animation at `fraction` of one iteration (0 = start, 0.5 = the
 * scale peak). The duration is read from the running animation, so retiming the keyframes
 * in `global.css` moves the sample points with it.
 */
async function seekGlowpulse(page: Page, fraction: number): Promise<number> {
  return page.evaluate((f) => {
    let seeked = 0;
    for (const a of document.getAnimations()) {
      if (!(a instanceof CSSAnimation) || a.animationName !== 'glowpulse') continue;
      const duration = Number(a.effect?.getComputedTiming().duration);
      a.pause();
      a.currentTime = duration * f;
      seeked += 1;
    }
    return seeked;
  }, fraction);
}

async function documentScrollWidth(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

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
  test.beforeEach(({ isMobile }) => {
    // The phone breakpoint turns the glow animation off, so only desktop exercises it.
    test.skip(isMobile, 'glowpulse is disabled on the phone breakpoint');
  });

  const homePath = (root: string) => (root ? `/${root}/` : '/');

  for (const width of [768, 1024]) {
    for (const locale of LOCALES) {
      test(`${locale.name}: no horizontal scroll at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(homePath(locale.root));

        // Sample the pulse at its start and peak; the peak is where the overflow appeared.
        for (const fraction of [0, 0.5]) {
          const seeked = await seekGlowpulse(page, fraction);
          expect(
            seeked,
            `expected at least 1 running glowpulse animation | received: ${seeked}`
          ).toBeGreaterThan(0);
          const measured = await documentScrollWidth(page);
          expect(
            measured,
            `expected document scrollWidth <= ${width} at glowpulse ${fraction * 100}% | received: ${measured}`
          ).toBeLessThanOrEqual(width);
        }
      });
    }
  }

  for (const locale of LOCALES) {
    test(`${locale.name}: hero glow stays horizontally centered at the pulse peak`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1024, height: 900 });
      await page.goto(homePath(locale.root));
      await seekGlowpulse(page, 0.5);

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
  }
});
