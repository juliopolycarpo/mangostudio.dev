import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

import {
  extractInlineStyleBlocks,
  extractLoadedExternalUrls,
  extractRemoteCssUrls,
} from './audit-static-site';

export interface PageTarget {
  label: string;
  path: string;
}

export interface PagePayload {
  label: string;
  path: string;
  htmlRawBytes: number;
  htmlGzipBytes: number;
  linkedCssRawBytes: number;
  linkedCssGzipBytes: number;
  inlineCssRawBytes: number;
  inlineCssGzipBytes: number;
}

export interface AssetPayload {
  path: string;
  rawBytes: number;
  gzipBytes: number;
}

export interface RemoteRuntimeAsset {
  sourcePath: string;
  context: 'html' | 'inline-css' | 'css';
  url: string;
}

export interface StaticPayloadReport {
  pages: PagePayload[];
  cssAssets: AssetPayload[];
  jsAssets: AssetPayload[];
  woff2Assets: AssetPayload[];
  remoteRuntimeAssets: RemoteRuntimeAsset[];
}

export interface StaticPayloadBudgets {
  pageHtmlGzipBytes: Record<string, number>;
  maxJsAssetGzipBytes: number;
  maxTotalJsGzipBytes: number;
  maxCssAssetGzipBytes: number;
  maxTotalCssGzipBytes: number;
  expectedWoff2AssetCount: number;
  maxWoff2AssetRawBytes: number;
  maxTotalWoff2RawBytes: number;
  maxRemoteRuntimeAssets: number;
}

export interface StaticPayloadBudgetRow {
  label: string;
  actual: number;
  limit: number | null;
  unit: 'bytes' | 'count';
  comparison: 'max' | 'exact';
  passed: boolean;
}

const DEFAULT_DIST_DIR = 'dist';
const KIB = 1024;
const PAGE_TARGETS: readonly PageTarget[] = [
  { label: 'home HTML', path: 'index.html' },
  { label: 'English home HTML', path: 'en/index.html' },
  { label: 'quickstart docs HTML', path: 'docs/quickstart/index.html' },
  { label: 'releases HTML', path: 'releases/index.html' },
];
export const STATIC_PAYLOAD_BUDGETS: StaticPayloadBudgets = {
  pageHtmlGzipBytes: {
    'index.html': 20 * KIB,
    'en/index.html': 20 * KIB,
    'docs/quickstart/index.html': 16 * KIB,
    'releases/index.html': 16 * KIB,
  },
  maxJsAssetGzipBytes: 5 * KIB,
  maxTotalJsGzipBytes: 8 * KIB,
  maxCssAssetGzipBytes: 8 * KIB,
  maxTotalCssGzipBytes: 16 * KIB,
  expectedWoff2AssetCount: 4,
  maxWoff2AssetRawBytes: 35 * KIB,
  maxTotalWoff2RawBytes: 112 * KIB,
  maxRemoteRuntimeAssets: 0,
};

export async function collectStaticPayloadReport(
  distDir = DEFAULT_DIST_DIR,
  pages: readonly PageTarget[] = PAGE_TARGETS
): Promise<StaticPayloadReport> {
  const pagePayloads = await Promise.all(pages.map((page) => collectPagePayload(distDir, page)));
  const assets = await collectAstroAssets(distDir);

  return {
    pages: pagePayloads,
    cssAssets: assets.filter((asset) => extname(asset.path) === '.css'),
    jsAssets: assets.filter((asset) => extname(asset.path) === '.js'),
    woff2Assets: assets.filter((asset) => extname(asset.path) === '.woff2'),
    remoteRuntimeAssets: await collectRemoteRuntimeAssets(distDir),
  };
}

export function formatStaticPayloadReport(report: StaticPayloadReport): string {
  return [
    '## Static payload report',
    '',
    '| Page | HTML raw | HTML gzip | linked CSS raw | linked CSS gzip | inline CSS raw | inline CSS gzip | first-load raw | first-load gzip | repeat gzip |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...report.pages.map(formatPagePayload),
    '',
    '| Asset | Raw | Gzip |',
    '| --- | ---: | ---: |',
    ...[...report.cssAssets, ...report.jsAssets, ...report.woff2Assets].map(formatAssetPayload),
    '',
    '| Remote runtime asset | Source | Context |',
    '| --- | --- | --- |',
    ...formatRemoteRuntimeAssets(report.remoteRuntimeAssets),
    '',
  ].join('\n');
}

export function collectStaticPayloadBudgetRows(
  report: StaticPayloadReport,
  budgets = STATIC_PAYLOAD_BUDGETS
): StaticPayloadBudgetRow[] {
  const rows: StaticPayloadBudgetRow[] = [];

  for (const page of report.pages) {
    rows.push(
      createBudgetRow(
        `${page.label} gzip`,
        page.htmlGzipBytes,
        budgets.pageHtmlGzipBytes[page.path] ?? null,
        'bytes',
        'max'
      )
    );
  }

  for (const asset of report.jsAssets) {
    rows.push(
      createBudgetRow(
        `${asset.path} JS gzip`,
        asset.gzipBytes,
        budgets.maxJsAssetGzipBytes,
        'bytes',
        'max'
      )
    );
  }

  rows.push(
    createBudgetRow(
      'total JS gzip',
      sum(report.jsAssets.map((asset) => asset.gzipBytes)),
      budgets.maxTotalJsGzipBytes,
      'bytes',
      'max'
    )
  );

  for (const asset of report.cssAssets) {
    rows.push(
      createBudgetRow(
        `${asset.path} CSS gzip`,
        asset.gzipBytes,
        budgets.maxCssAssetGzipBytes,
        'bytes',
        'max'
      )
    );
  }

  rows.push(
    createBudgetRow(
      'total CSS gzip',
      sum(report.cssAssets.map((asset) => asset.gzipBytes)),
      budgets.maxTotalCssGzipBytes,
      'bytes',
      'max'
    )
  );

  rows.push(
    createBudgetRow(
      'emitted WOFF2 count',
      report.woff2Assets.length,
      budgets.expectedWoff2AssetCount,
      'count',
      'exact'
    )
  );

  for (const asset of report.woff2Assets) {
    rows.push(
      createBudgetRow(
        `${asset.path} WOFF2 raw`,
        asset.rawBytes,
        budgets.maxWoff2AssetRawBytes,
        'bytes',
        'max'
      )
    );
  }

  rows.push(
    createBudgetRow(
      'total WOFF2 raw',
      sum(report.woff2Assets.map((asset) => asset.rawBytes)),
      budgets.maxTotalWoff2RawBytes,
      'bytes',
      'max'
    )
  );

  rows.push(
    createBudgetRow(
      'remote runtime asset count',
      report.remoteRuntimeAssets.length,
      budgets.maxRemoteRuntimeAssets,
      'count',
      'max'
    )
  );

  return rows;
}

export function validateStaticPayloadBudgets(
  report: StaticPayloadReport,
  budgets = STATIC_PAYLOAD_BUDGETS
): string[] {
  const errors: string[] = [];

  for (const row of collectStaticPayloadBudgetRows(report, budgets)) {
    if (row.passed) {
      continue;
    }

    if (row.limit === null) {
      errors.push(`${row.label} has no configured static payload budget.`);
      continue;
    }

    const expected = row.comparison === 'exact' ? 'expected' : 'limit';
    errors.push(
      `${row.label} is ${formatBudgetValue(row.actual, row.unit)}; ${expected} is ${formatBudgetValue(
        row.limit,
        row.unit
      )}.`
    );
  }

  for (const asset of report.remoteRuntimeAssets) {
    errors.push(
      `${asset.sourcePath} ${formatRemoteRuntimeContext(
        asset.context
      )} loads remote runtime asset ${asset.url}.`
    );
  }

  return errors;
}

export function formatStaticPayloadBudgetResult(
  report: StaticPayloadReport,
  budgets = STATIC_PAYLOAD_BUDGETS
): string {
  const rows = collectStaticPayloadBudgetRows(report, budgets);
  const lines = [
    '## Static payload budgets',
    '',
    '| Budget | Actual | Limit | Status |',
    '| --- | ---: | ---: | --- |',
    ...rows.map(formatBudgetRow),
    '',
  ];
  const errors = validateStaticPayloadBudgets(report, budgets);

  if (errors.length === 0) {
    lines.push('[ok] Static payload budgets passed.', '');
    return lines.join('\n');
  }

  lines.push('[fail] Static payload budgets failed.');

  for (const error of errors) {
    lines.push(`- ${error}`);
  }

  lines.push('');
  return lines.join('\n');
}

export function extractStylesheetHrefs(html: string): string[] {
  const hrefs = new Set<string>();
  const linkPattern = /<link\b(?=[^>]*\brel=(["'])stylesheet\1)[^>]*>/gi;
  let match = linkPattern.exec(html);

  while (match !== null) {
    const tag = match[0] ?? '';
    const hrefMatch = /\bhref=(["'])([^"']+)\1/i.exec(tag);
    const href = hrefMatch?.[2];

    if (href !== undefined) {
      hrefs.add(href);
    }

    match = linkPattern.exec(html);
  }

  return [...hrefs].sort();
}

export function extractInlineStyleText(html: string): string {
  return Array.from(html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi), (match) => {
    return match[1] ?? '';
  }).join('\n');
}

export function gzipByteLength(input: string | Uint8Array): number {
  if (input.length === 0) {
    return 0;
  }

  return gzipSync(input, { level: 9 }).byteLength;
}

export function formatBytes(bytes: number): string {
  return `${bytes} B (${(bytes / KIB).toFixed(1)} KiB)`;
}

async function collectPagePayload(distDir: string, page: PageTarget): Promise<PagePayload> {
  const html = await readFile(join(distDir, page.path), 'utf8');
  const stylesheetHrefs = extractStylesheetHrefs(html);
  const inlineStyleText = extractInlineStyleText(html);
  const linkedCssAssets = await Promise.all(
    stylesheetHrefs.map((href) => readLinkedStylesheet(distDir, href))
  );

  return {
    label: page.label,
    path: page.path,
    htmlRawBytes: Buffer.byteLength(html),
    htmlGzipBytes: gzipByteLength(html),
    linkedCssRawBytes: sum(linkedCssAssets.map((asset) => asset.rawBytes)),
    linkedCssGzipBytes: sum(linkedCssAssets.map((asset) => asset.gzipBytes)),
    inlineCssRawBytes: Buffer.byteLength(inlineStyleText),
    inlineCssGzipBytes: gzipByteLength(inlineStyleText),
  };
}

async function readLinkedStylesheet(distDir: string, href: string): Promise<AssetPayload> {
  if (!href.startsWith('/')) {
    throw new Error(`Stylesheet href must be root-relative: ${href}`);
  }

  if (href.includes('..')) {
    throw new Error(`Stylesheet href must not traverse directories: ${href}`);
  }

  const path = href.slice(1);
  const bytes = await readFile(join(distDir, path));

  return {
    path,
    rawBytes: bytes.byteLength,
    gzipBytes: gzipByteLength(bytes),
  };
}

async function collectAstroAssets(distDir: string): Promise<AssetPayload[]> {
  const astroDir = join(distDir, '_astro');
  const entries = await readdir(astroDir, { withFileTypes: true });
  const assets = await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isFile()) {
        return null;
      }

      const extension = extname(entry.name);

      if (extension !== '.css' && extension !== '.js' && extension !== '.woff2') {
        return null;
      }

      const path = join('_astro', entry.name);
      const absolutePath = join(distDir, path);
      const bytes = await readFile(absolutePath);

      return {
        path,
        rawBytes: bytes.byteLength,
        gzipBytes: gzipByteLength(bytes),
      };
    })
  );

  return assets
    .filter((asset): asset is AssetPayload => asset !== null)
    .sort((left, right) => left.path.localeCompare(right.path));
}

async function collectRemoteRuntimeAssets(distDir: string): Promise<RemoteRuntimeAsset[]> {
  const assets: RemoteRuntimeAsset[] = [];
  const files = await walkFiles(distDir);

  for (const file of files) {
    const extension = extname(file);

    if (extension !== '.html' && extension !== '.css') {
      continue;
    }

    const sourcePath = toPosix(relative(distDir, file));
    const text = await readFile(file, 'utf8');

    if (extension === '.html') {
      for (const url of extractLoadedExternalUrls(text)) {
        assets.push({ sourcePath, context: 'html', url });
      }

      for (const styleBlock of extractInlineStyleBlocks(text)) {
        for (const url of extractRemoteCssUrls(styleBlock)) {
          assets.push({ sourcePath, context: 'inline-css', url });
        }
      }

      continue;
    }

    for (const url of extractRemoteCssUrls(text)) {
      assets.push({ sourcePath, context: 'css', url });
    }
  }

  return assets.sort((left, right) => {
    const pathOrder = left.sourcePath.localeCompare(right.sourcePath);

    if (pathOrder !== 0) {
      return pathOrder;
    }

    return left.url.localeCompare(right.url);
  });
}

async function walkFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function visit(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const absolutePath = join(dir, entry.name);

      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }

      if (entry.isFile()) {
        files.push(absolutePath);
      }
    }
  }

  await visit(root);
  return files.sort();
}

function formatPagePayload(page: PagePayload): string {
  const firstLoadRawBytes = page.htmlRawBytes + page.linkedCssRawBytes;
  const firstLoadGzipBytes = page.htmlGzipBytes + page.linkedCssGzipBytes;

  return `| ${[
    page.label,
    page.htmlRawBytes,
    page.htmlGzipBytes,
    page.linkedCssRawBytes,
    page.linkedCssGzipBytes,
    page.inlineCssRawBytes,
    page.inlineCssGzipBytes,
    firstLoadRawBytes,
    firstLoadGzipBytes,
    page.htmlGzipBytes,
  ].join(' | ')} |`;
}

function formatAssetPayload(asset: AssetPayload): string {
  return `| ${asset.path} | ${asset.rawBytes} | ${asset.gzipBytes} |`;
}

function formatRemoteRuntimeAssets(assets: readonly RemoteRuntimeAsset[]): string[] {
  if (assets.length === 0) {
    return ['| none | - | - |'];
  }

  return assets.map((asset) => {
    return `| ${asset.url} | ${asset.sourcePath} | ${formatRemoteRuntimeContext(asset.context)} |`;
  });
}

function createBudgetRow(
  label: string,
  actual: number,
  limit: number | null,
  unit: StaticPayloadBudgetRow['unit'],
  comparison: StaticPayloadBudgetRow['comparison']
): StaticPayloadBudgetRow {
  const passed = limit !== null && (comparison === 'exact' ? actual === limit : actual <= limit);

  return { label, actual, limit, unit, comparison, passed };
}

function formatBudgetRow(row: StaticPayloadBudgetRow): string {
  const limit = row.limit === null ? 'unconfigured' : formatBudgetValue(row.limit, row.unit);

  return `| ${row.label} | ${formatBudgetValue(row.actual, row.unit)} | ${limit} | ${
    row.passed ? 'ok' : 'fail'
  } |`;
}

function formatBudgetValue(value: number, unit: StaticPayloadBudgetRow['unit']): string {
  if (unit === 'count') {
    return String(value);
  }

  return formatBytes(value);
}

function formatRemoteRuntimeContext(context: RemoteRuntimeAsset['context']): string {
  if (context === 'inline-css') {
    return 'inline CSS';
  }

  return context.toUpperCase();
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function toPosix(path: string): string {
  return path.replaceAll('\\', '/');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const positionalArgs = args.filter((arg) => arg !== '--check');
  const distDir = positionalArgs[0] ?? DEFAULT_DIST_DIR;

  if (positionalArgs.length > 1) {
    process.stderr.write('Usage: bun ./scripts/report-static-payloads.ts [dist-dir] [--check]\n');
    process.exitCode = 1;
    return;
  }

  const report = await collectStaticPayloadReport(distDir);

  process.stdout.write(formatStaticPayloadReport(report));

  if (!check) {
    return;
  }

  process.stdout.write(`\n${formatStaticPayloadBudgetResult(report)}`);

  if (validateStaticPayloadBudgets(report).length > 0) {
    process.exitCode = 1;
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';

if (import.meta.url === entrypoint) {
  await main();
}
