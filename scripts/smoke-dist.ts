import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { en } from '../src/i18n/en';
import { pt } from '../src/i18n/pt';
import type { Lang } from '../src/i18n/types';
import { routes } from '../src/i18n/ui';

const CANONICAL_ORIGIN = 'https://mangostudio.dev';
const CONTENT_BY_LANG = { pt, en } satisfies LocaleRouteContent;

interface SmokeSection {
  name: string;
  errors: string[];
}

interface DocRouteItem {
  id: string;
}

interface DocRouteGroup {
  items: readonly DocRouteItem[];
}

type LocaleRouteContent = Record<
  Lang,
  {
    docs: {
      groups: readonly DocRouteGroup[];
      plannedBadge: string;
    };
  }
>;

export function deriveRequiredDistFiles(contentByLang: LocaleRouteContent): string[] {
  const files = new Set([
    '404.html',
    'robots.txt',
    'sitemap-index.xml',
    routeToDistFile(routes.home('pt')),
    routeToDistFile(routes.home('en')),
    routeToDistFile(routes.releases('pt')),
    routeToDistFile(routes.releases('en')),
    'site.webmanifest',
  ]);

  for (const [lang, content] of Object.entries(contentByLang) as [
    Lang,
    LocaleRouteContent[Lang],
  ][]) {
    for (const docId of deriveDocIds(content.docs.groups)) {
      files.add(routeToDistFile(routes.doc(lang, docId)));
    }
  }

  return [...files].sort();
}

export function deriveDocIds(groups: readonly DocRouteGroup[]): string[] {
  const ids = new Set<string>();

  for (const group of groups) {
    for (const item of group.items) {
      ids.add(item.id);
    }
  }

  return [...ids].sort();
}

export function redirectHtmlReferencesTarget(
  html: string,
  target: string,
  canonicalOrigin = CANONICAL_ORIGIN
): boolean {
  const normalizedTarget = normalizeRoutePath(target);
  const hrefs = extractAnchorHrefs(html);
  const metaRefreshTargets = extractMetaRefreshTargets(html);

  return (
    hrefs.includes(normalizedTarget) &&
    metaRefreshTargets.includes(normalizedTarget) &&
    html.includes(`href="${canonicalOrigin}${normalizedTarget}"`)
  );
}

export function extractRouteIntegrityHrefs(html: string): string[] {
  const hrefs = new Set<string>();

  for (const href of extractAnchorHrefs(html, (tag) => /\bdata-cmdk-item\b/i.test(tag))) {
    hrefs.add(href);
  }

  for (const className of ['docs-sidebar', 'site-footer']) {
    const block = extractElementWithClass(html, className);

    if (!block) {
      continue;
    }

    for (const href of extractAnchorHrefs(block)) {
      hrefs.add(href);
    }
  }

  return [...hrefs].sort();
}

export function resolveInternalHrefToDistFile(
  href: string,
  canonicalOrigin = CANONICAL_ORIGIN
): string | null {
  const clean = decodeHtmlAttribute(href).trim();

  if (
    clean === '' ||
    clean.startsWith('#') ||
    clean.startsWith('//') ||
    /^(?:mailto|tel|javascript):/i.test(clean)
  ) {
    return null;
  }

  let pathname: string;

  if (/^https?:\/\//i.test(clean)) {
    try {
      const url = new URL(clean);

      if (url.origin !== canonicalOrigin) {
        return null;
      }

      pathname = url.pathname;
    } catch {
      return null;
    }
  } else {
    const [pathPart = ''] = clean.split(/[?#]/);
    pathname = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  }

  return routeToDistFile(pathname);
}

export function containsCanonicalOrigin(text: string, canonicalOrigin = CANONICAL_ORIGIN): boolean {
  return extractUrlOrigins(text).some((origin) => origin === canonicalOrigin);
}

export function findNonCanonicalOrigins(
  text: string,
  canonicalOrigin = CANONICAL_ORIGIN
): string[] {
  return extractUrlOrigins(text).filter((origin) => origin !== canonicalOrigin);
}

async function runSmoke(repoRoot: string): Promise<SmokeSection[]> {
  const distDir = join(repoRoot, 'dist');

  return [
    await smokeRequiredRoutes(distDir),
    await smokeRedirects(distDir),
    await smokeReadyDocs(distDir),
    await smokeNotFoundLinks(distDir),
    await smokeCanonicalHosts(distDir),
    await smokeInternalLinkGraph(distDir),
  ];
}

async function smokeRequiredRoutes(distDir: string): Promise<SmokeSection> {
  const errors: string[] = [];

  if (!(await fileExists(distDir))) {
    return {
      name: 'Required route files',
      errors: ['dist/ is missing; run bun run build before bun run smoke:dist.'],
    };
  }

  for (const relativePath of deriveRequiredDistFiles(CONTENT_BY_LANG)) {
    if (!(await fileExists(join(distDir, relativePath)))) {
      errors.push(`dist/${relativePath} is missing from the static build.`);
    }
  }

  return { name: 'Required route files', errors };
}

async function smokeRedirects(distDir: string): Promise<SmokeSection> {
  const errors: string[] = [];
  const redirects = [
    { file: 'docs/index.html', target: '/docs/quickstart' },
    { file: 'en/docs/index.html', target: '/en/docs/quickstart' },
  ];

  for (const redirect of redirects) {
    const filePath = join(distDir, redirect.file);
    const html = await readTextFile(filePath, errors);

    if (!html) {
      continue;
    }

    if (!redirectHtmlReferencesTarget(html, redirect.target)) {
      errors.push(`dist/${redirect.file} must redirect to ${redirect.target}.`);
    }
  }

  return { name: 'Docs redirect output', errors };
}

async function smokeReadyDocs(distDir: string): Promise<SmokeSection> {
  const errors: string[] = [];
  const readyDocs = [
    { file: 'docs/quickstart/index.html', plannedBadge: pt.docs.plannedBadge },
    { file: 'en/docs/quickstart/index.html', plannedBadge: en.docs.plannedBadge },
  ];

  for (const doc of readyDocs) {
    const html = await readTextFile(join(distDir, doc.file), errors);

    if (!html) {
      continue;
    }

    // Scope the ready/planned checks to the article: the sidebar lists every
    // planned doc, so the planned badge and `docs-planned` marker appear all
    // over a ready page. Falling back to the whole document would flag a
    // correctly rendered page, so a missing article is itself the failure.
    const article = extractElementWithClass(html, 'docs-article');

    if (!article) {
      errors.push(`dist/${doc.file} is missing the docs-article container.`);
      continue;
    }

    if (article.includes('TODO')) {
      errors.push(`dist/${doc.file} must not contain TODO placeholder copy in the article.`);
    }

    if (article.includes(doc.plannedBadge) || /\bdocs-planned\b/.test(article)) {
      errors.push(`dist/${doc.file} must render ready content, not the planned-page state.`);
    }
  }

  return { name: 'Ready docs content', errors };
}

async function smokeNotFoundLinks(distDir: string): Promise<SmokeSection> {
  const errors: string[] = [];
  const html = await readTextFile(join(distDir, '404.html'), errors);
  const section = html ? (extractElementWithClass(html, 'nf') ?? html) : '';
  const hrefs = extractAnchorHrefs(section);

  if (!hrefs.some((href) => href === '/' || href === '/en/')) {
    errors.push('dist/404.html must link to a localized home route.');
  }

  if (!hrefs.some((href) => /^\/(?:en\/)?docs\//.test(href))) {
    errors.push('dist/404.html must link to a localized docs route.');
  }

  for (const href of hrefs) {
    const relativePath = resolveInternalHrefToDistFile(href);

    if (relativePath && !(await fileExists(join(distDir, relativePath)))) {
      errors.push(`dist/404.html links to ${href}, but dist/${relativePath} is missing.`);
    }
  }

  return { name: '404 links', errors };
}

async function smokeCanonicalHosts(distDir: string): Promise<SmokeSection> {
  const errors: string[] = [];
  const files = ['robots.txt', ...(await findSitemapFiles(distDir))];

  for (const file of files) {
    const text = await readTextFile(join(distDir, file), errors);

    if (!text) {
      continue;
    }

    const hostText = file.endsWith('.xml') ? extractXmlLocText(text) : text;

    if (!containsCanonicalOrigin(hostText)) {
      errors.push(`dist/${file} must reference ${CANONICAL_ORIGIN}.`);
    }

    for (const origin of findNonCanonicalOrigins(hostText)) {
      errors.push(`dist/${file} references non-canonical origin ${origin}.`);
    }
  }

  return { name: 'Sitemap and robots hosts', errors };
}

async function smokeInternalLinkGraph(distDir: string): Promise<SmokeSection> {
  const errors: string[] = [];
  const representativePages = [
    'index.html',
    'en/index.html',
    'releases/index.html',
    'en/releases/index.html',
    'docs/quickstart/index.html',
    'en/docs/quickstart/index.html',
  ];
  const seen = new Set<string>();

  for (const page of representativePages) {
    const html = await readTextFile(join(distDir, page), errors);

    if (!html) {
      continue;
    }

    for (const href of extractRouteIntegrityHrefs(html)) {
      const relativePath = resolveInternalHrefToDistFile(href);

      if (!relativePath) {
        continue;
      }

      const key = `${page}\0${href}\0${relativePath}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);

      if (!(await fileExists(join(distDir, relativePath)))) {
        errors.push(`dist/${page} links to ${href}, but dist/${relativePath} is missing.`);
      }
    }
  }

  return { name: 'Internal link graph', errors };
}

async function findSitemapFiles(distDir: string): Promise<string[]> {
  try {
    return (await readdir(distDir))
      .filter((entry) => /^sitemap(?:-\d+|-index)\.xml$/.test(entry))
      .sort();
  } catch {
    return ['sitemap-index.xml'];
  }
}

function routeToDistFile(route: string): string {
  const [pathWithoutQuery = '/'] = route.split(/[?#]/);
  const normalized = normalizeRoutePath(pathWithoutQuery);
  const trimmed = normalized.replace(/^\/+|\/+$/g, '');

  if (trimmed === '') {
    return 'index.html';
  }

  if (/\.[A-Za-z0-9]+$/.test(basename(trimmed))) {
    return trimmed;
  }

  return `${trimmed}/index.html`;
}

function normalizeRoutePath(pathname: string): string {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return normalized === '/' ? normalized : normalized.replace(/\/+$/g, '');
}

function extractMetaRefreshTargets(html: string): string[] {
  const targets = new Set<string>();
  const metaPattern = /<meta\b[^>]*>/gi;
  let match = metaPattern.exec(html);

  while (match !== null) {
    const attrs = parseAttributes(match[0] ?? '');
    const httpEquiv = attrs.get('http-equiv')?.toLowerCase();
    const content = attrs.get('content') ?? '';
    const target = /(?:^|;)\s*url=([^;]+)/i.exec(content)?.[1]?.trim();

    if (httpEquiv === 'refresh' && target) {
      targets.add(normalizeRoutePath(decodeHtmlAttribute(target)));
    }

    match = metaPattern.exec(html);
  }

  return [...targets].sort();
}

function extractXmlLocText(xml: string): string {
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)]
    .map((match) => decodeHtmlAttribute(match[1] ?? ''))
    .join('\n');
}

function extractUrlOrigins(text: string): string[] {
  const origins = new Set<string>();
  const urlPattern = /\bhttps?:\/\/[^\s"'<>),]+/gi;
  let match = urlPattern.exec(text);

  while (match !== null) {
    try {
      origins.add(new URL(match[0] ?? '').origin);
    } catch {
      // Ignore malformed URL-like text; host checks are for emitted absolute URLs.
    }

    match = urlPattern.exec(text);
  }

  return [...origins].sort();
}

function extractAnchorHrefs(
  html: string,
  predicate: (tag: string, attrs: Map<string, string>) => boolean = () => true
): string[] {
  const hrefs = new Set<string>();
  const anchorPattern = /<a\b[^>]*>/gi;
  let match = anchorPattern.exec(html);

  while (match !== null) {
    const tag = match[0] ?? '';
    const attrs = parseAttributes(tag);
    const href = attrs.get('href');

    if (href && predicate(tag, attrs)) {
      hrefs.add(decodeHtmlAttribute(href));
    }

    match = anchorPattern.exec(html);
  }

  return [...hrefs].sort();
}

function extractElementWithClass(html: string, className: string): string | undefined {
  // Match `className` as a whole class token. `\b` treats `-` as a boundary, so
  // a query for `nf` would also match `nf-code`; gate on chars that cannot be
  // part of a class token (whitespace or the surrounding quote) instead.
  const pattern = new RegExp(
    `<([A-Za-z][A-Za-z0-9]*)\\b[^>]*\\bclass=(["'])[^"']*(?<![\\w-])${escapeRegExp(
      className
    )}(?![\\w-])[^"']*\\2[^>]*>[\\s\\S]*?<\\/\\1>`,
    'i'
  );

  return pattern.exec(html)?.[0];
}

function parseAttributes(tag: string): Map<string, string> {
  const attrs = new Map<string, string>();
  const attrPattern = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match = attrPattern.exec(tag);

  while (match !== null) {
    const name = match[1]?.toLowerCase();
    const value = match[2] ?? match[3] ?? '';

    if (name) {
      attrs.set(name, value);
    }

    match = attrPattern.exec(tag);
  }

  return attrs;
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (match: string, codePoint: string) =>
      decodeCodePoint(Number.parseInt(codePoint, 16), match)
    )
    .replace(/&#(\d+);/g, (match: string, codePoint: string) =>
      decodeCodePoint(Number.parseInt(codePoint, 10), match)
    )
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function decodeCodePoint(codePoint: number, original: string): string {
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return original;
  }

  return String.fromCodePoint(codePoint);
}

async function readTextFile(filePath: string, errors: string[]): Promise<string> {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    errors.push(`Could not read ${filePath}: ${formatError(error)}`);
    return '';
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (import.meta.main) {
  const repoRoot = process.cwd();
  const sections = await runSmoke(repoRoot);
  const failed = sections.filter((section) => section.errors.length > 0);

  for (const section of sections) {
    if (section.errors.length === 0) {
      process.stdout.write(`[ok] ${section.name}\n`);
      continue;
    }

    process.stderr.write(`[fail] ${section.name}\n`);

    for (const error of section.errors) {
      process.stderr.write(`  - ${error.replace(`${repoRoot}/`, '')}\n`);
    }
  }

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}
