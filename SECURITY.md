# Security Policy

## Reporting a Vulnerability

Do not open public issues for vulnerabilities, secrets, or private data. Use a private GitHub
Security Advisory instead:

<https://github.com/juliopolycarpo/mangostudio.dev/security/advisories/new>

For vulnerabilities in the MangoStudio app, CLI, installer, or provider integrations, report them in
the main repository:

<https://github.com/juliopolycarpo/mangostudio/security/advisories/new>

## Supported Versions

Only the latest commit on `main` receives website security fixes.

## Security Model

This website is static Astro output served by Cloudflare Workers static assets.

- There is no server-side application code in this repository.
- `wrangler.jsonc` must remain assets-only: no `main` Worker script, no bindings, no secrets, and no
  account id.
- Pull request checks run without Cloudflare credentials.
- Production deploys run only from `main` through the protected `production` GitHub Environment.
- Cloudflare credentials must live only in GitHub Actions secrets named `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID`.
- Public assets must be auditable from the repository. The QA audit fails on remote loaded assets,
  secret-like strings in `dist/`, and accidental Worker bindings.

## Automation

The required local gate is:

```bash
bun run qa
```

Security-relevant automation includes:

- CodeQL with `security-extended` queries for JavaScript/TypeScript.
- Dependency Review blocking newly introduced moderate-or-worse vulnerabilities. This requires
  GitHub Dependency graph to stay enabled for the repository.
- Static-output audit for Cloudflare deploy posture and public asset integrity.
- Dependabot for npm and GitHub Actions updates.

## What Not to Report

- Missing GPG signatures on commits.
- Missing optional Cloudflare environment reviewer configuration.
- Unpopulated example files.
- Product bugs in MangoStudio itself; use the main product repository for those.
