import { ok } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PALETTE_HINT_MAX_CH, PALETTE_SHORTCUT } from './site';

function run(name: string, fn: () => void): void {
  try {
    fn();
    process.stdout.write(`[ok] ${name}\n`);
  } catch (error) {
    process.stderr.write(`[fail] ${name}\n`);
    throw error;
  }
}

run('platform shortcut hints fit the width the header and docs hint boxes reserve', () => {
  for (const platform of ['mac', 'other'] as const) {
    const hint = PALETTE_SHORTCUT[platform];
    ok(
      [...hint].length <= PALETTE_HINT_MAX_CH,
      `expected ${platform} hint ${JSON.stringify(hint)} to be <= ${PALETTE_HINT_MAX_CH} characters | received: ${[...hint].length}; widen inline-size in Header.astro and DocsPage.astro with PALETTE_HINT_MAX_CH`
    );
  }
});

run('the reserved width matches the CSS in both components', () => {
  const reserved = `inline-size: ${PALETTE_HINT_MAX_CH}ch;`;
  for (const file of ['../components/Header.astro', '../components/docs/DocsPage.astro']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    ok(
      source.includes(reserved),
      `expected ${file} to contain "${reserved}" | received no such declaration`
    );
  }
});
