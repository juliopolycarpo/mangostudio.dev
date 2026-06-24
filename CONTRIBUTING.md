# Contributing to mangostudio.dev

This repository is the public marketing and documentation website for
[MangoStudio](https://github.com/juliopolycarpo/mangostudio). App, CLI, installer, provider, and
runtime issues belong in the main product repository.

## Prerequisites

- [Bun](https://bun.sh/) v1.3.14 or newer
- Git with commit signing configured

## Development

```bash
bun install
bun run dev
```

The local dev server runs at <http://localhost:4321>.

## Quality Gate

Run the same gate used by CI before opening a pull request:

```bash
bun run qa
```

That command runs:

- Astro diagnostics and TSGO type checking
- Biome and dprint checks
- Bun tests
- Static build
- Public static-output audit
- Label configuration validation
- Wrangler deploy dry-run without Cloudflare credentials

Use `bun run fix` for formatter fixes. Do not use npm, pnpm, or yarn.

## Content

Portuguese is the default locale at `/`; English lives under `/en/`. All user-facing copy is kept in
`src/i18n/pt.ts` and `src/i18n/en.ts`, both constrained by `SiteContent` in `src/i18n/types.ts`.
When copy shape changes, update the shared type first and then update both locales.

## Deployment

Production deploys run only after a merge to `main`. The deploy workflow rebuilds and audits the
site, then deploys via Cloudflare Workers static assets through the protected `production` GitHub
Environment. Pull request workflows never receive Cloudflare credentials.

## Commits

Use Conventional Commits, sign commits, and include a DCO sign-off:

```bash
git commit -s -S -m "type(scope): subject" -m "what changed and why"
```

Allowed types are `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`,
`chore`, and `revert`.
