import { expect, test } from '@playwright/test';

// Text drawn in "Geist Fallback" before the web font arrives must take the same width as
// Geist, or lines rewrap and the page shifts when the font swaps in. Geist widens with
// weight and Arial does not, so each weight the site uses is checked on its own. The
// measurement uses 100px text, where whole-pixel glyph hinting does not skew widths.
const WEIGHTS = [400, 500, 600, 650, 700] as const;
const TOLERANCE = 0.015;

test('fallback font matches Geist text width at every used weight', async ({ page }) => {
  await page.goto('/docs/reference/cli/');
  await page.evaluate(() => document.fonts.ready);

  const ratios = await page.evaluate(async (weights) => {
    const text = [...document.querySelectorAll('.docs-markdown p, .docs-markdown li')]
      .map((el) => el.textContent ?? '')
      .join(' ')
      .slice(0, 4000);
    const width = (family: string, weight: number): number => {
      const span = document.createElement('span');
      span.style.cssText = `position:absolute;white-space:nowrap;font:${weight} 100px ${family}`;
      span.textContent = text;
      document.body.append(span);
      const measured = span.getBoundingClientRect().width;
      span.remove();
      return measured;
    };
    const result: Record<number, number | null> = {};
    for (const weight of weights) {
      const faces = await document.fonts.load(`${weight} 100px "Geist Fallback"`, text);
      result[weight] =
        faces.length === 0
          ? null
          : width('"Geist Fallback"', weight) / width('"Geist Variable"', weight);
    }
    return result;
  }, WEIGHTS);

  for (const weight of WEIGHTS) {
    const ratio = ratios[weight];
    expect(
      ratio,
      `(fallback ${weight}): expected a local Arial or Liberation Sans face`
    ).not.toBeNull();
    expect(
      Math.abs((ratio ?? 0) - 1),
      `(fallback ${weight}): expected width ratio 1 ± ${TOLERANCE} | received: ${ratio?.toFixed(4)}`
    ).toBeLessThanOrEqual(TOLERANCE);
  }
});
