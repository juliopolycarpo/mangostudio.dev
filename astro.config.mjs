// @ts-check
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import { flatLocalizedNotFound, isNotFoundUrl } from './scripts/localized-not-found.ts';

// Shiki's github-dark comment gray (#6a737d) is 3.05:1 on the #24292e code background,
// below the 4.5:1 AA minimum. Astro 7's `shikiConfig` schema drops `colorReplacements`,
// and a CSS override would have to fight inline styles with !important, so retint the
// token itself. Only comment scopes use that color in github-dark, so no other token
// color changes and the theme stays put. #959da5 is GitHub's own bright black (5.34:1).
const GITHUB_DARK_COMMENT = '#6a737d';
const ACCESSIBLE_COMMENT = '#959da5';

/**
 * Shiki transformer that lifts comment tokens to an accessible color.
 * Usage: `shikiConfig: { transformers: [commentContrastTransformer()] }`
 */
function commentContrastTransformer() {
  return {
    name: 'comment-contrast',
    /** @param {{ color?: string }[][]} lines Shiki tokens grouped by source line. */
    tokens(lines) {
      for (const line of lines) {
        for (const token of line) {
          if (token.color?.toLowerCase() === GITHUB_DARK_COMMENT) token.color = ACCESSIBLE_COMMENT;
        }
      }
    },
  };
}

// https://astro.build/config
export default defineConfig({
  site: 'https://mangostudio.dev',
  // Portuguese is the primary locale (served at /), English is served under /en/.
  i18n: {
    locales: ['pt', 'en'],
    defaultLocale: 'pt',
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
    },
  },
  // HTML is served with max-age=0, must-revalidate and no validator, so the browser re-downloads a
  // prefetched page on click. Re-enable only once HTML can be reused (see _headers).
  prefetch: false,
  build: {
    // Emit dist/<route>/index.html so Cloudflare's auto-trailing-slash handling works cleanly.
    format: 'directory',
    // Let small styles inline while larger shared styles emit as cacheable assets.
    inlineStylesheets: 'auto',
  },
  // Bare /docs redirects live in public/_redirects (an HTTP redirect, not a meta-refresh page).
  markdown: {
    shikiConfig: {
      transformers: [commentContrastTransformer()],
    },
  },
  // Fully static output — no adapter. Cloudflare serves ./dist as Workers static assets.
  // The error pages are noindex, so keep them out of the sitemap; `en/404.html` is emitted flat
  // so Cloudflare's nearest-404 lookup finds it for /en/* misses.
  integrations: [sitemap({ filter: (page) => !isNotFoundUrl(page) }), flatLocalizedNotFound('en')],
});
