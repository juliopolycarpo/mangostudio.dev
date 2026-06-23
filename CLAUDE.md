# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository. Keep it aligned with `AGENTS.md`, which is the canonical instruction file for coding
agents.

Marketing + docs website for **MangoStudio** (a separate product repo). Static, bilingual Astro
site with **no UI framework** and **no server code**, deployed as Cloudflare Workers static assets.

## Commands

Use **Bun** (`bun run …`), never npm/yarn/pnpm.

```bash
bun run dev          # dev server at http://localhost:4321
bun run build        # static build to ./dist
bun run preview      # serve the production build locally
bun run check        # FULL CI gate: astro check + tsgo --noEmit + biome check + dprint check
bun run test         # Bun tests for repo automation
bun run qa           # FULL PR gate: check + test + build + static audit + labels + wrangler dry-run
bun run fix          # auto-fix: biome check --write + dprint fmt
bun run typecheck    # astro check + tsgo only
bun run deploy:dry-run  # validate wrangler config without uploading
```

`bun run qa` is the gate that CI enforces — run it before handoff.
A `lefthook` pre-commit hook runs Biome / dprint / `astro check` on staged files automatically.

## Toolchain split (important)

Three formatters/checkers own non-overlapping file sets — don't cross them:

- **Biome** — lints + formats `.ts/.tsx/.js/.json/.jsonc/.css`. It explicitly **ignores `.astro`
  files and Markdown.** Enforced style: single quotes, semicolons, es5 trailing commas, 100-col,
  `import type` for types (`useImportType`), template literals over `+` (`useTemplate`),
  `node:` import protocol, and `noNonNullAssertion: error` (do not use `!`). `console.log` warns;
  only `console.warn`/`console.error` are allowed.
- **dprint** — formats Markdown / TOML / YAML only.
- **`tsgo`** (`@typescript/native-preview`) + **`astro check`** — type-checking, including inside
  `.astro` files. Astro file formatting/linting lives here, not in Biome.

Import alias: `@/*` → `src/*` (set in `tsconfig.json`).

## Architecture

### Bilingual content with a structural-parity contract — the central design

Portuguese is the **default** locale (served at `/`); English lives under `/en/`. All user-facing
copy lives in `src/i18n/pt.ts` and `src/i18n/en.ts`. Both files `satisfies SiteContent` (the
interface in `src/i18n/types.ts`), so **the type checker guarantees the two locales can never drift
out of structural parity** — if one has a key, the other must too.

To add or change any copy: edit the `SiteContent` type in `types.ts` first (if the shape changes),
then update **both** `pt.ts` and `en.ts`. `bun run typecheck` will fail until they match.

`src/data/site.ts` holds **language-neutral** constants (GitHub URLs, install commands, provider
glyphs, version) — keep locale-independent values here, not in the i18n files.

### Pages are thin; components do the work

`src/pages/*.astro` and their `src/pages/en/*.astro` mirrors are near-identical wrappers: each
reads the locale via `getLangFromUrl(Astro.url)`, loads copy via `useContent(lang)`, and passes
`lang` + `content` into a shared component under `src/components/`. The `en/` page files exist so
Astro emits the `/en/` routes; logic stays in the shared components, never duplicated per locale.

Routing helpers in `src/i18n/ui.ts` (`routes`, `localizePath`, `alternatePath`, `otherLang`)
encapsulate locale-prefixing — components must use these and never hand-assemble `/en/...` paths.

`docs/[slug].astro` generates static doc pages from `content.docs.groups` via `getStaticPaths`.

### Client interactivity = vanilla-TS progressive enhancement

No framework, no hydration. `BaseLayout.astro` loads a single entry, `src/scripts/main.ts`, which
calls each `init*` (theme, copy, install-tabs, terminal, cmdk). **Every initializer must no-op when
its target markup is absent** so the one bundle is safe to load on every page. The site stays fully
readable with JavaScript disabled — keep new interactivity in this enhancement style.

The no-FOUC theme is an `is:inline` script in `BaseLayout`'s `<head>` that runs before first paint:
it reads `localStorage["mango.theme"]` (falling back to `prefers-color-scheme`), sets
`data-theme` on `<html>`, and adds a `.js` class. `src/scripts/theme.ts` only handles toggling.

### Styling

`src/styles/global.css` holds design tokens and shared component CSS; theming is driven by the
`data-theme` attribute on `<html>`. Fonts (Geist + Geist Mono) are self-hosted via Fontsource —
no third-party CDN, consistent with the local-first ethos (no analytics/trackers either).

## Deploy

Fully static — **no Astro adapter**. `wrangler.jsonc` defines an assets-only Worker (no `main`,
no binding) that serves `./dist` from Cloudflare's edge. `astro.config.mjs` uses
`build.format: 'directory'` so output is `dist/<route>/index.html`, matching Cloudflare's
`html_handling: auto-trailing-slash`.

CI (`ci.yml`) validates PRs only (no secrets). `deploy.yml` runs on push to `main`: re-verifies the
full QA gate, then deploys via a protected `production` GitHub Environment. Never push to `main` —
open a PR from a feature branch.
