# First-publish readiness checklist

Use this checklist before the first production publish of `mangostudio.dev`. It tracks settings that
live outside git, plus the repo-side gates that must be green before `main` is ready to deploy.

Do not record secret values in this file or in issues. Record only whether each setting exists and
how it was verified.

## External configuration

These settings are not stored in the repository. Check them off only after verifying the current
GitHub or Cloudflare state.

- [ ] GitHub Actions secret `CLOUDFLARE_ACCOUNT_ID` exists.

  **Verify:** run `gh secret list --repo juliopolycarpo/mangostudio.dev` and confirm the secret name
  is listed. GitHub does not print the value.

  **Blocks publish:** yes.

- [ ] GitHub Actions secret `CLOUDFLARE_API_TOKEN` exists.

  **Verify:** run `gh secret list --repo juliopolycarpo/mangostudio.dev` and confirm the secret name
  is listed. The token should be scoped to Workers Scripts: Edit, plus Workers Assets if Cloudflare
  requires that scope for static-assets deploys.

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

- [ ] First-deploy follow-up is assigned: attach and record the Cloudflare Worker custom domain or
      route for `mangostudio.dev` after the Worker exists.

  **Verify:** check *Workers & Pages -> mangostudio-dev -> Settings -> Domains & Routes* in the
  Cloudflare dashboard after the first deploy.

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

- [ ] Static audit and production smoke tests are green.

  **Verify:** run `bun run audit:static` and `bun run smoke:dist`, or confirm both steps passed as
  part of `bun run qa`.

  **Blocks publish:** yes.

- [ ] Content truthfulness work is merged.

  **Verify:** confirm the content-readiness issues and pull requests required for first publish are
  closed and merged before publishing: #5, #6, #7, #8, #15, and #17.

  **Blocks publish:** yes.

## Only the token is missing

The first deploy is ready when every box above is checked except `CLOUDFLARE_API_TOKEN` and the
custom-domain follow-up is assigned. At that point, the only remaining pre-deploy action is adding
that GitHub Actions secret with the scoped Cloudflare API token. After adding it, run or trigger the
documented deploy path from `main`, then complete the Cloudflare domain follow-up before public
launch.
