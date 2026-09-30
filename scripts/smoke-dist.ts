import type { Dirent } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join, relative, sep } from 'node:path';

import { DOCS_DEFAULT_SLUG, DOCS_NAV } from '../src/data/docs.generated';
import type { Lang } from '../src/i18n/types';
import { routes } from '../src/i18n/ui';
import { isNotFoundUrl } from './localized-not-found';

const CANONICAL_ORIGIN = 'https://mangostudio.dev';
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

/** A parsed `_redirects` rule (`source destination [status]`). */
export interface RedirectRule {
  source: string;
  destination: string;
  status: number;
}

/** In-memory snapshot of `dist/` used by the static link crawl. */
export interface DistSnapshot {
  /** Every emitted file, relative to `dist/` with forward slashes. */
  files: ReadonlySet<string>;
  /** Text of every emitted `.html` file, keyed like `files`. */
  html: ReadonlyMap<string, string>;
  /** Raw `_redirects` text when the build ships one. */
  redirectsText?: string;
}

export interface BrokenLink {
  page: string;
  href: string;
  expected: string;
  received: string;
}

type ServedTarget = { kind: 'file'; file: string } | { kind: 'external' } | { kind: 'missing' };

const REDIRECT_HOP_LIMIT = 10;
/** One pass over markup: comments and script/style bodies are matched (and skipped) before tags. */
const MARKUP_PATTERN =
  /<!--[\s\S]*?-->|<(script|style)\b[\s\S]*?<\/\1\s*>|<([A-Za-z][A-Za-z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;

/**
 * Parses Cloudflare `_redirects` text into rules, skipping blanks and `#` comments.
 *
 * @example
 * parseRedirects('/docs /docs/quickstart 302'); // [{ source: '/docs', destination: '/docs/quickstart', status: 302 }]
 */
export function parseRedirects(text: string): RedirectRule[] {
  const rules: RedirectRule[] = [];

  for (const line of text.split('\n')) {
    const [source, destination, status] = line.trim().split(/\s+/);

    if (!source || !destination || source.startsWith('#')) {
      continue;
    }

    rules.push({ source, destination, status: Number(status ?? 301) || 301 });
  }

  return rules;
}

/**
 * Resolves a request path the way Cloudflare Workers static assets do with
 * `html_handling: "auto-trailing-slash"`: `_redirects` first, then an exact file,
 * `<path>.html`, or `<path>/index.html`. Both `/x` and `/x/` are accepted because
 * Cloudflare serves or redirects between the two forms.
 *
 * @example
 * resolveServedPath('/docs/quickstart', files, []); // { kind: 'file', file: 'docs/quickstart/index.html' }
 */
export function resolveServedPath(
  pathname: string,
  files: ReadonlySet<string>,
  rules: readonly RedirectRule[]
): ServedTarget {
  let current = pathname;

  for (let hop = 0; hop <= REDIRECT_HOP_LIMIT; hop += 1) {
    const destination = applyRedirect(current, rules);

    if (destination === null) {
      const file = findAssetFile(current, files);
      return file ? { kind: 'file', file } : { kind: 'missing' };
    }

    if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(destination)) {
      return { kind: 'external' };
    }

    current = new URL(destination, 'https://redirect.invalid').pathname;
  }

  return { kind: 'missing' };
}

function applyRedirect(pathname: string, rules: readonly RedirectRule[]): string | null {
  for (const rule of rules) {
    const captures = matchRedirectSource(rule.source, pathname);

    if (!captures) {
      continue;
    }

    return rule.destination.replace(/:([A-Za-z_]\w*)/g, (_all, name: string) => {
      return captures.get(name) ?? `:${name}`;
    });
  }

  return null;
}

function matchRedirectSource(source: string, pathname: string): Map<string, string> | null {
  const names: string[] = [];
  const pattern = source
    .replace(/\/+$/g, '')
    .split(/(\*|:[A-Za-z_]\w*)/)
    .map((part) => {
      if (part === '*') {
        names.push('splat');
        return '(.*)';
      }

      if (part.startsWith(':')) {
        names.push(part.slice(1));
        return '([^/]+)';
      }

      return escapeRegExp(part);
    })
    .join('');
  const match = new RegExp(`^${pattern}/?$`).exec(pathname.replace(/\/+$/g, '') || '/');

  if (!match) {
    return null;
  }

  return new Map(names.map((name, index) => [name, match[index + 1] ?? '']));
}

function findAssetFile(pathname: string, files: ReadonlySet<string>): string | undefined {
  const trimmed = pathname.replace(/^\/+|\/+$/g, '');
  const hasTrailingSlash = pathname.endsWith('/');

  if (trimmed === '') {
    return files.has('index.html') ? 'index.html' : undefined;
  }

  const candidates = [`${trimmed}/index.html`, `${trimmed}.html`];

  if (!hasTrailingSlash) {
    candidates.unshift(trimmed);
  }

  return candidates.find((candidate) => files.has(candidate));
}

/** Route a page is served at, used as the base for relative hrefs. */
export function distFileToPageRoute(file: string): string {
  if (file === 'index.html') {
    return '/';
  }

  if (file.endsWith('/index.html')) {
    return `/${file.slice(0, -'index.html'.length)}`;
  }

  return `/${file.replace(/\.html$/, '')}`;
}

/**
 * Lists `href` values a page emits that the crawl must check: every `<a href>` and
 * every `<link href>` (canonical, alternate, stylesheet, icon, manifest, ...).
 * Markup inside `<script>`, `<style>` and comments is ignored.
 */
export function extractCrawlHrefs(html: string): string[] {
  const hrefs = new Set<string>();

  for (const [name, attrs] of scanTags(html)) {
    const href = attrs.get('href');

    if ((name === 'a' || name === 'link') && href !== undefined && href.trim() !== '') {
      hrefs.add(decodeHtmlAttribute(href));
    }
  }

  return [...hrefs].sort();
}

/** Fragment targets a page defines: every `id` plus `<a name>` anchors. */
export function extractFragmentTargets(html: string): Set<string> {
  const targets = new Set<string>();

  for (const [name, attrs] of scanTags(html)) {
    const id = attrs.get('id');
    const anchorName = name === 'a' ? attrs.get('name') : undefined;

    for (const value of [id, anchorName]) {
      if (value) {
        targets.add(decodeHtmlAttribute(value));
      }
    }
  }

  return targets;
}

function scanTags(html: string): [string, Map<string, string>][] {
  const tags: [string, Map<string, string>][] = [];

  for (const match of html.matchAll(MARKUP_PATTERN)) {
    const [, , name, attrs] = match;

    if (name !== undefined) {
      tags.push([name.toLowerCase(), parseAttributes(`<${name}${attrs}>`)]);
    }
  }

  return tags;
}

/**
 * Crawls every page in a `dist/` snapshot and reports each same-origin href whose
 * target file, or `#fragment` id, does not exist. External links are ignored.
 *
 * @example
 * findBrokenLinks({ files: new Set(['index.html']), html: new Map([['index.html', '<a href="/x/">x</a>']]) });
 * // [{ page: 'index.html', href: '/x/', expected: 'dist/x/index.html or dist/x.html', received: 'no such file' }]
 */
export function findBrokenLinks(
  snapshot: DistSnapshot,
  canonicalOrigin = CANONICAL_ORIGIN
): BrokenLink[] {
  const rules = parseRedirects(snapshot.redirectsText ?? '');
  const fragmentCache = new Map<string, Set<string>>();
  const broken: BrokenLink[] = [];

  const idsOf = (file: string): Set<string> | undefined => {
    const html = snapshot.html.get(file);

    if (html === undefined) {
      return undefined;
    }

    const cached = fragmentCache.get(file) ?? extractFragmentTargets(html);
    fragmentCache.set(file, cached);
    return cached;
  };

  for (const [page, html] of [...snapshot.html].sort(([a], [b]) => a.localeCompare(b))) {
    const base = new URL(distFileToPageRoute(page), canonicalOrigin);

    for (const href of extractCrawlHrefs(html)) {
      const url = parseSameOriginUrl(href, base, canonicalOrigin);

      if (!url) {
        continue;
      }

      const target = resolveServedPath(safeDecode(url.pathname), snapshot.files, rules);

      if (target.kind === 'external') {
        continue;
      }

      if (target.kind === 'missing') {
        broken.push({
          page,
          href,
          expected: describeExpectedFiles(url.pathname),
          received: 'no such file and no matching redirect',
        });
        continue;
      }

      const fragment = safeDecode(url.hash.slice(1));

      if (fragment === '' || fragment.toLowerCase() === 'top') {
        continue;
      }

      const ids = idsOf(target.file);

      if (ids && !ids.has(fragment)) {
        broken.push({
          page,
          href,
          expected: `id="${fragment}" in dist/${target.file}`,
          received: 'no element with that id or name',
        });
      }
    }
  }

  return broken;
}

/** Formats a broken link as `dist/<page> links to <href> | expected: ... | received: ...`. */
export function formatBrokenLink(link: BrokenLink): string {
  return `dist/${link.page} links to ${link.href} | expected: ${link.expected} | received: ${link.received}`;
}

function parseSameOriginUrl(href: string, base: URL, canonicalOrigin: string): URL | null {
  let url: URL;

  try {
    url = new URL(href.trim(), base);
  } catch {
    return null;
  }

  return url.origin === canonicalOrigin && /^https?:$/.test(url.protocol) ? url : null;
}

function describeExpectedFiles(pathname: string): string {
  const trimmed = pathname.replace(/^\/+|\/+$/g, '');

  if (trimmed === '') {
    return 'dist/index.html';
  }

  return pathname.endsWith('/')
    ? `dist/${trimmed}/index.html or dist/${trimmed}.html`
    : `dist/${trimmed}, dist/${trimmed}.html or dist/${trimmed}/index.html`;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function readDistSnapshot(distDir: string): Promise<DistSnapshot> {
  const files = new Set<string>();
  const html = new Map<string, string>();

  await collectFiles(distDir, distDir, files);

  for (const file of files) {
    if (file.endsWith('.html')) {
      html.set(file, await readFile(join(distDir, file), 'utf8'));
    }
  }

  const redirectsText = files.has('_redirects')
    ? await readFile(join(distDir, '_redirects'), 'utf8')
    : undefined;

  return { files, html, redirectsText };
}

async function collectFiles(rootDir: string, currentDir: string, files: Set<string>) {
  for (const entry of await readdir(currentDir, { withFileTypes: true })) {
    const path = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      await collectFiles(rootDir, path, files);
    } else {
      files.add(relative(rootDir, path).split(sep).join('/'));
    }
  }
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

function parseAttributes(tag: string): Map<string, string> {
  const attrs = new Map<string, string>();
  const attrPattern =
    /\s([A-Za-z_:][-A-Za-z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match = attrPattern.exec(tag);

  while (match !== null) {
    const name = match[1]?.toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? '';

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
