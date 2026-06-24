import { en } from './en';
import { pt } from './pt';
import type { DocGroup, DocItem, Lang, SiteContent } from './types';

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

/** Convenience route builders so components never hand-assemble locale paths. */
export const routes = {
  home: (lang: Lang) => localizePath('/', lang),
  releases: (lang: Lang) => localizePath('/releases', lang),
  doc: (lang: Lang, id: string) => localizePath(`/docs/${id}`, lang),
};

/** The same route in the other locale — used by the language toggle. */
export function alternatePath(pathname: string, target: Lang): string {
  const stripped = pathname.replace(/^\/en(?=\/|$)/, '') || '/';
  return localizePath(stripped, target);
}

export function otherLang(lang: Lang): Lang {
  return lang === 'pt' ? 'en' : 'pt';
}

export function docStatus(item: DocItem): NonNullable<DocItem['status']> {
  return item.status ?? 'planned';
}

export function isDocReady(item: DocItem): boolean {
  return docStatus(item) === 'ready';
}

export function findDocItem(groups: DocGroup[], id: string): DocItem | undefined {
  for (const group of groups) {
    const item = group.items.find((entry) => entry.id === id);
    if (item) return item;
  }
  return undefined;
}
