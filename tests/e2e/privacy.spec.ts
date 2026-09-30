import { expect, test } from '@playwright/test';

// The site lists hosted providers, so it must never promise that data stays local
// unconditionally. It must say what stays on the machine and what goes to the provider.
const LOCALES = [
  {
    path: '/',
    name: 'pt',
    absolutePromise: /nunca saem|sem nuvem|100% local|offline-first|rodando na sua máquina/i,
    stayLocal: /banco de dados e as chaves de API ficam na sua máquina/i,
    goesToProvider: /prompts e conteúdo vão apenas para o provedor que você escolher/i,
  },
  {
    path: '/en/',
    name: 'en',
    absolutePromise: /never leaves|no cloud|100% local|offline-first|running on your machine/i,
    stayLocal: /database, and API keys stay on your machine/i,
    goesToProvider: /prompts and content go only to the provider you select/i,
  },
];

for (const locale of LOCALES) {
  test.describe(`privacy copy (${locale.name})`, () => {
    test('makes no absolute local-only promise', async ({ page }) => {
      await page.goto(locale.path);

      const description = await page.locator('meta[name="description"]').getAttribute('content');
      const text = `${description}\n${await page.locator('body').innerText()}`;
      const match = text.match(locale.absolutePromise);

      expect(
        match?.[0] ?? null,
        `expected no absolute privacy claim on ${locale.path} | received: "${match?.[0]}"`
      ).toBeNull();
    });

    test('states what stays local and what goes to the selected provider', async ({ page }) => {
      await page.goto(locale.path);

      const description =
        (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';
      const body = await page.locator('body').innerText();

      for (const [label, text] of [
        ['meta description', description],
        ['page body', body],
      ] as const) {
        expect(
          locale.stayLocal.test(text),
          `expected ${label} on ${locale.path} to match ${locale.stayLocal} | received: ${text.slice(0, 300)}`
        ).toBe(true);
        expect(
          locale.goesToProvider.test(text),
          `expected ${label} on ${locale.path} to match ${locale.goesToProvider} | received: ${text.slice(0, 300)}`
        ).toBe(true);
      }
    });
  });
}
