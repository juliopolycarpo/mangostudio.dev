import { RELEASE } from '@/data/releases.generated';
import { GITHUB_URL } from '@/data/site';
import type { SiteContent } from './types';

export const en = {
  lang: 'en',
  meta: {
    title: 'MangoStudio — Your local AI studio in a single binary',
    description:
      'Chat and image generation with Gemini, OpenAI, Anthropic, and DeepSeek — running on your machine, with your own keys. No cloud, no telemetry, no Node.',
  },
  nav: { home: 'Home', features: 'Features', releases: 'Releases', docs: 'Docs' },
  header: {
    search: 'Search…',
    cta: 'Get started',
    theme: 'Toggle theme',
    github: 'View on GitHub',
    star: 'Star',
  },
  hero: {
    badge: `${RELEASE.version} · MIT · 100% local · BYOK`,
    titlePre: 'Your local AI studio, in a',
    titleHighlight: 'single binary',
    titlePost: '.',
    subtitle:
      'Chat and image generation with Gemini, OpenAI, Anthropic, and DeepSeek — running on your machine, with your own keys. No cloud, no telemetry, no Node.',
    terminalTitle: 'install',
    ctaPrimary: 'Get started',
    ctaSecondary: 'View on GitHub',
    requirements: 'requires Bun v1.3.14+ · macOS · Linux · Windows',
  },
  demo: {
    tab: '~/projects — zsh',
    userMsg: 'Generate a minimalist mango icon',
    assistant: 'Sure — generating 1 image 1024×1024…',
    online: 'online',
    caption:
      'One command boots the API (Elysia + SQLite) and the React UI — and opens the studio in your browser.',
  },
  quickstart: {
    eyebrow: 'Quickstart',
    title: 'From zero to studio in 3 steps',
    steps: [
      {
        n: '1',
        title: 'Install',
        desc: 'Pick the platform and installer that fit your machine. Every ready channel installs the same binary.',
        cmd: RELEASE.installCmd,
      },
      {
        n: '2',
        title: 'Configure',
        desc: 'Add your provider key in config.toml or via an environment variable.',
        cmd: 'export GEMINI_API_KEY=…',
      },
      {
        n: '3',
        title: 'Serve',
        desc: 'Boot the API + UI and open the studio in your browser. Ready to chat.',
        cmd: 'mangostudio serve',
      },
    ],
  },
  features: {
    eyebrow: 'Features',
    title: 'A complete studio, offline-first',
    items: [
      {
        icon: 'chat',
        title: 'Multi-model chat',
        desc: 'SSE streaming, extended reasoning, tools, and mid-conversation model switching.',
      },
      {
        icon: 'image',
        title: 'Image generation',
        desc: 'Generate images straight from chat with compatible models and a persisted local gallery.',
      },
      {
        icon: 'attachment',
        title: 'Attachments',
        desc: 'Upload files and images; MangoStudio hands them to the provider at the right turn.',
      },
      {
        icon: 'tools',
        title: 'Tools & agents',
        desc: 'grep, glob, shell, read_file, and subagent delegation with its own lifecycle.',
      },
      {
        icon: 'keys',
        title: 'Keys & BYOK',
        desc: 'Keep keys in the OS secret store, in config.toml, or in .env. You stay in control.',
      },
      {
        icon: 'database',
        title: 'Local-first & SQLite',
        desc: 'Everything persists in local SQLite via Kysely. Your data never leaves your machine.',
      },
    ],
  },
  providers: {
    eyebrow: 'Bring your own keys',
    title: 'Works with the providers you already use',
  },
  install: {
    platformTabsLabel: 'Install platform',
    methodTabsLabel: 'Install method',
    plannedLabel: 'soon',
    plannedHint: 'Planned channel — not available yet',
  },
  contribute: {
    badge: '★ Open source · MIT',
    title: 'Built in the open, with the community',
    desc: 'Modular DDD architecture, end-to-end typed contracts, and docs to contribute. Issues and PRs are welcome.',
    ctaStar: '★ Star on GitHub',
    ctaGuide: 'Contributing guide',
  },
  footer: {
    tagline: 'Your local AI studio, in one binary. Bun · Elysia · SQLite · React 19.',
    productTitle: 'Product',
    product: { features: 'Features', releases: 'Releases', install: 'Installation' },
    docsTitle: 'Docs',
    docsLinks: { quickstart: 'Quickstart', cli: 'CLI Reference', architecture: 'Architecture' },
    communityTitle: 'Community',
    community: { github: 'GitHub', issues: 'Issues', contribute: 'Contribute' },
    copyright: '© 2026 MangoStudio · MIT License',
    madeWith: 'Built with Bun, no Node.',
  },
  releases: {
    eyebrow: 'Changelog',
    title: 'Releases',
    intro:
      'Canary version and install command are synced from the MangoStudio release pipeline. Highlights are curated per release.',
    latestBadge: 'canary version',
    groups: [
      {
        emoji: '🚀',
        title: 'Features',
        count: '52',
        items: [
          { type: 'feat', scope: '(cli)', text: 'mangostudio wrapper package for npm/bun' },
          { type: 'feat', scope: '(tools)', text: 'built-in grep, glob, and shell tools' },
          { type: 'feat', scope: '(api)', text: 'subagent delegation and lifecycle' },
          { type: 'feat', scope: '(chat)', text: 'agent mode switching with persistence' },
          { type: 'feat', scope: '(images)', text: 'image generation and persisted gallery' },
          {
            type: 'feat',
            scope: '(frontend)',
            text: 'light theme with system-preference resolution',
          },
        ],
      },
      {
        emoji: '🐛',
        title: 'Bug Fixes',
        count: '31',
        items: [
          {
            type: 'fix',
            scope: '(api)',
            text: 'hardens Gemini continuation and consistent replay',
          },
          { type: 'fix', scope: '(auth)', text: 'session guard and login race condition' },
          {
            type: 'fix',
            scope: '(binary)',
            text: 'serves the frontend correctly from the compiled binary',
          },
        ],
      },
      {
        emoji: '⚡',
        title: 'Performance & Refactor',
        count: '40+',
        items: [
          { type: 'perf', scope: '(api)', text: 'automatic prompt caching on Anthropic' },
          { type: 'refactor', scope: '(api)', text: 'bounded-context (DDD) modules for providers' },
          { type: 'refactor', scope: '(shared)', text: 'shared end-to-end TypeBox contracts' },
        ],
      },
    ],
  },
  docs: {
    searchSidebar: 'Search the docs',
    tocTitle: 'On this page',
    sourceLabel: 'Source on GitHub',
    previousLabel: '← Previous',
    nextLabel: 'Next →',
  },
  cmdk: {
    placeholder: 'Search pages, commands, docs…',
    noResults: 'Nothing found for',
    open: '↵ open',
    close: 'esc close',
    footer: 'MangoStudio ⌘K',
    items: [
      {
        glyph: '⌂',
        title: 'Home',
        sub: 'Main landing',
        kind: 'page',
        action: { type: 'nav', page: 'home' },
      },
      {
        glyph: '✦',
        title: 'Releases',
        sub: 'Version timeline',
        kind: 'page',
        action: { type: 'nav', page: 'releases' },
      },
      {
        glyph: '⊟',
        title: 'Toggle theme',
        sub: 'Light / dark',
        kind: 'action',
        action: { type: 'theme' },
      },
      {
        glyph: '★',
        title: 'GitHub',
        sub: 'juliopolycarpo/mangostudio',
        kind: 'link',
        action: { type: 'external', href: GITHUB_URL },
      },
    ],
  },
  copyButtonLabel: 'Copy',
  copyToast: 'Copied to clipboard',
  copyToastError: "Couldn't copy — select and copy manually.",
  terminalLines: [
    `▸ MangoStudio ${RELEASE.version}  (bun 1.3.14)`,
    '▸ database  ~/.mango/database.sqlite',
    '▸ providers gemini · openai · anthropic  ✓',
    '▸ ready ── http://localhost:3001',
  ],
  langToggle: { pt: 'PT', en: 'EN' },
} satisfies SiteContent;
