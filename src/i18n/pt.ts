import { RELEASE } from '@/data/releases.generated';
import { GITHUB_URL } from '@/data/site';
import type { SiteContent } from './types';

export const pt = {
  lang: 'pt',
  meta: {
    title: 'MangoStudio — Seu estúdio de IA local, em um único binário',
    description:
      'Chat e geração de imagem com Gemini, OpenAI, Anthropic e DeepSeek — rodando na sua máquina, com as suas chaves. Sem nuvem, sem telemetria, sem Node.',
  },
  nav: { home: 'Início', features: 'Recursos', releases: 'Releases', docs: 'Docs' },
  header: { search: 'Buscar…', cta: 'Começar', theme: 'Alternar tema', github: 'Ver no GitHub' },
  hero: {
    badge: `${RELEASE.version} · MIT · 100% local · BYOK`,
    titlePre: 'Seu estúdio de IA local, em um',
    titleHighlight: 'único binário',
    titlePost: '.',
    subtitle:
      'Chat e geração de imagem com Gemini, OpenAI, Anthropic e DeepSeek — rodando na sua máquina, com as suas chaves. Sem nuvem, sem telemetria, sem Node.',
    terminalTitle: 'instalar — bash',
    ctaPrimary: 'Começar agora',
    ctaSecondary: 'Ver no GitHub',
    requirements: 'requer Bun v1.3.14+ · macOS · Linux · Windows',
  },
  demo: {
    tab: '~/projetos — zsh',
    userMsg: 'Gere um ícone de manga minimalista',
    assistant: 'Claro — gerando 1 imagem 1024×1024…',
    online: 'online',
    caption:
      'Um comando sobe a API (Elysia + SQLite) e a UI React — e abre o estúdio no navegador.',
  },
  quickstart: {
    eyebrow: 'Quickstart',
    title: 'Do zero ao estúdio em 3 passos',
    steps: [
      {
        n: '1',
        title: 'Instale',
        desc: 'Um comando com o gerenciador que você já usa — o único canal publicado por enquanto.',
        cmd: RELEASE.installCmd,
      },
      {
        n: '2',
        title: 'Configure',
        desc: 'Adicione a chave do provider no config.toml ou via variável de ambiente.',
        cmd: 'export GEMINI_API_KEY=…',
      },
      {
        n: '3',
        title: 'Sirva',
        desc: 'Suba a API + UI e abra o estúdio no navegador. Pronto para conversar.',
        cmd: 'mangostudio serve',
      },
    ],
  },
  features: {
    eyebrow: 'Recursos',
    title: 'Um estúdio completo, offline-first',
    items: [
      {
        icon: 'chat',
        title: 'Chat multimodelo',
        desc: 'Streaming SSE, reasoning estendido, ferramentas e troca de modelo no meio da conversa.',
      },
      {
        icon: 'image',
        title: 'Geração de imagem',
        desc: 'Gere imagens direto do chat com modelos compatíveis e galeria local persistida.',
      },
      {
        icon: 'attachment',
        title: 'Anexos',
        desc: 'Suba arquivos e imagens; o MangoStudio os entrega ao provider no turno certo.',
      },
      {
        icon: 'tools',
        title: 'Ferramentas & agentes',
        desc: 'grep, glob, shell, read_file e delegação de subagentes com lifecycle próprio.',
      },
      {
        icon: 'keys',
        title: 'Chaves & BYOK',
        desc: 'Guarde chaves no secret store do SO, no config.toml ou no .env. Você no controle.',
      },
      {
        icon: 'database',
        title: 'Local-first & SQLite',
        desc: 'Tudo persiste em SQLite local via Kysely. Seus dados nunca saem da sua máquina.',
      },
    ],
  },
  providers: {
    eyebrow: 'Traga as suas chaves',
    title: 'Funciona com os providers que você já usa',
  },
  comparison: {
    eyebrow: 'Por que local-first',
    title: 'MangoStudio vs. chat hospedado',
    criterion: 'Critério',
    us: 'MangoStudio',
    them: 'Chat hospedado',
    rows: [
      { label: 'Dados na sua máquina', us: 'SQLite local', them: 'Servidores do fornecedor' },
      { label: 'Chaves de API', us: 'Suas (BYOK)', them: 'Gerenciadas por terceiros' },
      { label: 'Múltiplos providers', us: '5 + compatíveis', them: 'Geralmente um só' },
      { label: 'Geração de imagem', us: 'Integrada', them: 'Varia / paga' },
      { label: 'Código aberto', us: 'MIT', them: 'Fechado' },
      { label: 'Custo de plataforma', us: 'Zero · self-host', them: 'Assinatura mensal' },
    ],
  },
  channels: {
    eyebrow: 'Instalação',
    title: 'Um comando hoje, mais canais em breve',
    noteBefore: 'Só o canal abaixo está publicado e verificado contra o ',
    noteAfter:
      '. Brew, shell, scoop, cargo, docker e download manual chegam assim que os pipelines publicarem.',
    readyLabel: 'disponível',
    plannedLabel: 'em breve',
    plannedHint: 'Canal planejado — ainda não disponível',
  },
  contribute: {
    badge: '★ Open source · MIT',
    title: 'Construído à luz do dia, com a comunidade',
    desc: 'Arquitetura modular DDD, contratos tipados de ponta a ponta e docs para contribuir. Issues e PRs são bem-vindos.',
    ctaStar: '★ Dar estrela no GitHub',
    ctaGuide: 'Guia de contribuição',
  },
  footer: {
    tagline: 'Seu estúdio de IA local, em um binário. Bun · Elysia · SQLite · React 19.',
    productTitle: 'Produto',
    product: { features: 'Recursos', releases: 'Releases', install: 'Instalação' },
    docsTitle: 'Docs',
    docsLinks: { quickstart: 'Quickstart', cli: 'CLI Reference', architecture: 'Arquitetura' },
    communityTitle: 'Comunidade',
    community: { github: 'GitHub', issues: 'Issues', contribute: 'Contribuir' },
    copyright: '© 2026 MangoStudio · Licença MIT',
    madeWith: 'Feito com Bun, sem Node.',
  },
  releases: {
    eyebrow: 'Changelog',
    title: 'Releases',
    intro:
      'Versão canary e comando de instalação sincronizados do pipeline de releases do MangoStudio. Destaques curados por release.',
    latestBadge: 'versão canary',
    groups: [
      {
        emoji: '🚀',
        title: 'Features',
        count: '52',
        items: [
          { type: 'feat', scope: '(cli)', text: 'pacote wrapper @mangostudio/cli para npm/bun' },
          { type: 'feat', scope: '(tools)', text: 'ferramentas built-in grep, glob e shell' },
          { type: 'feat', scope: '(api)', text: 'delegação de subagentes e lifecycle' },
          { type: 'feat', scope: '(chat)', text: 'troca de modo de agente com persistência' },
          { type: 'feat', scope: '(images)', text: 'geração de imagem e galeria persistida' },
          {
            type: 'feat',
            scope: '(frontend)',
            text: 'tema claro com resolução de preferência do sistema',
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
            text: 'endurece continuação do Gemini e replay consistente',
          },
          { type: 'fix', scope: '(auth)', text: 'guarda de sessão e race condition no login' },
          {
            type: 'fix',
            scope: '(binary)',
            text: 'serve o frontend corretamente do binário compilado',
          },
        ],
      },
      {
        emoji: '⚡',
        title: 'Performance & Refactor',
        count: '40+',
        items: [
          { type: 'perf', scope: '(api)', text: 'prompt caching automático no Anthropic' },
          {
            type: 'refactor',
            scope: '(api)',
            text: 'módulos de bounded-context (DDD) para providers',
          },
          {
            type: 'refactor',
            scope: '(shared)',
            text: 'contratos TypeBox compartilhados ponta a ponta',
          },
        ],
      },
    ],
  },
  docs: {
    searchSidebar: 'Buscar nos docs',
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
          { id: 'providers', label: 'Visão geral' },
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
        'Suba o MangoStudio na sua máquina e abra o estúdio em menos de um minuto. Você só precisa do Bun e de uma chave de API de algum provider.',
      prereqStrong: 'Pré-requisito:',
      prereqText: ' Bun v1.3.14 ou superior. Verifique com bun --version.',
      sections: [
        {
          title: '1. Instale o CLI',
          body: 'Por enquanto, só este canal está publicado. O mais rápido com Bun:',
          codeLang: 'bash',
          code: `# instala globalmente\n${RELEASE.installCmd}`,
        },
        {
          title: '2. Adicione uma chave',
          body: 'Guarde a chave no ~/.mango/config.toml ou exporte como variável de ambiente:',
          codeLang: 'toml',
          code: '[gemini_api_keys]\npersonal = "sua-chave-aqui"',
        },
        {
          title: '3. Suba o servidor',
          body: 'Inicie em foreground (padrão localhost:3001) e abra o estúdio:',
          codeLang: 'bash',
          code: 'mangostudio serve              # foreground\nmangostudio serve lan:3001 -d  # background',
        },
      ],
      prevLabel: '← Anterior',
      prevTitle: 'Instalação',
      nextLabel: 'Próximo →',
      nextTitle: 'Chat',
      tocTitle: 'Nesta página',
      toc: ['1. Instale o CLI', '2. Adicione uma chave', '3. Suba o servidor'],
    },
    plannedBadge: 'Planejado',
    plannedText: 'Esta página ainda não foi escrita — está no roadmap.',
    plannedSidebarHint: 'Página planejada — ainda não publicada',
  },
  cmdk: {
    placeholder: 'Buscar páginas, comandos, docs…',
    noResults: 'Nada encontrado para',
    open: '↵ abrir',
    close: 'esc fechar',
    footer: 'MangoStudio ⌘K',
    items: [
      {
        glyph: '⌂',
        title: 'Início',
        sub: 'Landing principal',
        kind: 'página',
        action: { type: 'nav', page: 'home' },
      },
      {
        glyph: '✦',
        title: 'Releases',
        sub: 'Timeline de versões',
        kind: 'página',
        action: { type: 'nav', page: 'releases' },
      },
      {
        glyph: '⌘',
        title: 'Quickstart',
        sub: 'Do zero ao estúdio',
        kind: 'doc',
        action: { type: 'doc', doc: 'quickstart' },
      },
      {
        glyph: '$',
        title: 'CLI Reference',
        sub: 'serve · status · stop · doctor · Planejado',
        kind: 'doc',
        action: { type: 'doc', doc: 'cli' },
      },
      {
        glyph: '◍',
        title: 'Providers',
        sub: 'Gemini, OpenAI, Anthropic, DeepSeek · Planejado',
        kind: 'doc',
        action: { type: 'doc', doc: 'providers' },
      },
      {
        glyph: '⌥',
        title: 'Arquitetura',
        sub: 'Continuation runtime · Planejado',
        kind: 'doc',
        action: { type: 'doc', doc: 'continuation' },
      },
      {
        glyph: '⎈',
        title: 'Deployment',
        sub: 'Docker · Cloudflare · Planejado',
        kind: 'doc',
        action: { type: 'doc', doc: 'deployment' },
      },
      {
        glyph: '⊟',
        title: 'Toggle de tema',
        sub: 'Claro / escuro',
        kind: 'ação',
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
  copyToast: 'Copiado para a área de transferência',
  terminalLines: [
    `▸ MangoStudio ${RELEASE.version}  (bun 1.3.14)`,
    '▸ database  ~/.mango/database.sqlite',
    '▸ providers gemini · openai · anthropic  ✓',
    '▸ ready ── http://localhost:3001',
  ],
  langToggle: { pt: 'PT', en: 'EN' },
} satisfies SiteContent;
