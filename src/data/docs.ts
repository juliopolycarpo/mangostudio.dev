import type { CollectionEntry } from 'astro:content';
import type { Lang } from '@/i18n/types';
import type { GeneratedDocNavGroup, GeneratedDocNavItem } from './docs.generated';
import { DOCS_BY_SLUG, DOCS_DEFAULT_SLUG, DOCS_NAV } from './docs.generated';

export type DocsEntry = CollectionEntry<'docs'>;

export function docsNav(lang: Lang): readonly GeneratedDocNavGroup[] {
  return DOCS_NAV[lang];
}

export function docsItems(lang: Lang): GeneratedDocNavItem[] {
  return docsNav(lang).flatMap((group) => group.items);
}

export function findDoc(lang: Lang, slug: string): GeneratedDocNavItem | undefined {
  const docsBySlug: Record<string, GeneratedDocNavItem> = DOCS_BY_SLUG[lang];
  return docsBySlug[slug];
}

export function defaultDocSlug(): string {
  return DOCS_DEFAULT_SLUG;
}

export function previousNextDocs(
  lang: Lang,
  slug: string
): { previous?: GeneratedDocNavItem; next?: GeneratedDocNavItem } {
  const items = docsItems(lang);
  const index = items.findIndex((item) => item.slug === slug);

  if (index < 0) {
    return {};
  }

  return {
    previous: items[index - 1],
    next: items[index + 1],
  };
}

export function contentEntryId(lang: Lang, slug: string): string {
  return `${lang}/${slug}`;
}
