import { deepStrictEqual, ok, rejects, strictEqual } from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { flattenLocalizedNotFound, isNotFoundUrl } from './localized-not-found';

await run('isNotFoundUrl matches root and localized error pages only', () => {
  deepStrictEqual(
    [
      'https://mangostudio.dev/404/',
      'https://mangostudio.dev/en/404',
      'https://mangostudio.dev/',
      'https://mangostudio.dev/docs/x404/',
    ].map(isNotFoundUrl),
    [true, true, false, false]
  );
});

await run('flattenLocalizedNotFound moves en/404/index.html to en/404.html', async () => {
  const out = await mkdtemp(join(tmpdir(), 'not-found-'));

  try {
    await mkdir(join(out, 'en', '404'), { recursive: true });
    await writeFile(join(out, 'en', '404', 'index.html'), '<html lang="en"></html>');

    await flattenLocalizedNotFound(out, 'en');

    strictEqual(await readFile(join(out, 'en', '404.html'), 'utf8'), '<html lang="en"></html>');
    deepStrictEqual(await readdir(join(out, 'en')), ['404.html']);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});

await run(
  'flattenLocalizedNotFound reports the expected path when the page was not emitted',
  async () => {
    const out = await mkdtemp(join(tmpdir(), 'not-found-'));

    try {
      await rejects(flattenLocalizedNotFound(out, 'en'), (error: Error) => {
        ok(
          error.message.startsWith(
            `expected emitted error page at ${join(out, 'en', '404', 'index.html')}`
          ),
          error.message
        );
        return true;
      });
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  }
);

async function run(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    process.stdout.write(`[ok] ${name}\n`);
  } catch (error) {
    process.stderr.write(`[fail] ${name}\n`);
    throw error;
  }
}
