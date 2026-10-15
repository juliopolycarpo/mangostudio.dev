import { match, ok } from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
const deploy = /^ {2}deploy:\n((?: {4}[^\n]*\n|\n)*)/m.exec(workflow)?.[1];
ok(deploy, 'deploy.yml expected a deploy job | received: no deploy job');
match(
  deploy,
  /^ {4}if: github\.ref == 'refs\/heads\/main'$/m,
  `production deploy expected a main-only job guard, including workflow_dispatch | received: ${deploy}`
);
match(deploy, /^ {4}needs: verify$/m);
match(deploy, /^ {4}environment:\n {6}name: production$/m);
process.stdout.write(
  '[ok] production deployment requires main, QA, and the protected environment\n'
);
