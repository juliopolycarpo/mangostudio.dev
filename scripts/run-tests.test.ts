import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { findTestFiles, reportResult, runTestFiles } from './run-tests';

await run('findTestFiles discovers *.test.ts under scripts and src only', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'run-tests-'));
  try {
    for (const file of [
      'scripts/b.test.ts',
      'scripts/a.test.ts',
      'scripts/helper.ts',
      'src/scripts/c.test.ts',
      'tests/e2e/d.spec.ts',
      'other/e.test.ts',
    ]) {
      await mkdir(join(cwd, file, '..'), { recursive: true });
      await writeFile(join(cwd, file), '');
    }

    deepStrictEqual(await findTestFiles(cwd), [
      'scripts/a.test.ts',
      'scripts/b.test.ts',
      'src/scripts/c.test.ts',
    ]);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

await run('runTestFiles keeps running after a failure and records exit codes', () => {
  const calls: string[] = [];
  const exitCodes: Record<string, number> = { 'a.test.ts': 0, 'b.test.ts': 3, 'c.test.ts': 0 };
  const result = runTestFiles(Object.keys(exitCodes), (file) => {
    calls.push(file);
    return exitCodes[file] ?? 1;
  });

  deepStrictEqual(calls, ['a.test.ts', 'b.test.ts', 'c.test.ts']);
  deepStrictEqual(result, {
    passed: ['a.test.ts', 'c.test.ts'],
    failed: [{ file: 'b.test.ts', exitCode: 3 }],
  });
});

await run('reportResult fails on any failed file or when nothing ran', () => {
  const quiet = silenceConsole();
  try {
    strictEqual(reportResult({ passed: ['a.test.ts'], failed: [] }), 0);
    strictEqual(reportResult({ passed: [], failed: [{ file: 'b.test.ts', exitCode: 1 }] }), 1);
    strictEqual(reportResult({ passed: [], failed: [] }), 1);
  } finally {
    quiet();
  }
});

function silenceConsole(): () => void {
  const { warn, error } = console;
  console.warn = () => {};
  console.error = () => {};
  return () => {
    console.warn = warn;
    console.error = error;
  };
}

async function run(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    process.stdout.write(`[ok] ${name}\n`);
  } catch (error) {
    process.stderr.write(`[fail] ${name}\n`);
    throw error;
  }
}
