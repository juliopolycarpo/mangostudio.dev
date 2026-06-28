import { deepStrictEqual, strictEqual } from 'node:assert/strict';

import {
  extractInlineStyleText,
  extractStylesheetHrefs,
  formatStaticPayloadReport,
  gzipByteLength,
  type StaticPayloadReport,
} from './report-static-payloads';

run('extractStylesheetHrefs returns unique sorted stylesheet links', () => {
  const html = `
    <link href="/_astro/Home.css" rel="stylesheet">
    <link rel="preload" href="/_astro/Home.css">
    <link rel="stylesheet" href="/_astro/Base.css">
    <link rel="stylesheet" href="/_astro/Base.css">
  `;

  deepStrictEqual(extractStylesheetHrefs(html), ['/_astro/Base.css', '/_astro/Home.css']);
});

run('extractInlineStyleText joins inline style payloads', () => {
  const html = '<style>.base{display:block}</style><main></main><style>.page{color:red}</style>';

  strictEqual(extractInlineStyleText(html), '.base{display:block}\n.page{color:red}');
});

run('gzipByteLength treats empty payloads as zero bytes', () => {
  strictEqual(gzipByteLength(''), 0);
  strictEqual(gzipByteLength(new Uint8Array()), 0);
  strictEqual(gzipByteLength('hello') > 0, true);
});

run('formatStaticPayloadReport includes first-load and repeat estimates', () => {
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
    ].join('\n')
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
