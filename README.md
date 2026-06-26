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

`lefthook` runs Biome, dprint, and `astro check` before commits. It also blocks commits and pushes
that miss the required commit body, DCO signoff, or GPG/SSH signature.

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
- **`lockfile-sync.yml`** — refreshes `bun.lock` on Dependabot package PRs if the lockfile drifts.
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

Use [`docs/first-publish-checklist.md`](./docs/first-publish-checklist.md) as the canonical,
checkable first-publish list for these external settings.

1. **Cloudflare API token** — create a token scoped to **Workers Scripts: Edit** (and Workers KV/Assets
   if later needed) at <https://dash.cloudflare.com/profile/api-tokens>.
2. **Protected environment** — create an Environment named `production`
   (*Settings → Environments*) and, optionally, add required reviewers to require manual approval
   before each deploy. The `deploy` job declares `environment: production`, so these values are
   resolved only after the QA gate passes and any approval is granted, before
   `cloudflare/wrangler-action` reads them.
3. **Environment-scoped deploy credentials** — add the Cloudflare values to the `production`
   Environment (*Settings → Environments → production → Environment secrets*), not to repository-wide
   Actions secrets:
   - `CLOUDFLARE_API_TOKEN` — Environment **secret**. Keep it out of repository-wide secrets so it is
     never exposed to non-deploy workflows.
   - `CLOUDFLARE_ACCOUNT_ID` — Environment **secret** is recommended for public-repo hygiene. An
     Environment **variable** is acceptable if the maintainer deliberately accepts that the account id
     becomes readable in workflow logs.
4. **Custom domain** — `wrangler.jsonc` declares `mangostudio.dev` as a `custom_domain` route, so the
   apex binds on deploy. Point the apex DNS record at Cloudflare and, if `www` should reach the site,
   configure a `www → apex` redirect with a Cloudflare DNS record plus a Redirect Rule. The Worker
   does not serve `www`; that redirect is external Cloudflare configuration.
5. **Dependency graph** — enable *Settings → Code security and analysis → Dependency graph* so
   `dependency-review.yml` can enforce the supply-chain gate.
6. **Branch ruleset** — apply the checked-in
   [`main` ruleset](./docs/branch-protection.md) so pull requests, required checks, signed commits,
   linear history, and deletion/force-push protections are enforced before first publish.

Manual deploy from a workstation (requires `wrangler login` or the env token):

```bash
bun run deploy            # astro build && wrangler deploy
bun run deploy:dry-run    # validate config without uploading
```

## Security & auditability

- Pull requests never receive deploy credentials; only `main` can deploy.
- Production deploys pass through a protected GitHub Environment (optional manual approval + audit log).
- `main` is protected by a repository ruleset requiring pull requests, up-to-date required checks,
  signed commits, linear history, and no force pushes or deletion.
- Actions are SHA-pinned; Dependabot keeps actions and Bun dependencies current.
- Dependabot uses the Bun ecosystem so dependency updates resolve `package.json` and `bun.lock`
  together. A restricted lockfile-sync workflow fixes Dependabot package PRs if the lockfile still
  drifts.
- Installs use `--frozen-lockfile --ignore-scripts`; the committed `bun.lock` is the source of
  truth and dependency lifecycle scripts do not run in CI.
- Dependabot does not currently cover Bun security updates; CodeQL and Dependency Review still run
  as supply-chain gates.
- No analytics, no third-party fonts, no trackers — consistent with MangoStudio's local-first ethos.
- `wrangler.jsonc` is audited to remain assets-only: no Worker script, account id, bindings, or vars.
  The audit also pins the single apex `custom_domain` route and rejects a `www` binding.
- Public assets are checked for remote loaded resources and secret-like strings before deploy.

## License

[MIT](./LICENSE) © 2026 Julio Polycarpo
