---
title: "MangoStudio"
sidebarLabel: "Início rápido"
lang: "pt"
slug: "quickstart"
groupId: "getting-started"
groupTitle: "Começando"
order: 10
sourcePath: "docs/pt-br/README.md"
sourceUrl: "https://github.com/juliopolycarpo/mangostudio/blob/5490f9a050c73225da1673d7dce7f6f1300b548c/docs/pt-br/README.md"
sourceCommit: "5490f9a050c73225da1673d7dce7f6f1300b548c"
---

# MangoStudio

[CI](https://github.com/juliopolycarpo/mangostudio/actions/workflows/ci.yml)
[Release](https://github.com/juliopolycarpo/mangostudio/actions/workflows/release.yml)

Estúdio de geração de imagens e chat alimentado por IA com suporte a modelos Gemini, compatíveis com OpenAI e Anthropic.

> 🇺🇸 [Read in English](/en/docs/quickstart)

## Instalar

Execute o MangoStudio sem clonar o repositório. Cada canal distribui o mesmo
binário pré-compilado (mais o sidecar `public/` do frontend) e verifica
downloads contra `SHA256SUMS` quando aplicável.

| Canal                  | Comando                                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| npm / bun              | `npm i -g mangostudio` / `bun add -g mangostudio`                                                                      |
| PowerShell (Windows)   | `irm https://mangostudio.dev/install.ps1 \| iex`                                                                       |
| Homebrew (macOS/Linux) | `brew install juliopolycarpo/tap/mangostudio`                                                                          |
| Instalador shell       | `curl -fsSL https://mangostudio.dev/install.sh \| bash`                                                                |
| Scoop (Windows)        | `scoop bucket add juliopolycarpo https://github.com/juliopolycarpo/scoop-bucket` e depois `scoop install mangostudio`  |
| Cargo                  | `cargo install mangostudio` (ou `cargo binstall mangostudio`)                                                          |
| Docker                 | `docker run -p 3001:3001 -v mango-data:/data ghcr.io/juliopolycarpo/mangostudio`                                       |
| Manual                 | Baixe em [GitHub Releases](https://github.com/juliopolycarpo/mangostudio/releases/latest) e verifique com `SHA256SUMS` |

Início rápido com o instalador shell:

```bash
curl -fsSL https://mangostudio.dev/install.sh | bash
mangostudio serve # inicia em http://localhost:3001
```

No Windows, execute o instalador PowerShell hospedado:

```powershell
irm https://mangostudio.dev/install.ps1 | iex
```

ou use Scoop (veja a tabela acima). O canal Cargo instala um
[launcher pequeno](https://github.com/juliopolycarpo/mangostudio/blob/5490f9a050c73225da1673d7dce7f6f1300b548c/packages/cargo-shim/README.md) que baixa o mesmo
arquivo verificado por checksum na primeira execução.

`mangostudio` é um CLI de binário único que gerencia um servidor local:

```bash
mangostudio serve [host|port|host:port] # foreground (padrão localhost:3001)
mangostudio serve lan:3001 -d           # background (logs em ~/.mango/logs/)
mangostudio status         # mostra a instância em execução
mangostudio stop           # encerramento gracioso
mangostudio doctor         # diagnóstico de ambiente
```

Execute `mangostudio` sem argumentos para a lista completa de comandos. Veja
[`docs/reference/cli.md`](/en/docs/reference/cli) para detalhes.

Na primeira execução, `mangostudio serve` pode gerar um `BETTER_AUTH_SECRET` forte
e armazená-lo em `~/.mango/.env` ou `~/.mango/config.toml`. Configure chaves de
provedor como `GEMINI_API_KEY` quando estiver pronto para usar modelos hospedados. Configurações
opcionais de runtime incluem `API_HOST`, `API_PORT` e `DATABASE_PATH`.
Veja [`mangostudio`](https://github.com/juliopolycarpo/mangostudio/blob/5490f9a050c73225da1673d7dce7f6f1300b548c/packages/cli/README.md) para o ambiente completo.
Para deploy em container, veja [`docs/operations/deployment.md`](/en/docs/operations/deployment#docker).

## Pré-requisitos (desenvolvimento)

- [Bun](https://bun.sh/) (v1.3.14+)
- Uma ou mais chaves de API para os provedores suportados (Gemini, compatíveis com OpenAI, Anthropic)

## Desenvolver a partir do código-fonte

1. Clone o repositório:

   ```bash
   git clone <repo-url>
   cd mangostudio
   ```

2. Instale as dependências:

   ```bash
   bun install
   ```

3. Inicie os servidores de desenvolvimento:

   ```bash
   bun run dev
   ```

   Isso inicia:
   - **API** em `http://localhost:3001` (Elysia + Kysely/SQLite)
   - **Frontend** em `http://localhost:5173` (Vite + React)

## Configuração de Conectores (Secrets)

O MangoStudio possui um sistema flexível de múltiplos conectores que permite gerenciar várias chaves de API com diferentes níveis de persistência.

### Métodos de Persistência Suportados

1. **OS Secret Store** — Armazenamento nativo seguro do sistema operacional (via `Bun.secrets`). Recomendado para maior segurança.
2. **config.toml** — Armazena chaves em `~/.mango/config.toml`. Ideal para compartilhar chaves entre instâncias ou ferramentas CLI.
3. **Arquivo .env** — Adiciona variáveis ao arquivo `~/.mango/.env`.

### Como Configurar

Acesse a página **Configurações** na interface do MangoStudio para adicionar e gerenciar conectores.

Para cada conector, é possível habilitar ou desabilitar modelos específicos (ex: Gemini 2.5 Flash, Gemini 2.0 Flash Image). O MangoStudio seleciona automaticamente o conector correto com base no modelo ativo no chat.

### Sincronização via Terminal

Você pode adicionar chaves manualmente em `~/.mango/config.toml`:

```toml
[gemini_api_keys]
pessoal = "sua-chave-aqui"
trabalho = "outra-chave-aqui"
```

O MangoStudio sincroniza essas chaves automaticamente ao carregar a página de Configurações ou ao iniciar uma geração.

## Estrutura do Projeto

```
mangostudio/
├── .mango/            # Templates de configuração de exemplo
│   └── config.toml.example
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── lib/                # Config, runtime paths, SPA guard
│   │       ├── modules/            # Módulos de domínio (inspirados em DDD)
│   │       │   ├── chats/          # application/ domain/ http/ infrastructure/
│   │       │   ├── messages/       # application/ domain/ http/ infrastructure/
│   │       │   ├── generation/     # application/ domain/ http/ infrastructure/
│   │       │   ├── connectors/     # application/ domain/ http/ infrastructure/
│   │       │   ├── app-settings/   # application/ http/ infrastructure/
│   │       │   ├── provider-settings/  # application/ http/ infrastructure/
│   │       │   ├── tool-settings/  # application/ http/ infrastructure/
│   │       │   ├── prompt-rules/   # application/ http/
│   │       │   └── attachments/    # application/ infrastructure/
│   │       ├── plugins/            # Auth guard, rate limiting, error handler
│   │       ├── services/           # Provedores de IA, tools, secrets, imagens geradas
│   │       │   ├── providers/      # Implementações multi-provedor + infra core
│   │       │   ├── tools/          # Registro de ferramentas + ferramentas built-in
│   │       │   └── generated-images/  # Armazenamento de imagens geradas
│   │       └── db/                 # Kysely + SQLite + migrações
│   ├── frontend/
│   │   └── src/
│   │       ├── components/
│   │       │   └── ui/             # Design system (Button, Input, Card, Spinner, Toast, Toggle)
│   │       ├── features/           # Módulos de feature (chat, gallery, generation, settings, sidebar)
│   │       ├── hooks/              # React hooks (use-i18n, use-app-state, use-model-catalog…)
│   │       └── routes/             # Páginas TanStack Router
│   └── shared/
│       └── src/
│           ├── contracts/          # Barrel de contratos
│           ├── <module>/           # Contratos + schemas por módulo (auth, chat, connectors…)
│           ├── streaming/          # Tipos e schemas de eventos SSE
│           ├── types/              # Tipos de domínio (provider, agent-events, gallery)
│           ├── i18n/               # Dicionários pt-BR / en + tipos
│           └── test-utils/         # Mock factories compartilhadas
├── docs/
│   ├── README.md                   # Hub da documentação
│   ├── architecture/              # Arquitetura e fluxos transversais
│   ├── features/                  # Documentação por área do produto
│   ├── providers/                 # Guias e notas por provedor
│   ├── reference/                 # API, testes e mapas de arquivos
│   ├── guides/                    # Guias práticos para contribuição
│   ├── operations/                # Deploy e segurança
│   └── pt-br/                     # Traduções curadas em Português
├── package.json                    # Raiz do Bun workspace
└── tsconfig.json                   # Configuração base de TypeScript
```

## Scripts Principais

| Comando                   | Descrição                                                              |
| ------------------------- | ---------------------------------------------------------------------- |
| `bun install`             | Instala todas as dependências do workspace                             |
| `bun run dev`             | Inicia todos os servidores de dev simultaneamente                      |
| `bun run dev --api`       | Inicia apenas o servidor de dev da API                                 |
| `bun run build`           | Build do frontend para produção                                        |
| `bun run build --binary`  | Gera binários standalone com frontend embutido                         |
| `bun run check`           | Executa Biome, dprint, madge e typecheck                               |
| `bun run test`            | Executa as lanes unit e integration                                    |
| `bun run test --unit`     | Executa apenas as suítes unitárias                                     |
| `bun run test:e2e:setup`  | Instala Playwright Chromium para browser smoke                         |
| `bun run test --e2e`      | Executa a suíte end-to-end com Playwright (opt-in)                     |
| `bun run test --coverage` | Coleta cobertura de testes nos workspaces aplicáveis                   |
| `bun run test:scripts`    | Executa testes de automação em `scripts/`                              |
| `bun run fix`             | Aplica correções do Biome e dprint                                     |
| `bun run verify`          | Gate CI local completo: check, test --coverage, build --all            |
| `bun run clean`           | Remove dist, relatórios locais de teste, coverage e artefatos de build |

## Ferramentas de Desenvolvimento

| Ferramenta     | Escopo                                               | Funcionalidade Principal                          |
| -------------- | ---------------------------------------------------- | ------------------------------------------------- |
| **Biome**      | JS, TS, JSX, TSX, JSON, JSONC, CSS, HTML             | Linter e formatador com regras unificadas         |
| **dprint**     | Markdown, MDX, TOML, YAML, Dockerfile                | Formatador plugável com plugins WASM              |
| **lefthook**   | Git hooks (pre-commit)                               | Gerenciador de hooks Git para validação em commit |
| **madge**      | Grafos de dependência JS/TS                          | Detecção de dependências circulares               |
| **jscpd**      | Todos os arquivos fonte                              | Detecção de código duplicado                      |
| **bun:test**   | Testes unitários (api, shared, lógica pura frontend) | Executor nativo rápido com cobertura LCOV         |
| **Vitest**     | Testes React frontend e dependentes do Vite          | jsdom, plugins Vite, cobertura e watch            |
| **Playwright** | Testes end-to-end no Chromium                        | Automação de navegador para fluxos de auth        |

Estes binários são instalados como devDependencies e invocados através dos scripts `bun run`. Nenhuma instalação global é necessária.

## Validação Local

### Git Hooks

Um hook [lefthook](https://github.com/evilmartians/lefthook) de pre-commit é instalado automaticamente via `bun install` (através do script `prepare`). Ele executa as seguintes verificações em paralelo a cada `git commit`:

| Hook                 | Gatilho      | Arquivos alvo               | Comando                                                                |
| -------------------- | ------------ | --------------------------- | ---------------------------------------------------------------------- |
| `biome`              | `pre-commit` | `*.{ts,tsx,js,jsx,json}`    | `bunx biome check --write {staged_files}`                              |
| `dprint`             | `pre-commit` | `*.{md,mdx,toml,yml,yaml}`  | `bunx dprint fmt {staged_files}`                                       |
| `dprint-dockerfile`  | `pre-commit` | `{Dockerfile,Dockerfile.*}` | `bunx dprint fmt {staged_files}`                                       |
| `typecheck-affected` | `pre-commit` | Todos os arquivos staged    | `bun run check --staged --skip-format` (ignorado durante merge/rebase) |

Arquivos formatados são re-adicionados ao stage automaticamente. Todos os hooks devem ser bem-sucedidos para o commit prosseguir.

### Verificações Manuais

- `bun run check` — verificação completa (Biome, dprint, typecheck, dependências circulares).
- `bun run check --staged` — apenas os workspaces afetados pelos arquivos staged (usado pelo hook pre-commit).
- `bun run check --changed` — apenas os workspaces modificados em relação a `origin/main`.
- `bun run fix --staged` — correção automática apenas nos workspaces afetados.

## Arquitetura

| Camada       | Tecnologias                                                                     |
| ------------ | ------------------------------------------------------------------------------- |
| **Frontend** | React 19, Vite 8, Tailwind CSS v4, TanStack Router/Query                        |
| **API**      | Elysia, Better Auth, rate limiting nativo, arquitetura modular inspirada em DDD |
| **Banco**    | SQLite via Kysely (query builder type-safe)                                     |
| **IA**       | Multi-provedor (Gemini, OpenAI, Anthropic, DeepSeek, OpenAI-compatible)         |
| **Runtime**  | Bun — sem dependência de Node.js                                                |
| **i18n**     | Dicionário TypeScript puro em `@mangostudio/shared/i18n`                        |

## Configuração do Editor

Os hooks do Claude Code prependem `node_modules/.bin` ao PATH automaticamente ao iniciar sessão e ao mudar de diretório (`SessionStart` / `CwdChanged`). Após cada escrita ou edição, um hook `PostToolUse` executa `auto-fix.mjs` para formatar o arquivo modificado.

### OpenCode

A configuração de instruções e formatadores do OpenCode está em `opencode.json`.

| Formatador   | Comando                       | Extensões                                                                                        |
| ------------ | ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `biome-fix`  | `biome check --write`         | `.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.mts`, `.cts`, `.json`, `.jsonc`, `.css`, `.html` |
| `dprint-fmt` | `dprint fmt --allow-no-files` | `.md`, `.mdx`, `.toml`, `.yml`, `.yaml`                                                          |

Prettier está desativado. As instruções do OpenCode são carregadas de `.agents/opencode/rules/*.md`.

## Qualidade de Código

### Biome (Lint)

Configurado em `biome.json` com as regras `recommended` ativadas e sobrescritas específicas por workspace.

**Regras globais (todos os arquivos):**

| Categoria   | Regras principais                                   |
| ----------- | --------------------------------------------------- |
| Correctness | Padrões recomendados                                |
| Performance | `noDelete` (warn)                                   |
| Style       | `noNestedTernary` (off), `useBlockStatements` (off) |
| Nursery     | `useAwaitThenable` (off), `useErrorCause` (off)     |

**Sobrescritas TypeScript/TSX (`**/*.{ts,tsx}`):**

| Categoria   | Regras aplicadas                                                                                                                                                                                                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complexity  | `noArguments`, `noBannedTypes`, `noUselessThisAlias`, `noUselessTypeConstraint`, `useLiteralKeys`, `useOptionalChain` — todas `error`                                                                                                                                                  |
| Correctness | `noUnusedVariables` (`error`)                                                                                                                                                                                                                                                          |
| Nursery     | `noBaseToString`, `noDuplicateEnumValues`, `noFloatingPromises`, `noForIn`, `noImpliedEval`, `noMisusedPromises`, `noUnsafePlusOperands` — todas `error`                                                                                                                               |
| Style       | `noCommonJs`, `noInferrableTypes`, `noNamespace`, `noNonNullAssertion`, `noUselessElse`, `useArrayLiterals`, `useAsConstAssertion`, `useConst`, `useExponentiationOperator`, `useImportType`, `useNodejsImportProtocol`, `useTemplate`, `useThrowOnlyError` — todas `error`            |
| Suspicious  | `noConsole` (warn, permite `warn`/`error`), `noEmptyBlockStatements`, `noExplicitAny`, `noExtraNonNullAssertion`, `noMisleadingInstantiator`, `noNonNullAssertedOptionalChain`, `noTsIgnore`, `noUnsafeDeclarationMerging`, `noVar`, `useAwait`, `useNamespaceKeyword` — todas `error` |

**Sobrescritas específicas do frontend (`apps/frontend/**/*.{ts,tsx}`):**

| Categoria   | Regras aplicadas                                                                                                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Correctness | `noChildrenProp` (warn), `noNestedComponentDefinitions` (error), `noRenderReturnValue` (error), `noVoidElementsWithChildren` (error), `useExhaustiveDependencies` (error), `useHookAtTopLevel` (error), `useJsxKeyInIterable` (error) |
| Nursery     | `noComponentHookFactories` (error), `noJsxNamespace` (error), `noScriptUrl` (warn), `useReactAsyncServerFunction` (error)                                                                                                             |
| Security    | `noDangerouslySetInnerHtml` (warn), `noDangerouslySetInnerHtmlWithChildren` (error)                                                                                                                                                   |
| Suspicious  | `noArrayIndexKey` (warn), `noCommentText` (error), `noReactForwardRef` (warn), `noSuspiciousSemicolonInJsx` (error)                                                                                                                   |

**Atenuações por workspace:**

| Workspace / caminho                                                    | Regra atenuada                          |
| ---------------------------------------------------------------------- | --------------------------------------- |
| `apps/api/src/**`                                                      | `nursery.noUnnecessaryConditions` (off) |
| `scripts/**`                                                           | `suspicious.noConsole` (off)            |
| `apps/api/src/services/`, `utils/`, `lib/`, `db/` e `apps/shared/src/` | `nursery.useExplicitType` (off)         |

**Configurações adicionais de formatação:**

- Largura de linha: 100, indentação: 2 espaços, aspas simples, ponto e vírgula, vírgulas finais (es5)
- Parser CSS ativa diretivas Tailwind
- Formatador HTML auto-fecha elementos void
- `assist.actions.source.organizeImports` ativado

### dprint (Formatação)

Configurado em `dprint.json` com o seguinte escopo e configurações:

| Configuração             | Valor                                                                                                                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Largura de linha         | 100                                                                                                                                                                                          |
| Indentação               | 2 espaços                                                                                                                                                                                    |
| Fim de linha             | LF                                                                                                                                                                                           |
| Tabulação                | false                                                                                                                                                                                        |
| Quebra de texto Markdown | `maintain`                                                                                                                                                                                   |
| Inclusões                | `**/*.{md,mdx,toml,yml,yaml}`, `**/Dockerfile`, `**/Dockerfile.*`                                                                                                                            |
| Exclusões                | `node_modules`, `dist`, `coverage`, `build`, `test-results`, `playwright-report`, `.jscpd-out`, `.qa-gate`, `.mango/artifacts`, `.mango/out`, `routeTree.gen.ts`, `CHANGELOG.md`, `bun.lock` |
| Plugins                  | markdown (WASM), toml (WASM), dockerfile (WASM), pretty_yaml                                                                                                                                 |

### Dependências Circulares

Detectadas via `madge` como parte do `bun run check`. A verificação falha se existirem caminhos de importação circular entre os pacotes do workspace.

### Detecção de Código Duplicado

Verificada via `jscpd` durante CI (qa-gate). A configuração é definida diretamente em `scripts/qa-gate/collect.ts`.

## Design System

O frontend usa um design system próprio em `apps/frontend/src/components/ui/`:

- **`Button`** — variantes `primary`, `secondary`, `ghost`; prop `loading`
- **`Input`** — label, mensagem de erro, spread de `InputHTMLAttributes`
- **`Card`** — variantes `glass` (glassmorphism) e `solid`
- **`Spinner`** — indicador de carregamento com tamanhos `sm`, `md`, `lg`
- **`Toast`** — notificações não-bloqueantes via hook `useToast()`
- **`Toggle`** — interruptor com foco em acessibilidade

## Internacionalização (i18n)

Strings de UI centralizadas em `@mangostudio/shared/i18n`. Suporte a pt-BR (padrão) e en, com detecção automática via `navigator.language`.

```tsx
import { useI18n } from '@/hooks/use-i18n';

function MyComponent() {
  const { t } = useI18n();
  return <h1>{t.auth.loginTitle}</h1>;
}
```

O tipo `Messages` é inferido diretamente do dicionário `pt-BR.ts` (`as const`). Adicionar uma chave sem traduzir em `en.ts` gera erro de compilação imediatamente.

## Documentação

- [`./README.md`](/docs/quickstart) — hub da documentação em Português
- [`./guides/contributor-quickstart.md`](/docs/guides/contributor-quickstart) — onboarding rápido para contribuidores
- [`./architecture/continuation.md`](/docs/architecture/continuation) — arquitetura de continuação
- [`./providers/development.md`](/docs/providers/development) — guia de integração de provedores
- [`./reference/cli.md`](/docs/reference/cli) — referência da CLI e canais de instalação
- [`./reference/releasing.md`](/docs/reference/releasing) — runbook de release e canais de distribuição
- [`./reference/testing.md`](/docs/reference/testing) — estratégia e guia de testes
- [`./reference/agent-playbooks.md`](/docs/reference/agent-playbooks) — mapas de arquivos por feature
- [`./CONTRIBUTING.md`](/docs/guides/contributing) — diretrizes de contribuição em Português

## Estrutura Espelhada

`docs/pt-br/` agora espelha a mesma organização de `docs/` com subpastas por responsabilidade:

- `architecture/`
- `features/`
- `providers/`
- `reference/`
- `guides/`
- `operations/`

Quando uma alteração relevante for feita em `docs/`, a versão correspondente em `docs/pt-br/` deve ser atualizada na mesma tarefa para manter o espelho consistente.

## Notas de Build Standalone

O comando `bun run build --binary` compila a API em binários específicos por plataforma em `.mango/out/<platform>/`.

- O banco de dados é persistido em `~/.mango/database.sqlite` por padrão.
- Os assets do frontend são servidos a partir do diretório `public/` vizinho ao executável.

## Licença

Este projeto está licenciado sob a [Licença MIT](../../LICENSE).
