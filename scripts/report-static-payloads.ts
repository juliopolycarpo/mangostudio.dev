import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

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

export interface StaticPayloadReport {
  pages: PagePayload[];
  cssAssets: AssetPayload[];
  jsAssets: AssetPayload[];
}

const DEFAULT_DIST_DIR = 'dist';
const PAGE_TARGETS: readonly PageTarget[] = [
  { label: 'home HTML', path: 'index.html' },
  { label: 'English home HTML', path: 'en/index.html' },
  { label: 'quickstart docs HTML', path: 'docs/quickstart/index.html' },
  { label: 'releases HTML', path: 'releases/index.html' },
];

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
    ...[...report.cssAssets, ...report.jsAssets].map(formatAssetPayload),
    '',
  ].join('\n');
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

      if (extension !== '.css' && extension !== '.js') {
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

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

async function main(): Promise<void> {
  const distDir = process.argv[2] ?? DEFAULT_DIST_DIR;
  const report = await collectStaticPayloadReport(distDir);

  process.stdout.write(formatStaticPayloadReport(report));
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';

if (import.meta.url === entrypoint) {
  await main();
}
