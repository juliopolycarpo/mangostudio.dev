# Repository Guidelines

`AGENTS.md` is the canonical instruction file for coding agents in this repository. Update this file
when repository guidance changes. `CLAUDE.md` is only a Claude Code compatibility mirror and must
import this file with `@AGENTS.md`; do not duplicate project guidance there.

## Commands

Use Bun from the repository root. Do not use npm, npx, pnpm, or yarn.

```bash
bun run dev              # local dev server at http://localhost:4321
bun run build            # static Astro build to ./dist
bun run preview          # preview the production build locally
bun run check            # Astro diagnostics, tsgo, Biome, dprint
bun run test             # Bun tests for repo automation
bun run qa               # full local/CI gate
bun run fix              # auto-fix Biome and dprint formatting
bun run typecheck        # Astro diagnostics and tsgo only
bun run deploy:dry-run   # build and validate Wrangler without uploading
```

Run `bun run qa` before handoff after repository changes unless it is explicitly impossible; report
any blocker with the failing command and relevant output.

## Project Shape

This is the public marketing and docs website for MangoStudio. It is a static, bilingual Astro site
with no UI framework, no server code, and no Astro adapter. Cloudflare serves the prebuilt `dist/`
directory through Workers static assets.

Portuguese is the default locale at `/`; English lives under `/en/`. User-facing copy belongs in
`src/i18n/pt.ts` and `src/i18n/en.ts`, both constrained by `SiteContent` in
`src/i18n/types.ts`. Change the type first when the content shape changes, then update both locales.

Language-neutral values such as URLs, install commands, provider glyphs, and versions belong in
`src/data/site.ts`.

## Toolchain Split

Three checkers own non-overlapping file sets:

- Biome lints and formats TypeScript, JavaScript, JSON, JSONC, and CSS. It ignores `.astro`, SVG,
  generated output, and Markdown. Follow the configured style: single quotes, semicolons, es5
  trailing commas, `import type` for types, `node:` import protocol, template literals over string
  concatenation, and no non-null assertions. `console.log` warns; use `console.warn` or
  `console.error` when console output is intentional.
- dprint formats Markdown, TOML, and YAML.
- `tsgo` and `astro check` own type checking, including `.astro` files.

The import alias is `@/*` for `src/*`.

Do not manually edit generated output under `dist/`, `.astro/`, or `.wrangler-dry/`.

## Architecture Rules

- Keep pages thin. Shared page logic belongs in `src/components/`, not duplicated between locale
  routes.
- Use `src/i18n/ui.ts` helpers for localized paths. Do not hand-build `/en/...` URLs.
- Keep interactivity as vanilla TypeScript progressive enhancement under `src/scripts/`.
  Initializers must no-op when their target markup is absent.
- The site must remain readable without JavaScript.
- Styling lives in `src/styles/global.css`; theme state is controlled by `data-theme` on `<html>`.
- Fonts and assets should be local and auditable. Do not add third-party CDNs, analytics, trackers,
  or remote loaded assets without explicit approval.

## Bilingual Content

All localized content should preserve structural parity through the `SiteContent` type. If one
locale gains, removes, or reshapes a key, update the type and both locale files in the same change.
`bun run typecheck` should fail while the locales are out of sync.

`src/pages/*.astro` and `src/pages/en/*.astro` are intentionally thin route wrappers. They should
read the locale with `getLangFromUrl(Astro.url)`, load copy with `useContent(lang)`, and pass
`lang` plus `content` into shared components. The `en/` files exist so Astro emits `/en/` routes;
business and rendering logic should stay in shared components.

`docs/[slug].astro` generates static doc pages from `content.docs.groups` via `getStaticPaths`.

## Client Interactivity

There is no UI framework and no hydration. `BaseLayout.astro` loads `src/scripts/main.ts`, which
initializes progressive enhancements such as theme, copy, install tabs, terminal, and cmdk. Every
initializer must tolerate missing markup so the single bundle is safe on every page.

The no-FOUC theme script in `BaseLayout.astro` runs inline in the document head before first paint.
It reads `localStorage["mango.theme"]`, falls back to `prefers-color-scheme`, sets `data-theme` on
`<html>`, and adds `.js`. `src/scripts/theme.ts` only handles user-triggered toggling.

## Styling

`src/styles/global.css` holds design tokens and shared component CSS. Theme variants are driven by
`data-theme` on `<html>`. Fonts are self-hosted through Fontsource; keep assets local and auditable.

## Cloudflare Safety

`wrangler.jsonc` must stay assets-only:

- no `main` Worker script
- no bindings
- no `vars`
- no `account_id`
- `assets.directory` remains `./dist`

Pull request workflows must not read Cloudflare secrets. Production deploys run only from `main`
through the protected `production` GitHub Environment. Never push directly to `main`; open a pull
request from a feature branch.

## Dependency Updates

Dependabot uses the Bun ecosystem for `package.json` and `bun.lock` updates. If a Dependabot package
PR changes `package.json` without updating `bun.lock`, `lockfile-sync.yml` runs `bun install
--ignore-scripts`, commits only `bun.lock`, and lets the normal QA workflow re-run with
`--frozen-lockfile --ignore-scripts`.

Bun security updates are not currently covered by Dependabot. Keep Dependency Review and CodeQL
enabled as the supply-chain safety gates.

## GitHub Maintenance

Path labels are defined in `.github/labels.json` and applied by `.github/labeler.yml`. After label
definition changes, run:

```bash
bun run labels:check
bun run labels:sync
```

`labels:sync` writes to GitHub and should only be run by a maintainer.
