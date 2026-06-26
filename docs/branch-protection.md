# Branch protection for `main`

`main` is the production deploy branch. It should accept changes only through pull requests whose
required checks prove the site can build, deploy, and preserve an auditable commit history.

The importable ruleset lives at [`.github/rulesets/main.json`](../.github/rulesets/main.json). A
maintainer applies it manually because GitHub repository rules are external state, but the intended
policy is versioned here so changes are reviewable.

## Required checks

The required status-check contexts must match GitHub job names exactly. If a workflow name, job
`name`, or CodeQL matrix language changes, update the ruleset and this table in the same pull
request.

| Check context                     | Source                  | Job/name                                                                                     |
| --------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------- |
| `Commit policy`                   | `ci.yml`                | `jobs.commit-policy.name: Commit policy`                                                     |
| `QA gate`                         | `ci.yml`                | `jobs.check.name: QA gate`                                                                   |
| `Analyze (javascript-typescript)` | `codeql.yml`            | `jobs.analyze.name: Analyze (${{ matrix.language }})` with `language: javascript-typescript` |
| `Analyze (actions)`               | `codeql.yml`            | `jobs.analyze.name: Analyze (${{ matrix.language }})` with `language: actions`               |
| `Dependency Review`               | `dependency-review.yml` | `jobs.dependency-review.name: Dependency Review`                                             |
| `Apply path-based labels`         | `labeler.yml`           | `jobs.label.name: Apply path-based labels`                                                   |

`Apply path-based labels` is intentionally required because the labeler also verifies that every pull
request receives at least one `area:` label and one `type:` label.

## Policy

- Require a pull request before merging into `main`; direct pushes are blocked.
- Require branches to be up to date before merge.
- Require the status checks listed above.
- Require GitHub-verified signed commits.
- Require linear history and allow only squash or rebase merges.
- Block force pushes and branch deletion.
- Require review-thread resolution.
- Set required approving reviews to `0` while this is a solo-maintainer website. Increase it to `1`
  when collaborators join.
- Do not configure bypass actors. Admin bypass should be an explicit GitHub settings exception, not
  the default.

## Commit policy

Every commit must have:

- a non-empty body explaining what changed and why;
- a DCO `Signed-off-by:` trailer whose email matches the author or committer;
- a GPG or SSH signature.

The local Lefthook configuration enforces this policy in four places:

- `commit-msg` blocks missing bodies and invalid DCO trailers before a commit is created;
- `post-commit` verifies the newly created commit object has the required signature header;
- `post-rewrite` rechecks rewritten commits after amend or rebase;
- `pre-push` blocks pushed commits that miss the required body, DCO trailer, or signature.

The `Commit policy` CI job runs the same verifier over pull request commits so hook bypasses are
visible in required checks. GitHub's `required_signatures` ruleset rule remains the authoritative
server-side signature verifier for `main`.

## Apply or update the ruleset

Only a maintainer should apply the ruleset:

```bash
gh api --method POST repos/juliopolycarpo/mangostudio.dev/rulesets \
  --input .github/rulesets/main.json
```

If a `main` ruleset already exists, update that ruleset id instead of creating a duplicate:

```bash
ruleset_id="$(gh api repos/juliopolycarpo/mangostudio.dev/rulesets \
  --jq '.[] | select(.name == "main") | .id')"
gh api --method PUT "repos/juliopolycarpo/mangostudio.dev/rulesets/$ruleset_id" \
  --input .github/rulesets/main.json
```

Verify the stored settings after applying them:

```bash
gh api repos/juliopolycarpo/mangostudio.dev/rulesets \
  --jq '.[] | select(.name == "main") | {name, target, enforcement, rules: [.rules[].type]}'
```

GitHub classic branch protection can enforce a similar subset through
`repos/{owner}/{repo}/branches/main/protection`, but rulesets are preferred because the JSON
definition is importable, diffable, and easier to audit.
