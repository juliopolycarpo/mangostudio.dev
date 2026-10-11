import { deepStrictEqual, strictEqual } from 'node:assert/strict';

import {
  commitHasSignature,
  outgoingRevListArgs,
  parsePrePushInput,
  parseSignoffs,
  signoffIdentities,
  validateCommitMessage,
} from './verify-commit-policy';

const author = { name: 'Julio Polycarpo', email: 'julio@polycarpo.dev' };

run('valid commit message includes subject, body, and matching DCO trailer', () => {
  deepStrictEqual(
    validateCommitMessage(
      `chore(repo): enforce commit policy

Require signed commits, DCO signoffs, and explanatory commit bodies so
repository history stays auditable.

Signed-off-by: Julio Polycarpo <julio@polycarpo.dev>
`,
      { identities: [author] }
    ),
    []
  );
});

run('DCO trailer does not count as commit body', () => {
  deepStrictEqual(
    validateCommitMessage(
      `chore(repo): enforce commit policy

Signed-off-by: Julio Polycarpo <julio@polycarpo.dev>
`,
      { identities: [author] }
    ),
    ['commit message must include a non-empty body before trailers']
  );
});

run('commit message must use a final DCO Signed-off-by trailer', () => {
  deepStrictEqual(
    validateCommitMessage(`chore(repo): enforce commit policy

Explain what changed and why.
`),
    ['commit message must end with a DCO Signed-off-by trailer']
  );
});

run('commit subject and body require a blank separator', () => {
  deepStrictEqual(
    validateCommitMessage(`chore(repo): enforce commit policy
Explain what changed and why.

Signed-off-by: Julio Polycarpo <julio@polycarpo.dev>
`),
    ['commit subject and body must be separated by a blank line']
  );
});

run('DCO trailer must match an expected author or committer email when provided', () => {
  deepStrictEqual(
    validateCommitMessage(
      `chore(repo): enforce commit policy

Explain what changed and why.

Signed-off-by: Someone Else <else@example.com>
`,
      { identities: [author] }
    ),
    ['DCO Signed-off-by trailer must match the author or committer email']
  );
});

run('git commit comments and scissors are ignored', () => {
  deepStrictEqual(
    validateCommitMessage(
      `chore(repo): enforce commit policy

Explain what changed and why.

Signed-off-by: Julio Polycarpo <julio@polycarpo.dev>
# Please enter the commit message.
# ------------------------ >8 ------------------------
diff --git a/file b/file
`,
      { identities: [author] }
    ),
    []
  );
});

run('commit signature detection accepts GPG and SSH signed commit headers', () => {
  strictEqual(
    commitHasSignature('tree abc\ngpgsig -----BEGIN PGP SIGNATURE-----\n \n\nbody'),
    true
  );
  strictEqual(
    commitHasSignature('tree abc\ngpgsig -----BEGIN SSH SIGNATURE-----\n \n\nbody'),
    true
  );
  strictEqual(commitHasSignature('tree abc\nauthor A <a@example.com> 0 +0000\n\nbody'), false);
});

run('parsePrePushInput decodes pushed ref updates', () => {
  deepStrictEqual(
    parsePrePushInput(
      'refs/heads/topic 1111111111111111111111111111111111111111 refs/heads/topic 0000000000000000000000000000000000000000\n'
    ),
    [
      {
        localRef: 'refs/heads/topic',
        localSha: '1111111111111111111111111111111111111111',
        remoteRef: 'refs/heads/topic',
        remoteSha: '0000000000000000000000000000000000000000',
      },
    ]
  );
});

run('outgoingRevListArgs excludes commits the remote already has on a rewritten branch', () => {
  const localSha = '1111111111111111111111111111111111111111';
  const remoteSha = '2222222222222222222222222222222222222222';
  const args = outgoingRevListArgs(
    { localRef: 'refs/heads/topic', localSha, remoteRef: 'refs/heads/topic', remoteSha },
    'origin'
  );

  deepStrictEqual(
    args,
    ['rev-list', '--reverse', localSha, '--not', remoteSha, '--remotes=origin'],
    `expected rev-list args to exclude: ${remoteSha} and --remotes=origin | received: ${args?.join(' ') ?? 'null'}`
  );
});

run('outgoingRevListArgs lists a new branch against the remote refs only', () => {
  const localSha = '1111111111111111111111111111111111111111';

  deepStrictEqual(
    outgoingRevListArgs(
      {
        localRef: 'refs/heads/topic',
        localSha,
        remoteRef: 'refs/heads/topic',
        remoteSha: '0000000000000000000000000000000000000000',
      },
      'upstream'
    ),
    ['rev-list', '--reverse', localSha, '--not', '--remotes=upstream']
  );
});

run('outgoingRevListArgs returns null when the push deletes a ref', () => {
  strictEqual(
    outgoingRevListArgs(
      {
        localRef: '(delete)',
        localSha: '0000000000000000000000000000000000000000',
        remoteRef: 'refs/heads/topic',
        remoteSha: '2222222222222222222222222222222222222222',
      },
      'origin'
    ),
    null
  );
});

run('signoffIdentities accepts the Dependabot sign-off on commits Dependabot authored', () => {
  const dependabot = {
    name: 'dependabot[bot]',
    email: '49699333+dependabot[bot]@users.noreply.github.com',
  };
  const github = { name: 'GitHub', email: 'noreply@github.com' };
  const emails = signoffIdentities(dependabot, github).map((identity) => identity.email);

  strictEqual(
    emails.includes('support@github.com'),
    true,
    `expected accepted sign-off emails to contain: support@github.com | received: ${emails.join(', ')}`
  );
  deepStrictEqual(
    validateCommitMessage(
      `chore: Bump the dependencies group with 2 updates

Bumps the dependencies group with 2 updates.

Signed-off-by: dependabot[bot] <support@github.com>
`,
      { identities: signoffIdentities(dependabot, github) }
    ),
    []
  );
});

run('a Dependabot squash commit needs the Dependabot sign-off, not only the merger', () => {
  const dependabot = {
    name: 'dependabot[bot]',
    email: '49699333+dependabot[bot]@users.noreply.github.com',
  };
  const github = { name: 'GitHub', email: 'noreply@github.com' };
  const identities = signoffIdentities(dependabot, github);
  const squash = (trailers: string) => `chore: Bump the dependencies group with 2 updates (#1)

Bumps the dependencies group with 2 updates.

${trailers}
`;

  deepStrictEqual(
    validateCommitMessage(squash('Signed-off-by: Julio Polycarpo <julio@polycarpo.dev>'), {
      identities,
    }),
    ['DCO Signed-off-by trailer must match the author or committer email']
  );
  deepStrictEqual(
    validateCommitMessage(
      squash(
        'Signed-off-by: dependabot[bot] <support@github.com>\nSigned-off-by: Julio Polycarpo <julio@polycarpo.dev>'
      ),
      { identities }
    ),
    []
  );
});

run('signoffIdentities keeps the Dependabot sign-off out of commits by other authors', () => {
  const github = { name: 'GitHub', email: 'noreply@github.com' };

  deepStrictEqual(signoffIdentities(author, github), [author, github]);
  deepStrictEqual(signoffIdentities(author, null), [author]);
});

run('parseSignoffs extracts valid DCO identities', () => {
  deepStrictEqual(parseSignoffs('Signed-off-by: Julio Polycarpo <julio@polycarpo.dev>'), [author]);
});

function run(name: string, fn: () => void): void {
  try {
    fn();
    process.stdout.write(`[ok] ${name}\n`);
  } catch (error) {
    process.stderr.write(`[fail] ${name}\n`);
    throw error;
  }
}
