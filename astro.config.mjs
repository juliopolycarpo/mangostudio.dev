// @ts-check
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

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
  // Fully static output — no adapter. Cloudflare serves ./dist as Workers static assets.
  integrations: [sitemap()],
});
