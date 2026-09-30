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
  prefetch: {
    prefetchAll: false,
  },
  build: {
    // Emit dist/<route>/index.html so Cloudflare's auto-trailing-slash handling works cleanly.
    format: 'directory',
    // Let small styles inline while larger shared styles emit as cacheable assets.
    inlineStylesheets: 'auto',
  },
  // Bare /docs lands on the quickstart entry point in each locale.
  redirects: {
    '/docs': '/docs/quickstart',
    '/en/docs': '/en/docs/quickstart',
  },
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
