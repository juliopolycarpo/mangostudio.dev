import { expect, test } from '@playwright/test';
import { releaseChannel } from '../../src/data/release-channel';
import { RELEASE } from '../../src/data/releases.generated';

// Rendered label text per locale and channel; must track the committed release metadata.
const LABELS = {
  '/releases/': { canary: 'versão canary', stable: 'versão estável' },
  '/en/releases/': { canary: 'canary version', stable: 'stable version' },
} as const;

for (const [path, labels] of Object.entries(LABELS)) {
  test(`release badge on ${path} matches the metadata channel`, async ({ page }) => {
    const channel = releaseChannel(RELEASE.version);

    await page.goto(path);

    await expect(
      page.locator('.rel-badge-latest'),
      `expected badge for ${RELEASE.version} on ${path}: "${labels[channel]}"`
    ).toHaveText(labels[channel]);
  });
}
