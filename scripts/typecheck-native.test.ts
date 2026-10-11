import { ok } from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const packagePath = join(process.cwd(), 'package.json');

const manifest: { scripts?: Record<string, string> } = JSON.parse(
  await readFile(packagePath, 'utf8')
);
const script = manifest.scripts?.['typecheck:native'] ?? '';

// Without `.astro/types.d.ts` the compiler types every content collection loosely, so the check
// passes on a fresh clone for code it rejects once the types exist.
run('typecheck:native generates Astro types before running the native compiler', () => {
  const syncIndex = script.indexOf('astro sync');
  const compilerIndex = script.indexOf('typescript-native/bin/tsc');

  ok(
    syncIndex !== -1 && compilerIndex > syncIndex,
    `expected typecheck:native to run: astro sync && <native tsc> | received: ${script || 'no script'}`
  );
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
