import { ok } from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const tsconfigPath = join(process.cwd(), 'tsconfig.json');

// Gitignored directories that tools fill with generated files. `.astro` stays out of this list:
// the type checkers need `.astro/types.d.ts`.
const generatedOutputDirs = [
  'dist',
  '.wrangler',
  '.wrangler-dry',
  'test-results',
  'playwright-report',
  'blob-report',
] as const;

const tsconfig: { exclude?: string[] } = JSON.parse(await readFile(tsconfigPath, 'utf8'));
const excluded = tsconfig.exclude ?? [];

run('tsconfig excludes every gitignored output directory from type checking', () => {
  for (const dir of generatedOutputDirs) {
    ok(
      excluded.includes(dir),
      `expected ${tsconfigPath} exclude to contain: ${dir} | received: ${excluded.join(', ') || 'none'}`
    );
  }
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
