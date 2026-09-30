import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import { decodeHtmlAttribute, escapeRegExp, parseAttributes } from './dist-html';

/** Origin every same-origin link is resolved against. */
export const CANONICAL_ORIGIN = 'https://mangostudio.dev';

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

export type ServedTarget =
  | { kind: 'file'; file: string }
  | { kind: 'external' }
  | { kind: 'missing' };

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

/** Resolves `href` against `base`, or null when it is unparsable, non-http or another origin. */
export function parseSameOriginUrl(href: string, base: URL, canonicalOrigin: string): URL | null {
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

/** Reads every file name and every `.html` page under `distDir` into a crawlable snapshot. */
export async function readDistSnapshot(distDir: string): Promise<DistSnapshot> {
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
