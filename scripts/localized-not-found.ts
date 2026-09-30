import { rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

/**
 * True for sitemap URLs that point at an error page (`/404`, `/en/404/`).
 *
 * @example isNotFoundUrl('https://mangostudio.dev/en/404/'); // true
 */
export function isNotFoundUrl(page: string): boolean {
  return /\/404\/?$/.test(new URL(page).pathname);
}

/**
 * Move `<outDir>/en/404/index.html` to `<outDir>/en/404.html`.
 *
 * Astro only flattens the root `/404` route; Cloudflare's `404-page` handling looks for
 * the nearest `404.html` walking up the path, so the localized page must be a flat file.
 *
 * @example await flattenLocalizedNotFound('./dist', 'en');
 */
export async function flattenLocalizedNotFound(outDir: string, locale: string): Promise<void> {
  const nested = join(outDir, locale, '404', 'index.html');

  try {
    await rename(nested, join(outDir, locale, '404.html'));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`expected emitted error page at ${nested} | received: ${reason}`);
  }

  await rm(join(outDir, locale, '404'), { recursive: true, force: true });
}

/**
 * Astro integration that flat-emits the localized 404 page after the build.
 *
 * @example integrations: [flatLocalizedNotFound('en')]
 */
export function flatLocalizedNotFound(locale: string): AstroIntegration {
  return {
    name: 'flat-localized-not-found',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        await flattenLocalizedNotFound(fileURLToPath(dir), locale);
      },
    },
  };
}
