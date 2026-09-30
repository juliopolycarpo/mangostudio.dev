import { expect, test } from '@playwright/test';
import { releaseChannel } from '../../src/data/release-channel';
import { RELEASE } from '../../src/data/releases.generated';

// Rendered badge text and intro wording per locale and channel; must track the committed
// release metadata.
const LABELS = {
  '/releases/': {
    canary: { badge: 'versão canary', intro: /^Versão canary /i },
    stable: { badge: 'versão estável', intro: /^Versão estável /i },
  },
  '/en/releases/': {
    canary: { badge: 'canary version', intro: /^Canary version /i },
    stable: { badge: 'stable version', intro: /^Stable version /i },
  },
} as const;

for (const [path, labels] of Object.entries(LABELS)) {
  test(`release badge and intro on ${path} match the metadata channel`, async ({ page }) => {
    const channel = releaseChannel(RELEASE.version);

    await page.goto(path);

    await expect(
      page.locator('.rel-badge-latest'),
      `expected badge for ${RELEASE.version} on ${path}: "${labels[channel].badge}"`
    ).toHaveText(labels[channel].badge);
    await expect(
      page.locator('.rel-intro'),
      `expected intro for ${RELEASE.version} on ${path} to match ${labels[channel].intro}`
    ).toHaveText(labels[channel].intro);
  });
}
