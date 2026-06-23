# Repository Guidelines

`AGENTS.md` is the canonical instruction file for coding agents in this repository. Keep
`CLAUDE.md` aligned for Claude Code users.

## Commands

Use Bun from the repository root. Do not use npm, npx, pnpm, or yarn.

```bash
bun run dev              # local dev server at http://localhost:4321
bun run build            # static Astro build to ./dist
bun run preview          # preview the production build locally
bun run check            # Astro diagnostics, tsgo, Biome, dprint
bun run test             # Bun tests
bun run qa               # full local/CI gate
bun run fix              # auto-fix Biome and dprint formatting
bun run deploy:dry-run   # build and validate Wrangler without uploading
```

Run `bun run qa` before handoff after repository changes.

## Project Shape

This is the public marketing and docs website for MangoStudio. It is a static, bilingual Astro site
with no UI framework, no server code, and no Astro adapter. Cloudflare serves the prebuilt `dist/`
directory through Workers static assets.

Portuguese is the default locale at `/`; English lives under `/en/`. User-facing copy belongs in
`src/i18n/pt.ts` and `src/i18n/en.ts`, both constrained by `SiteContent` in
`src/i18n/types.ts`. Change the type first when the content shape changes, then update both locales.

Language-neutral values such as URLs, install commands, provider glyphs, and versions belong in
`src/data/site.ts`.

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

## Tool Ownership

- Biome owns TS, JS, JSON, JSONC, and CSS.
- dprint owns Markdown, TOML, and YAML.
- Astro and TSGO own type checking, including `.astro` files.

Do not manually edit generated output under `dist/`, `.astro/`, or `.wrangler-dry/`.

## Cloudflare Safety

`wrangler.jsonc` must stay assets-only:

- no `main` Worker script
- no bindings
- no `vars`
- no `account_id`
- `assets.directory` remains `./dist`

Pull request workflows must not read Cloudflare secrets. Production deploys run only from `main`
through the protected `production` GitHub Environment.

## GitHub Maintenance

Path labels are defined in `.github/labels.json` and applied by `.github/labeler.yml`. After label
definition changes, run:

```bash
bun run labels:check
bun run labels:sync
```

`labels:sync` writes to GitHub and should only be run by a maintainer.
