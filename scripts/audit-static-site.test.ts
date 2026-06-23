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

run('extractRemoteCssUrls reports remote CSS url() assets', () => {
  deepStrictEqual(
    extractRemoteCssUrls(`
      .local { background: url("/local.svg"); }
      .remote { background: url("https://cdn.example.com/asset.svg"); }
    `),
    ['https://cdn.example.com/asset.svg']
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
