# First-publish readiness checklist

Use this checklist before the first production publish of `mangostudio.dev`. It tracks settings that
live outside git, plus the repo-side gates that must be green before `main` is ready to deploy.

Do not record secret values in this file or in issues. Record only whether each setting exists and
how it was verified.

## External configuration

These settings are not stored in the repository. Check them off only after verifying the current
GitHub or Cloudflare state.

- [ ] `production` Environment secret `CLOUDFLARE_ACCOUNT_ID` exists.

  **Verify:** run `gh secret list --env production --repo juliopolycarpo/mangostudio.dev` and confirm
  the secret name is listed. An Environment secret is recommended for public-repo hygiene. If you
  deliberately store the account id as an Environment variable instead, run
  `gh variable list --env production --repo juliopolycarpo/mangostudio.dev` to confirm it. GitHub does
  not print secret values.

  **Blocks publish:** yes.

- [ ] `production` Environment secret `CLOUDFLARE_API_TOKEN` exists.

  **Verify:** run `gh secret list --env production --repo juliopolycarpo/mangostudio.dev` and confirm
  the secret name is listed. Keep this token scoped to the `production` Environment, not a
  repository-wide Actions secret, so non-deploy workflows never receive it. The token should be scoped
  to Workers Scripts: Edit, plus Workers Assets if Cloudflare requires that scope for static-assets
  deploys.

  **Blocks publish:** yes. This is the expected final missing item before publish.

- [ ] GitHub Environment `production` exists.

  **Verify:** run
  `gh api repos/juliopolycarpo/mangostudio.dev/environments --jq '.environments[].name'` and confirm
  `production` is listed.

  **Blocks publish:** yes.

- [ ] `production` environment reviewers are configured or intentionally skipped.

  **Verify:** run
  `gh api repos/juliopolycarpo/mangostudio.dev/environments/production --jq '{name, reviewers:.reviewers}'`
  or check *Settings -> Environments -> production* in GitHub. Record the choice in the tracking
  issue or pull request notes.

  **Blocks publish:** no. Reviewers are optional, but the choice should be explicit.

- [ ] GitHub Dependency graph is enabled.

  **Verify:** check *Settings -> Code security and analysis -> Dependency graph* in GitHub. The
  `dependency-review.yml` workflow depends on this setting.

  **Blocks publish:** yes.

- [ ] Branch protection or rulesets require the expected `main` checks.

  **Verify:** check *Settings -> Rules -> Rulesets* or *Settings -> Branches* in GitHub, and compare
  the required checks and protections with [`docs/branch-protection.md`](./branch-protection.md).

  **Blocks publish:** yes.

- [ ] First manual deploy path is documented and rehearsed.

  **Verify:** confirm the maintainer can navigate to *Actions -> Deploy -> Run workflow*, select
  `main`, and start the `workflow_dispatch` path when ready. Rehearsal may stop before clicking the
  final run button.

  **Blocks publish:** yes.

- [ ] First-deploy follow-up is assigned: confirm the apex custom domain `mangostudio.dev` attaches
      to the Worker after the first deploy.

  **Verify:** `wrangler.jsonc` declares `mangostudio.dev` as a `custom_domain` route, so the binding
  is created on deploy. Confirm the apex DNS record points at Cloudflare and check
  *Workers & Pages -> mangostudio-dev -> Settings -> Domains & Routes* in the Cloudflare dashboard
  after the first deploy. A `www -> apex` redirect, if wanted, is separate Cloudflare DNS/Redirect
  Rule configuration, not a Worker route.

  **Blocks publish:** no for the first deploy that creates the Worker; yes for public launch.

## Repo-side gates

These gates are enforced in CI, but they are listed here so the final readiness state is auditable in
one place.

- [ ] `bun run qa` passes on `main`.

  **Verify:** run `bun run qa` locally from the repository root and confirm the latest `main` CI run
  is green.

  **Blocks publish:** yes.

- [ ] Local commit hooks are installed on the maintainer workstation.

  **Verify:** run `bun run prepare` or `bunx lefthook install`, then confirm `git commit` and
  `git push` invoke the commit policy hooks documented in
  [`docs/branch-protection.md`](./branch-protection.md).

  **Blocks publish:** yes.

- [ ] Static audit and local dist smoke tests are green.

  **Verify:** run `bun run audit:static` and `bun run smoke:dist`, or confirm both steps passed as
  part of `bun run qa`. These checks run offline against the built `dist/` output and do not hit the
  public internet.

  **Blocks publish:** yes.

- [ ] Production URL smoke tests pass after deploy.

  **Verify:** confirm the `Smoke test production URLs` step passed in the latest *Actions -> Deploy*
  workflow run on `main`, or run `bun run smoke:production` locally once Cloudflare DNS, the apex
  custom domain, and the `www -> apex` redirect rule are configured. The check issues `HEAD` requests
  to `https://mangostudio.dev/` (expects `200`) and
  `https://www.mangostudio.dev/docs/quickstart?smoke=1` (expects `301` or `308` to the apex with
  path and query preserved).

  **Blocks publish:** yes for public launch; no for the first deploy that only creates the Worker
  before external routing is ready.

- [ ] Content truthfulness work is merged.

  **Verify:** confirm the content-readiness issues and pull requests required for first publish are
  closed and merged before publishing: #5, #6, #7, #8, #15, and #17.

  **Blocks publish:** yes.

## Only the token is missing

The first deploy is ready when every box above is checked except `CLOUDFLARE_API_TOKEN` and the
custom-domain follow-up is assigned. At that point, the only remaining pre-deploy action is adding the
scoped Cloudflare API token as a `production` Environment secret. After adding it, run or trigger the
documented deploy path from `main`, then complete the Cloudflare domain follow-up before public
launch.
