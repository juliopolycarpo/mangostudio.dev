# mangostudio.dev

Marketing and documentation website for [MangoStudio](https://github.com/juliopolycarpo/mangostudio) —
your local AI studio in a single binary.

Static, bilingual (Portuguese default, English under `/en/`), zero client framework, deployed to
Cloudflare Workers static assets.

## Stack

| Concern        | Tool                                                              |
| -------------- | ----------------------------------------------------------------- |
| Framework      | [Astro](https://astro.build) (static output, no UI framework)     |
| Language       | TypeScript, type-checked with TSGO (`@typescript/native-preview`) |
| Lint + format  | [Biome](https://biomejs.dev) (TS/JS/JSON/CSS)                     |
| Format (prose) | [dprint](https://dprint.dev) (Markdown/TOML/YAML)                 |
| Runtime / PM   | [Bun](https://bun.sh)                                             |
| Fonts          | Self-hosted Geist + Geist Mono (Fontsource) — no third-party CDN  |
| Hosting        | Cloudflare Workers static assets                                  |

Interactivity (theme toggle, ⌘K command palette, install-channel tabs, terminal animation,
copy-to-clipboard) is implemented as small vanilla-TS progressive-enhancement modules in
`src/scripts/` — the site is fully readable with JavaScript disabled.

## Develop

```bash
bun install        # install dependencies
bun run dev        # start the dev server (http://localhost:4321)
bun run build      # build static output to ./dist
bun run preview    # preview the production build locally
```

### Quality gates

```bash
bun run check      # astro check + tsgo + biome + dprint
bun run test       # Bun tests for repo automation
bun run qa         # full CI gate: check + test + build + audit + Wrangler dry-run
bun run fix        # biome --write + dprint fmt (auto-fix)
```

A `lefthook` pre-commit hook runs Biome, dprint and `astro check` on staged files.

## Project layout

```
src/
  i18n/            ui.ts helper + pt.ts / en.ts content (one shared SiteContent type)
  data/site.ts     language-neutral constants (URLs, install commands, providers)
  layouts/         BaseLayout (head, fonts, no-FOUC theme init, header/footer/palette)
  components/       Header, Footer, CommandPalette, Icon, Logo + home/ releases/ docs/
  scripts/         theme · cmdk · install-tabs · terminal · copy (client modules)
  pages/           index, releases, docs/[slug], 404  (+ en/ mirror)
  styles/global.css design tokens + shared component CSS
public/            favicon.svg, robots.txt, install.sh (placeholder)
```

### Internationalization

Portuguese is the default locale (served at `/`); English is served under `/en/`. Page bodies are
shared components driven by a `lang` prop; all copy lives in `src/i18n/pt.ts` and `src/i18n/en.ts`,
which both `satisfies SiteContent` so the two locales can never drift out of structural parity.

## Deploy (Cloudflare Workers static assets)

The site builds to `./dist` and is served by an **assets-only Worker** (no server code) configured in
[`wrangler.jsonc`](./wrangler.jsonc). No Astro adapter is required.

### Pipeline

- **`ci.yml`** — runs `bun run qa` on pull requests. No Cloudflare secrets.
- **`labeler.yml`** — applies path-based `area:` and `type:` labels without checking out PR code.
- **`codeql.yml`** — runs CodeQL JavaScript/TypeScript analysis with `security-extended` queries.
- **`dependency-review.yml`** — blocks new moderate-or-worse vulnerable dependencies in PRs; this
  requires GitHub Dependency graph to stay enabled.
- **`deploy.yml`** — runs on push to `main`: a `verify` job re-runs the QA gate, then a `deploy`
  job (gated behind the protected `production` GitHub Environment) runs `wrangler deploy`.

The PR gate builds the site, audits generated static output for remote loaded assets and secret-like
strings, validates that `wrangler.jsonc` remains assets-only, checks label configuration, and runs a
Wrangler dry-run without Cloudflare credentials.

All third-party actions are pinned to commit SHAs; jobs use least-privilege permissions.

### One-time setup (performed by the maintainer)

1. **Cloudflare API token** — create a token scoped to **Workers Scripts: Edit** (and Workers KV/Assets
   if later needed) at <https://dash.cloudflare.com/profile/api-tokens>.
2. **GitHub secrets** — in repo *Settings → Secrets and variables → Actions*, add:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
3. **Protected environment** — create an Environment named `production`
   (*Settings → Environments*) and, optionally, add required reviewers to require manual approval
   before each deploy.
4. **Custom domain** — after the first deploy, attach `mangostudio.dev` to the Worker in the
   Cloudflare dashboard (*Workers & Pages → mangostudio-dev → Settings → Domains & Routes*).
5. **Dependency graph** — enable *Settings → Code security and analysis → Dependency graph* so
   `dependency-review.yml` can enforce the supply-chain gate.

Manual deploy from a workstation (requires `wrangler login` or the env token):

```bash
bun run deploy            # astro build && wrangler deploy
bun run deploy:dry-run    # validate config without uploading
```

## Security & auditability

- Pull requests never receive deploy credentials; only `main` can deploy.
- Production deploys pass through a protected GitHub Environment (optional manual approval + audit log).
- Actions are SHA-pinned; Dependabot keeps actions and dependencies current.
- Installs use `--frozen-lockfile`; the committed `bun.lock` is the source of truth.
- No analytics, no third-party fonts, no trackers — consistent with MangoStudio's local-first ethos.
- `wrangler.jsonc` is audited to remain assets-only: no Worker script, account id, bindings, or vars.
- Public assets are checked for remote loaded resources and secret-like strings before deploy.

## License

[MIT](./LICENSE) © 2026 Julio Polycarpo
