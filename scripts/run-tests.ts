import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

/** Directories whose `*.test.ts` files make up `bun run test`. */
export const TEST_ROOTS = ['scripts', 'src'] as const;

/** Runs one test file and reports its exit code. */
export type TestExecutor = (file: string) => number;

export interface TestRunResult {
  passed: string[];
  failed: { file: string; exitCode: number }[];
}

if (import.meta.main) {
  const files = await findTestFiles(process.cwd());
  const result = runTestFiles(files, runWithBun);
  process.exit(reportResult(result));
}

/**
 * Lists every `*.test.ts` file under the test roots, sorted, as paths relative to `cwd`.
 * Discovery replaces a hand-maintained list, so a new test file can't be silently skipped.
 *
 * @example
 * const files = await findTestFiles(process.cwd()); // ['scripts/smoke-dist.test.ts', ...]
 */
export async function findTestFiles(
  cwd: string,
  roots: readonly string[] = TEST_ROOTS
): Promise<string[]> {
  const files: string[] = [];

  for (const root of roots) {
    const entries = await readdir(join(cwd, root), { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.test.ts')) {
        files.push(join(relative(cwd, entry.parentPath), entry.name));
      }
    }
  }

  return files.sort();
}

/**
 * Runs each test file in order and keeps going after a failure, so one run reports every
 * failing file.
 *
 * @example
 * const result = runTestFiles(['scripts/a.test.ts'], (file) => runWithBun(file));
 */
export function runTestFiles(files: readonly string[], execute: TestExecutor): TestRunResult {
  const result: TestRunResult = { passed: [], failed: [] };

  for (const file of files) {
    const exitCode = execute(file);
    if (exitCode === 0) {
      result.passed.push(file);
      continue;
    }
    result.failed.push({ file, exitCode });
  }

  return result;
}

/**
 * Prints a summary and returns the process exit code: 0 when every file passed, 1 otherwise
 * (including when no test files were found).
 *
 * @example
 * process.exit(reportResult(runTestFiles(files, runWithBun)));
 */
export function reportResult(result: TestRunResult): number {
  const total = result.passed.length + result.failed.length;

  if (total === 0) {
    console.error(`expected at least one *.test.ts under ${TEST_ROOTS.join(', ')} | received: 0`);
    return 1;
  }

  if (result.failed.length === 0) {
    console.warn(`[ok] ${total} test files passed`);
    return 0;
  }

  for (const failure of result.failed) {
    console.error(`[fail] ${failure.file} exited with code ${failure.exitCode}`);
  }
  console.error(`${result.failed.length} of ${total} test files failed`);
  return 1;
}

function runWithBun(file: string): number {
  const child = spawnSync(process.execPath, [file], { stdio: 'inherit' });
  return child.status ?? 1;
}
