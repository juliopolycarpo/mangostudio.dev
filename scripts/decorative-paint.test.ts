import { deepStrictEqual } from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();

/**
 * Lists `filter` declarations that blur or drop-shadow a layer. Gradients and
 * box-shadow draw the same decoration without re-rasterizing the layer; a
 * `backdrop-filter` is not matched. CSS keywords are case-insensitive, so the match is too.
 *
 * @example
 * findBlurFilters('.a { filter: blur(4px); }'); // ['filter: blur(4px)']
 */
export function findBlurFilters(css: string): string[] {
  return [
    ...css.matchAll(/(?<![-\w])(?:-webkit-)?filter\s*:\s*[^;}]*\b(?:blur|drop-shadow)\([^;}]*/gi),
  ].map(([declaration]) => declaration.trim());
}

run('findBlurFilters matches blur and drop-shadow filters, not backdrop or color filters', () => {
  deepStrictEqual(
    findBlurFilters(
      [
        '.a { filter: blur(34px); }',
        '.b { filter: brightness(1.04) drop-shadow(0 4px 8px #000) }',
        '.c { backdrop-filter: blur(10px); }',
        '.d { filter: brightness(1.04); }',
        '.e { -webkit-filter: blur(2px); }',
        '.f { FILTER: Drop-Shadow(0 1px 2px #000); }',
      ].join('\n')
    ),
    [
      'filter: blur(34px)',
      'filter: brightness(1.04) drop-shadow(0 4px 8px #000)',
      '-webkit-filter: blur(2px)',
      'FILTER: Drop-Shadow(0 1px 2px #000)',
    ]
  );
});

await runAsync('site styles draw decorative glows and shadows without blur filters', async () => {
  const hits: string[] = [];
  for (const file of await styleSources(join(root, 'src'))) {
    for (const declaration of findBlurFilters(await readFile(file, 'utf8'))) {
      hits.push(`${relative(root, file)}: ${declaration}`);
    }
  }
  deepStrictEqual(
    hits,
    [],
    `expected gradients or box-shadow for decoration | received filter declarations: ${hits.join('; ')}`
  );
});

async function styleSources(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.(?:astro|css)$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
}

function run(name: string, fn: () => void): void {
  try {
    fn();
    process.stdout.write(`[ok] ${name}\n`);
  } catch (error) {
    process.stderr.write(`[fail] ${name}\n`);
    throw error;
  }
}

async function runAsync(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    process.stdout.write(`[ok] ${name}\n`);
  } catch (error) {
    process.stderr.write(`[fail] ${name}\n`);
    throw error;
  }
}
