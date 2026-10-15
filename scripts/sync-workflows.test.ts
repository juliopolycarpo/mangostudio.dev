import { match, ok } from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const name of ['sync-docs', 'sync-release-metadata']) {
  const workflow = readFileSync(
    new URL(`../.github/workflows/${name}.yml`, import.meta.url),
    'utf8'
  );
  const sync = /^ {2}sync:\n((?: {4}[^\n]*\n|\n)*)/m.exec(workflow)?.[1];
  ok(sync, `${name}.yml expected a sync job | received: no sync job`);
  match(
    sync,
    /^ {4}if: github\.ref == 'refs\/heads\/main'$/m,
    `${name} expected a main-only job guard for its write token, including workflow_dispatch | received: ${sync}`
  );
}
process.stdout.write('[ok] sync workflows run with write tokens only on main\n');
