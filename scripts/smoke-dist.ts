import type { Dirent } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';

import { DOCS_DEFAULT_SLUG, DOCS_NAV } from '../src/data/docs.generated';
import type { Lang } from '../src/i18n/types';
import { routes } from '../src/i18n/ui';
import { decodeHtmlAttribute, escapeRegExp, parseAttributes } from './dist-html';
import {
  CANONICAL_ORIGIN,
  extractCrawlHrefs,
  findBrokenLinks,
  formatBrokenLink,
  parseSameOriginUrl,
  readDistSnapshot,
} from './link-crawl';
import { isNotFoundUrl } from './localized-not-found';

/** Search snippets cut off near this length; the docs sync derives descriptions within it. */
const DOCS_DESCRIPTION_MAX_LENGTH = 160;
/** Flat error pages Cloudflare's `404-page` handling serves per locale. */
const NOT_FOUND_PAGES: readonly { file: string; lang: Lang; home: string }[] = [
  { file: '404.html', lang: 'pt', home: routes.home('pt') },
  { file: 'en/404.html', lang: 'en', home: routes.home('en') },
];

const DOCS_BY_LANG = DOCS_NAV satisfies LocaleRouteContent;

interface SmokeSection {
  name: string;
  errors: string[];
}

interface DocRouteItem {
  slug: string;
}

interface DocRouteGroup {
  items: readonly DocRouteItem[];
}

type LocaleRouteContent = Record<Lang, readonly DocRouteGroup[]>;

export function deriveRequiredDistFiles(contentByLang: LocaleRouteContent): string[] {
  const files = new Set([
    ...NOT_FOUND_PAGES.map((page) => page.file),
    'robots.txt',
    'sitemap-index.xml',
    routeToDistFile(routes.home('pt')),
    routeToDistFile(routes.home('en')),
    routeToDistFile(routes.releases('pt')),
    routeToDistFile(routes.releases('en')),
    'site.webmanifest',
  ]);

  for (const [lang, groups] of Object.entries(contentByLang) as [
    Lang,
    LocaleRouteContent[Lang],
  ][]) {
    for (const slug of deriveDocSlugs(groups)) {
      files.add(routeToDistFile(routes.doc(lang, slug)));
    }
  }

  return [...files].sort();
}

export function deriveDocSlugs(groups: readonly DocRouteGroup[]): string[] {
  const slugs = new Set<string>();

  for (const group of groups) {
    for (const item of group.items) {
      slugs.add(item.slug);
    }
  }

  return [...slugs].sort();
}

/** Permanent: the rules were verified in production with 302 before switching. */
export const DOCS_REDIRECT_STATUS = 301;

/** The `_redirects` rules sending bare `/docs` (with and without slash) to each locale's default page. */
export function expectedDocsRedirects(): string[] {
  return (['pt', 'en'] as const).flatMap((lang) => {
    const docsRoot = routes.doc(lang, '').replace(/\/$/, '');
    const target = routes.doc(lang, DOCS_DEFAULT_SLUG);

    return [docsRoot, `${docsRoot}/`].map((from) => `${from} ${target} ${DOCS_REDIRECT_STATUS}`);
  });
}

/**
 * Check `_redirects` declares every docs redirect exactly, each to a slash-terminated target.
 *
 * @example validateDocsRedirects('/docs /docs/quickstart/ 301') // errors for the missing rules
 */
export function validateDocsRedirects(text: string): string[] {
  const rules = new Set(
    text
      .split('\n')
      .map((line) => line.trim().replace(/\s+/g, ' '))
      .filter((line) => line !== '' && !line.startsWith('#'))
  );

  return expectedDocsRedirects()
    .filter((rule) => !rules.has(rule))
    .map((rule) => `dist/_redirects expected rule "${rule}" | received: ${[...rules].join(' ; ')}`);
}

/**
 * Internal page hrefs (anchors and `<link>`s) that lack the canonical trailing slash.
 * Cloudflare answers those with a redirect, so every in-site link must already use the slash
 * form. File links (`/install.sh`, `/_astro/app.css`) and fragment-only hrefs are exempt.
 *
 * @example findSlashlessInternalHrefs('<a href="/docs/quickstart">x</a>') // ['/docs/quickstart']
 */
export function findSlashlessInternalHrefs(
  html: string,
  canonicalOrigin = CANONICAL_ORIGIN
): string[] {
  const base = new URL('/', canonicalOrigin);

  return extractCrawlHrefs(html).filter((href) => {
    const url = parseSameOriginUrl(href, base, canonicalOrigin);

    return (
      url !== null &&
      url.pathname !== '' &&
      !url.pathname.endsWith('/') &&
      !/\.[A-Za-z0-9]+$/.test(basename(url.pathname))
    );
  });
}

export function resolveInternalHrefToRoutePath(
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

  return normalizeRoutePath(pathname);
}

export function resolveInternalHrefToDistFile(
  href: string,
  canonicalOrigin = CANONICAL_ORIGIN
): string | null {
  const routePath = resolveInternalHrefToRoutePath(href, canonicalOrigin);

  return routePath ? routeToDistFile(routePath) : null;
}

/**
 * Reports Astro prefetch attributes left in an HTML document. Prefetch is disabled site-wide
 * because HTML is served with `max-age=0, must-revalidate` and no validator, so the browser
 * downloads the page again on click and the prefetch only doubles the bytes.
 *
 * @example
 * findPrefetchAttributeElements('<a href="/docs" data-astro-prefetch="hover">Docs</a>');
 * // => ['<a href="/docs" data-astro-prefetch="hover">']
 */
export function findPrefetchAttributeElements(html: string): string[] {
  const tags = html.match(/<[a-z][^<>]*>/gi) ?? [];

  return tags.filter((tag) => /\sdata-astro-prefetch(?=[\s=>/])/i.test(tag));
}

/**
 * Tells whether a bundled script is Astro's prefetch runtime. The runtime reads
 * `data-astro-prefetch` through `dataset.astroPrefetch` and the `prefetchAll` option.
 *
 * @example
 * isAstroPrefetchRuntime('r??=e?.prefetchAll??!1'); // => true
 */
export function isAstroPrefetchRuntime(script: string): boolean {
  return /\bprefetchAll\b|\bastroPrefetch\b/.test(script);
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

/** Sitemap `<loc>` URLs that point at an error page (`/404`, `/en/404/`). */
export function findSitemapNotFoundUrls(locText: string): string[] {
  return locText
    .split('\n')
    .map((url) => url.trim())
    .filter((url) => url !== '' && isNotFoundUrl(url));
}

async function runSmoke(repoRoot: string): Promise<SmokeSection[]> {
  const distDir = join(repoRoot, 'dist');

  return [
    await smokeRequiredRoutes(distDir),
    await smokeRedirects(distDir),
    await smokeReadyDocs(distDir),
    await smokeNotFoundLinks(distDir),
    await smokeCanonicalHosts(distDir),
    await smokeLinkCrawl(distDir),
    await smokeNoPrefetch(distDir),
    await smokeTrailingSlashHrefs(distDir),
    await smokeDocsDescriptions(distDir),
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

  for (const relativePath of deriveRequiredDistFiles(DOCS_BY_LANG)) {
    if (!(await fileExists(join(distDir, relativePath)))) {
      errors.push(`dist/${relativePath} is missing from the static build.`);
    }
  }

  return { name: 'Required route files', errors };
}

async function smokeRedirects(distDir: string): Promise<SmokeSection> {
  const errors: string[] = [];
  const text = await readTextFile(join(distDir, '_redirects'), errors);

  return {
    name: 'Docs redirect rules',
    errors: text ? validateDocsRedirects(text) : errors,
  };
}

async function smokeReadyDocs(distDir: string): Promise<SmokeSection> {
  const errors: string[] = [];
  const readyDocs = [
    { file: routeToDistFile(routes.doc('pt', DOCS_DEFAULT_SLUG)) },
    { file: routeToDistFile(routes.doc('en', DOCS_DEFAULT_SLUG)) },
    { file: routeToDistFile(routes.doc('pt', 'reference/cli')) },
    { file: routeToDistFile(routes.doc('en', 'reference/cli')) },
  ];

  for (const doc of readyDocs) {
    const html = await readTextFile(join(distDir, doc.file), errors);

    if (!html) {
      continue;
    }

    const article = extractElementWithClass(html, 'docs-article');

    if (!article) {
      errors.push(`dist/${doc.file} is missing the docs-article container.`);
      continue;
    }

    if (article.includes('TODO')) {
      errors.push(`dist/${doc.file} must not contain TODO placeholder copy in the article.`);
    }

    if (/\bdocs-planned\b/.test(article)) {
      errors.push(`dist/${doc.file} must render synced content, not the planned-page state.`);
    }
  }

  return { name: 'Ready docs content', errors };
}

export function validateNotFoundMetadata(
  html: string,
  expected: { file: string; lang: Lang; home: string }
): string[] {
  const label = `dist/${expected.file}`;
  const errors: string[] = [];
  const htmlLang = /<html\b[^>]*\slang=["']([^"']*)["']/i.exec(html)?.[1];

  if (htmlLang !== expected.lang) {
    errors.push(`${label} must set <html lang="${expected.lang}"> | received: ${htmlLang}`);
  }

  const robots = extractMetaTags(html)
    .find((attrs) => attrs.get('name')?.toLowerCase() === 'robots')
    ?.get('content');

  if (!robots || !/\bnoindex\b/i.test(robots)) {
    errors.push(`${label} must set <meta name="robots" content="noindex"> | received: ${robots}`);
  }

  if (extractMetaTags(html).some((attrs) => attrs.get('property') === 'og:url')) {
    errors.push(`${label} must not set og:url | received: a canonical URL signal`);
  }

  for (const rel of extractLinkTags(html)) {
    const relValue = rel.get('rel')?.toLowerCase();

    if (relValue === 'canonical' || relValue === 'alternate') {
      errors.push(`${label} must not declare rel="${relValue}" | received: ${rel.get('href')}`);
    }
  }

  const toggleHrefs = extractAnchorHrefsWithAttr(html, 'hreflang');

  for (const href of toggleHrefs) {
    if (href !== routes.home('pt') && href !== routes.home('en')) {
      errors.push(`${label} language toggle must link to a locale home | received: ${href}`);
    }
  }

  if (toggleHrefs.length === 0) {
    errors.push(`${label} must render the language toggle | received: no hreflang anchors`);
  }

  return errors;
}

async function smokeNotFoundLinks(distDir: string): Promise<SmokeSection> {
  const errors: string[] = [];

  for (const page of NOT_FOUND_PAGES) {
    const html = await readTextFile(join(distDir, page.file), errors);

    if (!html) {
      continue;
    }

    errors.push(...validateNotFoundMetadata(html, page));
    errors.push(...(await validateNotFoundLinks(distDir, html, page)));
  }

  return { name: '404 pages', errors };
}

async function validateNotFoundLinks(
  distDir: string,
  html: string,
  page: { file: string; lang: Lang; home: string }
): Promise<string[]> {
  const errors: string[] = [];
  const section = extractElementWithClass(html, 'nf') ?? html;
  const hrefs = extractAnchorHrefs(section);
  const docsPrefix = page.lang === 'en' ? '/en/docs/' : '/docs/';

  if (!hrefs.includes(page.home)) {
    errors.push(`dist/${page.file} must link to ${page.home} | received: ${hrefs.join(', ')}`);
  }

  if (!hrefs.some((href) => href.startsWith(docsPrefix))) {
    errors.push(
      `dist/${page.file} must link to a route under ${docsPrefix} | received: ${hrefs.join(', ')}`
    );
  }

  for (const href of hrefs) {
    const relativePath = resolveInternalHrefToDistFile(href);

    if (relativePath && !(await fileExists(join(distDir, relativePath)))) {
      errors.push(`dist/${page.file} links to ${href}, but dist/${relativePath} is missing.`);
    }
  }

  return errors;
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

    if (file.endsWith('.xml')) {
      errors.push(
        ...findSitemapNotFoundUrls(hostText).map(
          (url) => `dist/${file} must not list the error page | received: ${url}`
        )
      );
    }
  }

  return { name: 'Sitemap and robots hosts', errors };
}

async function smokeNoPrefetch(distDir: string): Promise<SmokeSection> {
  const errors: string[] = [];

  for (const file of await findDistFiles(distDir, '.html')) {
    const html = await readTextFile(join(distDir, file), errors);

    for (const tag of findPrefetchAttributeElements(html)) {
      errors.push(
        `dist/${file} must not emit data-astro-prefetch (prefetch: false). Received: ${tag}`
      );
    }
  }

  for (const file of await findDistFiles(distDir, '.js')) {
    const script = await readTextFile(join(distDir, file), errors);

    if (isAstroPrefetchRuntime(script)) {
      errors.push(
        `dist/${file} must not contain the Astro prefetch runtime (prefetch: false). ` +
          'Expected no script referencing prefetchAll or astroPrefetch.'
      );
    }
  }

  return { name: 'No Astro prefetch', errors };
}

async function smokeLinkCrawl(distDir: string): Promise<SmokeSection> {
  if (!(await fileExists(distDir))) {
    return { name: 'Full link and fragment crawl', errors: [] };
  }

  const snapshot = await readDistSnapshot(distDir);

  return {
    name: `Full link and fragment crawl (${snapshot.html.size} pages)`,
    errors: findBrokenLinks(snapshot).map(formatBrokenLink),
  };
}

async function smokeTrailingSlashHrefs(distDir: string): Promise<SmokeSection> {
  const errors: string[] = [];

  for (const file of await findDistFiles(distDir, '.html')) {
    const html = await readTextFile(join(distDir, file), errors);
    const slashless = findSlashlessInternalHrefs(html);

    if (slashless.length > 0) {
      errors.push(
        `dist/${file} expected internal hrefs to end in "/" | received ${slashless.length}: ${slashless.slice(0, 3).join(', ')}`
      );
    }
  }

  return { name: 'Trailing-slash internal hrefs', errors };
}

/** The `<meta name="description">` content of a page, or undefined when it has none. */
export function extractMetaDescription(html: string): string | undefined {
  return extractMetaTags(html)
    .find((attrs) => attrs.get('name')?.toLowerCase() === 'description')
    ?.get('content');
}

/**
 * Check every docs page of one locale carries its own description: present, not the locale
 * home description, unique among the locale's docs, and within the search-snippet budget.
 *
 * @example
 * validateDocsDescriptions('pt', 'Home.', [{ file: 'docs/a/index.html', description: 'Home.' }]);
 * // => ['dist/docs/a/index.html expected a description distinct from the pt home page | ...']
 */
export function validateDocsDescriptions(
  lang: Lang,
  homeDescription: string | undefined,
  pages: readonly { file: string; description: string | undefined }[],
  maxLength = DOCS_DESCRIPTION_MAX_LENGTH
): string[] {
  const errors: string[] = [];
  const firstFileByDescription = new Map<string, string>();

  for (const { file, description } of pages) {
    const label = `dist/${file}`;

    if (!description) {
      errors.push(`${label} expected a meta description | received: ${description}`);
      continue;
    }

    if (description === homeDescription) {
      errors.push(
        `${label} expected a description distinct from the ${lang} home page | received: ${JSON.stringify(description)}`
      );
    }

    if (description.length > maxLength) {
      errors.push(
        `${label} expected a description of at most ${maxLength} chars | received ${description.length}`
      );
    }

    const first = firstFileByDescription.get(description);

    if (first) {
      errors.push(
        `${label} expected a description unique within ${lang} | received the same as dist/${first}: ${JSON.stringify(description)}`
      );
    }

    firstFileByDescription.set(description, first ?? file);
  }

  return errors;
}

async function smokeDocsDescriptions(distDir: string): Promise<SmokeSection> {
  const errors: string[] = [];

  for (const lang of ['pt', 'en'] as const) {
    const homeFile = routeToDistFile(routes.home(lang));
    const homeDescription = extractMetaDescription(
      await readTextFile(join(distDir, homeFile), errors)
    );
    const pages: { file: string; description: string | undefined }[] = [];

    for (const slug of deriveDocSlugs(DOCS_BY_LANG[lang])) {
      const file = routeToDistFile(routes.doc(lang, slug));
      const html = await readTextFile(join(distDir, file), errors);

      pages.push({ file, description: html ? extractMetaDescription(html) : undefined });
    }

    errors.push(...validateDocsDescriptions(lang, homeDescription, pages));
  }

  return { name: 'Docs descriptions', errors };
}

async function findDistFiles(distDir: string, extension: string): Promise<string[]> {
  const files: string[] = [];
  await collectDistFiles(distDir, distDir, extension, files);
  return files.sort();
}

async function collectDistFiles(
  rootDir: string,
  currentDir: string,
  extension: string,
  files: string[]
): Promise<void> {
  let entries: Dirent[];

  try {
    entries = await readdir(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const path = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      await collectDistFiles(rootDir, path, extension, files);
    } else if (entry.name.endsWith(extension)) {
      files.push(relative(rootDir, path));
    }
  }
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

function extractTags(html: string, name: string): Map<string, string>[] {
  const pattern = new RegExp(`<${name}\\b[^>]*>`, 'gi');
  return [...html.matchAll(pattern)].map((match) => parseAttributes(match[0]));
}

function extractMetaTags(html: string): Map<string, string>[] {
  return extractTags(html, 'meta');
}

function extractLinkTags(html: string): Map<string, string>[] {
  return extractTags(html, 'link');
}

function extractAnchorHrefsWithAttr(html: string, attr: string): string[] {
  return extractAnchorHrefs(html, (_tag, attrs) => attrs.has(attr));
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
