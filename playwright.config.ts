import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Reuse a system-installed Chromium when PLAYWRIGHT_CHROMIUM_PATH is set, which keeps
// local runs fast and avoids a browser download. CI leaves it unset and uses the
// Chromium that `playwright install` provisions for reproducibility.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const launchOptions = executablePath ? { executablePath } : {};

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], launchOptions },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'], launchOptions },
    },
  ],
  // Serve the prebuilt dist/ exactly as production does. Build before running:
  // `bun run build && bun run test:e2e`.
  webServer: {
    command: `bun run preview --port ${PORT} --host 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
