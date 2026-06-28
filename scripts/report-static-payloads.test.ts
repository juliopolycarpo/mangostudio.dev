import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  collectStaticPayloadReport,
  extractInlineStyleText,
  extractStylesheetHrefs,
  formatStaticPayloadBudgetResult,
  formatStaticPayloadReport,
  gzipByteLength,
  type StaticPayloadBudgets,
  type StaticPayloadReport,
  validateStaticPayloadBudgets,
} from './report-static-payloads';

await run('extractStylesheetHrefs returns unique sorted stylesheet links', () => {
  const html = `
    <link href="/_astro/Home.css" rel="stylesheet">
    <link rel="preload" href="/_astro/Home.css">
    <link rel="stylesheet" href="/_astro/Base.css">
    <link rel="stylesheet" href="/_astro/Base.css">
  `;

  deepStrictEqual(extractStylesheetHrefs(html), ['/_astro/Base.css', '/_astro/Home.css']);
});

await run('extractInlineStyleText joins inline style payloads', () => {
  const html = '<style>.base{display:block}</style><main></main><style>.page{color:red}</style>';

  strictEqual(extractInlineStyleText(html), '.base{display:block}\n.page{color:red}');
});

await run('gzipByteLength treats empty payloads as zero bytes', () => {
  strictEqual(gzipByteLength(''), 0);
  strictEqual(gzipByteLength(new Uint8Array()), 0);
  strictEqual(gzipByteLength('hello') > 0, true);
});

await run('formatStaticPayloadReport includes first-load, repeat, and remote summaries', () => {
  const report: StaticPayloadReport = {
    pages: [
      {
        label: 'home HTML',
        path: 'index.html',
        htmlRawBytes: 100,
        htmlGzipBytes: 40,
        linkedCssRawBytes: 30,
        linkedCssGzipBytes: 12,
        inlineCssRawBytes: 0,
        inlineCssGzipBytes: 0,
      },
    ],
    cssAssets: [{ path: '_astro/Home.css', rawBytes: 30, gzipBytes: 12 }],
    jsAssets: [{ path: '_astro/Base.js', rawBytes: 20, gzipBytes: 10 }],
    woff2Assets: [],
    remoteRuntimeAssets: [],
  };

  strictEqual(
    formatStaticPayloadReport(report),
    [
      '## Static payload report',
      '',
      '| Page | HTML raw | HTML gzip | linked CSS raw | linked CSS gzip | inline CSS raw | inline CSS gzip | first-load raw | first-load gzip | repeat gzip |',
      '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
      '| home HTML | 100 | 40 | 30 | 12 | 0 | 0 | 130 | 52 | 40 |',
      '',
      '| Asset | Raw | Gzip |',
      '| --- | ---: | ---: |',
      '| _astro/Home.css | 30 | 12 |',
      '| _astro/Base.js | 20 | 10 |',
      '',
      '| Remote runtime asset | Source | Context |',
      '| --- | --- | --- |',
      '| none | - | - |',
      '',
    ].join('\n')
  );
});

await run('collectStaticPayloadReport includes WOFF2 and remote runtime assets', async () => {
  const distDir = await mkdtemp(join(tmpdir(), 'mango-payloads-'));

  try {
    await mkdir(join(distDir, '_astro'));
    await writeFile(
      join(distDir, 'index.html'),
      [
        '<!doctype html>',
        '<link rel="stylesheet" href="/_astro/site.css">',
        '<script src="https://cdn.example.com/app.js"></script>',
        '<style>.hero{background:url("https://cdn.example.com/inline.png")}</style>',
      ].join('')
    );
    await writeFile(
      join(distDir, '_astro', 'site.css'),
      '.remote{background:url(//cdn.example.com/bg.png)}'
    );
    await writeFile(join(distDir, '_astro', 'main.js'), 'console.warn("loaded");');
    await writeFile(join(distDir, '_astro', 'geist-latin-wght-normal.woff2'), 'font-bytes');

    const report = await collectStaticPayloadReport(distDir, [
      { label: 'fixture home', path: 'index.html' },
    ]);

    deepStrictEqual(
      report.cssAssets.map((asset) => asset.path),
      ['_astro/site.css']
    );
    deepStrictEqual(
      report.jsAssets.map((asset) => asset.path),
      ['_astro/main.js']
    );
    deepStrictEqual(
      report.woff2Assets.map((asset) => asset.path),
      ['_astro/geist-latin-wght-normal.woff2']
    );
    deepStrictEqual(
      report.remoteRuntimeAssets.map(
        (asset) => `${asset.sourcePath}:${asset.context}:${asset.url}`
      ),
      [
        '_astro/site.css:css://cdn.example.com/bg.png',
        'index.html:html:https://cdn.example.com/app.js',
        'index.html:inline-css:https://cdn.example.com/inline.png',
      ]
    );
  } finally {
    await rm(distDir, { recursive: true, force: true });
  }
});

await run('validateStaticPayloadBudgets accepts a report within limits', () => {
  const report = createBudgetReport();
  const budgets = createBudgets();

  deepStrictEqual(validateStaticPayloadBudgets(report, budgets), []);
  ok(
    formatStaticPayloadBudgetResult(report, budgets).includes('[ok] Static payload budgets passed.')
  );
});

await run('validateStaticPayloadBudgets rejects size, count, and remote regressions', () => {
  const report = createBudgetReport({
    htmlGzipBytes: 120,
    jsGzipBytes: 80,
    woff2Assets: [{ path: '_astro/font.woff2', rawBytes: 90, gzipBytes: 91 }],
    remoteRuntimeAssets: [
      { sourcePath: 'index.html', context: 'html', url: 'https://cdn.example.com/app.js' },
    ],
  });
  const budgets = { ...createBudgets(), expectedWoff2AssetCount: 2 };
  const errors = validateStaticPayloadBudgets(report, budgets);

  ok(errors.some((error) => error.includes('home HTML gzip')));
  ok(errors.some((error) => error.includes('_astro/main.js JS gzip')));
  ok(errors.some((error) => error.includes('emitted WOFF2 count')));
  ok(errors.some((error) => error.includes('_astro/font.woff2 WOFF2 raw')));
  ok(errors.some((error) => error.includes('remote runtime asset count')));
  ok(errors.some((error) => error.includes('https://cdn.example.com/app.js')));
  ok(formatStaticPayloadBudgetResult(report, budgets).includes('[fail]'));
});

function createBudgetReport(
  overrides: Partial<{
    htmlGzipBytes: number;
    jsGzipBytes: number;
    woff2Assets: StaticPayloadReport['woff2Assets'];
    remoteRuntimeAssets: StaticPayloadReport['remoteRuntimeAssets'];
  }> = {}
): StaticPayloadReport {
  return {
    pages: [
      {
        label: 'home HTML',
        path: 'index.html',
        htmlRawBytes: 100,
        htmlGzipBytes: overrides.htmlGzipBytes ?? 50,
        linkedCssRawBytes: 10,
        linkedCssGzipBytes: 5,
        inlineCssRawBytes: 0,
        inlineCssGzipBytes: 0,
      },
    ],
    cssAssets: [{ path: '_astro/site.css', rawBytes: 60, gzipBytes: 30 }],
    jsAssets: [{ path: '_astro/main.js', rawBytes: 70, gzipBytes: overrides.jsGzipBytes ?? 40 }],
    woff2Assets: overrides.woff2Assets ?? [
      { path: '_astro/font.woff2', rawBytes: 60, gzipBytes: 61 },
    ],
    remoteRuntimeAssets: overrides.remoteRuntimeAssets ?? [],
  };
}

function createBudgets(): StaticPayloadBudgets {
  return {
    pageHtmlGzipBytes: { 'index.html': 100 },
    maxJsAssetGzipBytes: 60,
    maxTotalJsGzipBytes: 60,
    maxCssAssetGzipBytes: 50,
    maxTotalCssGzipBytes: 50,
    expectedWoff2AssetCount: 1,
    maxWoff2AssetRawBytes: 80,
    maxTotalWoff2RawBytes: 80,
    maxRemoteRuntimeAssets: 0,
  };
}

async function run(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    process.stdout.write(`[ok] ${name}\n`);
  } catch (error) {
    process.stderr.write(`[fail] ${name}\n`);
    throw error;
  }
}
