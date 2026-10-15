import { expect, test } from '@playwright/test';

for (const path of ['/', '/en/']) {
  test(`downloads the decorative logo only when rendered on ${path}`, async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    const logo = page.locator('.hero-logo');
    await expect(logo).toHaveAttribute('loading', 'lazy');
    await expect(logo).toBeHidden();
    await page.waitForLoadState('networkidle');
    const source = await logo.getAttribute('src');
    expect(source, 'hero logo should have a local image source').toBeTruthy();
    const logoUrl = new URL(source ?? '', page.url()).href;
    expect(requests, 'hidden mobile logo must not be requested').not.toContain(logoUrl);

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(logo).toBeVisible();
    await expect.poll(() => requests.includes(logoUrl)).toBe(true);
    await expect
      .poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBe(192);
  });
}
