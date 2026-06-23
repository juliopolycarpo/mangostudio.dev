import { deepStrictEqual } from 'node:assert/strict';
import {
  extractLoadedExternalUrls,
  extractRemoteCssUrls,
  stripJsonComments,
} from './audit-static-site';

run('stripJsonComments preserves strings while removing comments', () => {
  const jsonc = `{
    // comment
    "url": "https://example.com//not-a-comment",
    /* block */
    "enabled": true
  }`;

  deepStrictEqual(JSON.parse(stripJsonComments(jsonc)), {
    url: 'https://example.com//not-a-comment',
    enabled: true,
  });
});

run('extractLoadedExternalUrls reports only externally loaded assets', () => {
  const html = `
    <a href="https://github.com/juliopolycarpo/mangostudio">GitHub</a>
    <script type="module" src="/_astro/index.js"></script>
    <link rel="canonical" href="https://mangostudio.dev/docs">
    <link rel="stylesheet" href="https://cdn.example.com/site.css">
    <img src="//cdn.example.com/logo.png" alt="">
  `;

  deepStrictEqual(extractLoadedExternalUrls(html), [
    '//cdn.example.com/logo.png',
    'https://cdn.example.com/site.css',
  ]);
});

run('extractLoadedExternalUrls reports remote srcset candidates', () => {
  const html = `
    <img src="/_astro/logo.png" srcset="/_astro/logo-1x.png 1x, https://cdn.example.com/logo-2x.png 2x">
    <source srcset="//cdn.example.com/wide.avif 1280w" type="image/avif">
    <link rel="preload" as="image" imagesrcset="https://cdn.example.com/hero.webp 2x">
  `;

  deepStrictEqual(extractLoadedExternalUrls(html), [
    '//cdn.example.com/wide.avif',
    'https://cdn.example.com/hero.webp',
    'https://cdn.example.com/logo-2x.png',
  ]);
});

run('extractRemoteCssUrls reports remote CSS url() assets', () => {
  deepStrictEqual(
    extractRemoteCssUrls(`
      .local { background: url("/local.svg"); }
      .remote { background: url("https://cdn.example.com/asset.svg"); }
      .proto { background: url(//cdn.example.com/proto.svg); }
    `),
    ['//cdn.example.com/proto.svg', 'https://cdn.example.com/asset.svg']
  );
});

function run(name: string, fn: () => void): void {
  try {
    fn();
    process.stdout.write(`[ok] ${name}\n`);
  } catch (error) {
    process.stderr.write(`[fail] ${name}\n`);
    throw error;
  }
}
