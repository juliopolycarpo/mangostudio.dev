import { RELEASE } from '@/data/releases.generated';
import { GITHUB_URL, NPM_INSTALL_CMD } from '@/data/site';
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
    terminalTitle: 'install — bash',
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
        desc: 'One command with the package manager you already use — the only published channel for now.',
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
  comparison: {
    eyebrow: 'Why local-first',
    title: 'MangoStudio vs. hosted chat',
    criterion: 'Criterion',
    us: 'MangoStudio',
    them: 'Hosted chat',
    rows: [
      { label: 'Data on your machine', us: 'Local SQLite', them: 'Vendor servers' },
      { label: 'API keys', us: 'Yours (BYOK)', them: 'Managed by third parties' },
      { label: 'Multiple providers', us: '5 + compatible', them: 'Usually just one' },
      { label: 'Image generation', us: 'Built in', them: 'Varies / paid' },
      { label: 'Open source', us: 'MIT', them: 'Closed' },
      { label: 'Platform cost', us: 'Zero · self-host', them: 'Monthly subscription' },
    ],
  },
  channels: {
    eyebrow: 'Installation',
    title: 'Install it your way',
    noteBefore: 'Every channel ships the same prebuilt binary, verified against ',
    noteAfter: ' where applicable.',
    readyLabel: 'available',
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
    groups: [
      {
        title: 'Getting Started',
        items: [
          { id: 'install', label: 'Install' },
          { id: 'quickstart', label: 'Quickstart', status: 'ready' },
        ],
      },
      { title: 'Guides', items: [{ id: 'contributing', label: 'Contributor Quickstart' }] },
      {
        title: 'Features',
        items: [
          { id: 'chat', label: 'Chat' },
          { id: 'image', label: 'Image generation' },
          { id: 'attachments', label: 'Attachments' },
          { id: 'settings', label: 'Settings' },
          { id: 'tools', label: 'Tools' },
        ],
      },
      {
        title: 'Providers',
        items: [
          { id: 'providers', label: 'Overview' },
          { id: 'gemini', label: 'Gemini' },
          { id: 'openai', label: 'OpenAI' },
        ],
      },
      { title: 'Architecture', items: [{ id: 'continuation', label: 'Continuation' }] },
      {
        title: 'Reference',
        items: [
          { id: 'cli', label: 'CLI' },
          { id: 'api', label: 'API' },
          { id: 'testing', label: 'Testing' },
          { id: 'releasing', label: 'Releasing' },
        ],
      },
      {
        title: 'Operations',
        items: [
          { id: 'deployment', label: 'Deployment' },
          { id: 'security', label: 'Security' },
        ],
      },
    ],
    quickstart: {
      breadcrumb: 'Getting Started / Quickstart',
      title: 'Quickstart',
      intro:
        'Boot MangoStudio on your machine and open the studio in under a minute. You only need Bun and an API key from a provider.',
      prereqStrong: 'Prerequisite:',
      prereqText: ' Bun v1.3.14 or newer. Check with bun --version.',
      sections: [
        {
          title: '1. Install the CLI',
          body: 'Install globally with Bun or npm:',
          codeLang: 'bash',
          code: `# install globally\n${RELEASE.installCmd}\n${NPM_INSTALL_CMD}`,
        },
        {
          title: '2. Add a key',
          body: 'Store the key in ~/.mango/config.toml or export it as an environment variable:',
          codeLang: 'toml',
          code: '[gemini_api_keys]\npersonal = "your-key-here"',
        },
        {
          title: '3. Start the server',
          body: 'Start in the foreground (default localhost:3001) and open the studio:',
          codeLang: 'bash',
          code: 'mangostudio serve              # foreground\nmangostudio serve lan:3001 -d  # background',
        },
      ],
      prevLabel: '← Previous',
      prevTitle: 'Installation',
      nextLabel: 'Next →',
      nextTitle: 'Chat',
      tocTitle: 'On this page',
      toc: ['1. Install the CLI', '2. Add a key', '3. Start the server'],
    },
    plannedBadge: 'Planned',
    plannedText: "This page isn't written yet — it's on the roadmap.",
    plannedSidebarHint: 'Planned page — not published yet',
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
        glyph: '⌘',
        title: 'Quickstart',
        sub: 'From zero to studio',
        kind: 'doc',
        action: { type: 'doc', doc: 'quickstart' },
      },
      {
        glyph: '$',
        title: 'CLI Reference',
        sub: 'serve · status · stop · doctor',
        kind: 'doc',
        action: { type: 'doc', doc: 'cli' },
      },
      {
        glyph: '◍',
        title: 'Providers',
        sub: 'Gemini, OpenAI, Anthropic, DeepSeek',
        kind: 'doc',
        action: { type: 'doc', doc: 'providers' },
      },
      {
        glyph: '⌥',
        title: 'Architecture',
        sub: 'Continuation runtime',
        kind: 'doc',
        action: { type: 'doc', doc: 'continuation' },
      },
      {
        glyph: '⎈',
        title: 'Deployment',
        sub: 'Docker · Cloudflare',
        kind: 'doc',
        action: { type: 'doc', doc: 'deployment' },
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
