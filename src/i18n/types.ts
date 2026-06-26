/** Shared content contract. `pt` and `en` both `satisfies SiteContent`, so the
 *  type checker guarantees the two locales never drift out of structural parity. */

export type Lang = 'pt' | 'en';

export type FeatureIcon = 'chat' | 'image' | 'attachment' | 'tools' | 'keys' | 'database';

export interface Step {
  n: string;
  title: string;
  desc: string;
  cmd: string;
}

export interface Feature {
  icon: FeatureIcon;
  title: string;
  desc: string;
}

export interface CompareRow {
  label: string;
  us: string;
  them: string;
}

export type ReleaseType = 'feat' | 'fix' | 'perf' | 'refactor';

export interface ReleaseItem {
  type: ReleaseType;
  scope: string;
  text: string;
}

export interface ReleaseGroup {
  emoji: string;
  title: string;
  count: string;
  items: ReleaseItem[];
}

export type DocStatus = 'ready' | 'planned';

export interface DocItem {
  id: string;
  label: string;
  status?: DocStatus;
}

export interface DocGroup {
  title: string;
  items: DocItem[];
}

export type CmdkAction =
  | { type: 'nav'; page: 'home' | 'releases' }
  | { type: 'doc'; doc: string }
  | { type: 'theme' }
  | { type: 'external'; href: string };

export interface CmdkItem {
  glyph: string;
  title: string;
  sub: string;
  kind: string;
  action: CmdkAction;
}

export interface QuickstartSection {
  title: string;
  body: string;
  codeLang: string;
  code: string;
}

export interface SiteContent {
  lang: Lang;
  meta: { title: string; description: string };
  nav: { home: string; features: string; releases: string; docs: string };
  header: { search: string; cta: string; theme: string; github: string; star: string };
  hero: {
    badge: string;
    titlePre: string;
    titleHighlight: string;
    titlePost: string;
    subtitle: string;
    terminalTitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    requirements: string;
  };
  demo: { tab: string; userMsg: string; assistant: string; online: string; caption: string };
  quickstart: { eyebrow: string; title: string; steps: Step[] };
  features: { eyebrow: string; title: string; items: Feature[] };
  providers: { eyebrow: string; title: string };
  comparison: {
    eyebrow: string;
    title: string;
    criterion: string;
    us: string;
    them: string;
    rows: CompareRow[];
  };
  channels: {
    eyebrow: string;
    title: string;
    noteBefore: string;
    noteAfter: string;
    readyLabel: string;
    plannedLabel: string;
    plannedHint: string;
  };
  contribute: { badge: string; title: string; desc: string; ctaStar: string; ctaGuide: string };
  footer: {
    tagline: string;
    productTitle: string;
    product: { features: string; releases: string; install: string };
    docsTitle: string;
    docsLinks: { quickstart: string; cli: string; architecture: string };
    communityTitle: string;
    community: { github: string; issues: string; contribute: string };
    copyright: string;
    madeWith: string;
  };
  releases: {
    eyebrow: string;
    title: string;
    intro: string;
    latestBadge: string;
    groups: ReleaseGroup[];
  };
  docs: {
    searchSidebar: string;
    groups: DocGroup[];
    quickstart: {
      breadcrumb: string;
      title: string;
      intro: string;
      prereqStrong: string;
      prereqText: string;
      sections: QuickstartSection[];
      prevLabel: string;
      prevTitle: string;
      nextLabel: string;
      nextTitle: string;
      tocTitle: string;
      toc: string[];
    };
    plannedBadge: string;
    plannedText: string;
    plannedSidebarHint: string;
  };
  cmdk: {
    placeholder: string;
    noResults: string;
    open: string;
    close: string;
    footer: string;
    items: CmdkItem[];
  };
  copyToast: string;
  copyToastError: string;
  terminalLines: string[];
  langToggle: { pt: string; en: string };
}
