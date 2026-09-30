import { en } from './en';
import { pt } from './pt';
import type { Lang, SiteContent } from './types';

export const languages: Record<Lang, string> = {
  pt: 'Português',
  en: 'English',
};

export const defaultLang: Lang = 'pt';

const content: Record<Lang, SiteContent> = { pt, en };

/** Read the active locale from the first path segment ("/en/..." → "en"). */
export function getLangFromUrl(url: URL): Lang {
  const [, seg] = url.pathname.split('/');
  return seg === 'en' ? 'en' : 'pt';
}

/** All copy for a locale. */
export function useContent(lang: Lang): SiteContent {
  return content[lang];
}

/** Prefix a root-relative path with the locale segment (default locale stays at root). */
export function localizePath(path: string, lang: Lang): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (lang === defaultLang) return clean;
  return clean === '/' ? '/en/' : `/en${clean}`;
}

/**
 * Give a page path its trailing slash, keeping any `?query` or `#fragment` after it.
 * Pages are emitted as `<route>/index.html` and Cloudflare answers the slashless form with a
 * redirect, so every internal href must already be the canonical slash form.
 *
 * @example withTrailingSlash('/docs/quickstart#install') // '/docs/quickstart/#install'
 */
export function withTrailingSlash(path: string): string {
  const markerIndex = path.search(/[?#]/);
  const pathPart = markerIndex === -1 ? path : path.slice(0, markerIndex);
  const suffix = markerIndex === -1 ? '' : path.slice(markerIndex);
  return `${pathPart.endsWith('/') ? pathPart : `${pathPart}/`}${suffix}`;
}

/**
 * Convenience route builders so components never hand-assemble locale paths.
 * Every builder returns the canonical trailing-slash URL.
 *
 * @example routes.doc('en', 'reference/cli') // '/en/docs/reference/cli/'
 */
export const routes = {
  home: (lang: Lang) => localizePath('/', lang),
  releases: (lang: Lang) => localizePath(withTrailingSlash('/releases'), lang),
  doc: (lang: Lang, id: string) => localizePath(withTrailingSlash(`/docs/${id}`), lang),
};

/** Drop the "/en" locale prefix, yielding the default-locale path ("/en/docs" → "/docs"). */
export function stripLocalePrefix(pathname: string): string {
  return pathname.replace(/^\/en(?=\/|$)/, '') || '/';
}

/** The same route in the other locale — used by the language toggle. */
export function alternatePath(pathname: string, target: Lang): string {
  return localizePath(stripLocalePrefix(pathname), target);
}

export function otherLang(lang: Lang): Lang {
  return lang === 'pt' ? 'en' : 'pt';
}
