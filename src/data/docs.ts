import type { CollectionEntry } from 'astro:content';
import type { Lang } from '@/i18n/types';
import type { GeneratedDocNavGroup, GeneratedDocNavItem } from './docs.generated';
import { DOCS_NAV } from './docs.generated';

export type DocsEntry = CollectionEntry<'docs'>;

export function docsNav(lang: Lang): readonly GeneratedDocNavGroup[] {
  return DOCS_NAV[lang];
}

export function docsItems(lang: Lang): GeneratedDocNavItem[] {
  return docsNav(lang).flatMap((group) => group.items);
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

export interface DocsHeading {
  depth: number;
  slug: string;
  text: string;
}

/**
 * Pick the headings that belong in a page's "on this page" list: h2 and h3 only. An empty
 * result means the page has no table of contents, so the layout must not reserve a column.
 *
 * @example
 * docsToc([{ depth: 1, slug: 'a', text: 'A' }, { depth: 2, slug: 'b', text: 'B' }]);
 * // [{ depth: 2, slug: 'b', text: 'B' }]
 */
export function docsToc(headings: readonly DocsHeading[]): DocsHeading[] {
  return headings.filter((heading) => heading.depth === 2 || heading.depth === 3);
}
