import { strictEqual } from 'node:assert/strict';
import { applyShortcutHints, resolveHintPlatform } from './cmdk-hint';

class FakeHint {
  dataset: Record<string, string | undefined>;
  textContent: string | null;

  constructor(dataset: Record<string, string | undefined>, text: string) {
    this.dataset = dataset;
    this.textContent = text;
  }
}

class FakeRoot {
  hints: FakeHint[];
  selectors: string[] = [];

  constructor(hints: FakeHint[]) {
    this.hints = hints;
  }

  querySelectorAll(selector: string): FakeHint[] {
    this.selectors.push(selector);
    return this.hints;
  }
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

const STATIC = 'Ctrl K / ⌘K';
const DATA = { hintMac: '⌘K', hintOther: 'Ctrl K' };

run('resolveHintPlatform classifies Apple platforms as mac', () => {
  for (const value of ['MacIntel', 'iPhone', 'iPad', 'macOS']) {
    strictEqual(resolveHintPlatform(value), 'mac', `expected mac for "${value}"`);
  }
});

run('resolveHintPlatform classifies other or empty platforms as other', () => {
  for (const value of ['Win32', 'Linux x86_64', 'Android', '']) {
    strictEqual(resolveHintPlatform(value), 'other', `expected other for "${value}"`);
  }
});

run('applyShortcutHints writes the variant for the platform', () => {
  const mac = new FakeHint(DATA, STATIC);
  const other = new FakeHint(DATA, STATIC);
  const root = new FakeRoot([mac]);
  applyShortcutHints(root, 'mac');
  applyShortcutHints(new FakeRoot([other]), 'other');
  strictEqual(mac.textContent, '⌘K', `expected mac hint: ⌘K | received: ${mac.textContent}`);
  strictEqual(
    other.textContent,
    'Ctrl K',
    `expected hint: Ctrl K | received: ${other.textContent}`
  );
  strictEqual(root.selectors[0], '[data-cmdk-hint]');
});

run('applyShortcutHints keeps the static text without variants', () => {
  const bare = new FakeHint({}, STATIC);
  applyShortcutHints(new FakeRoot([bare]), 'mac');
  strictEqual(bare.textContent, STATIC, `expected fallback kept | received: ${bare.textContent}`);
});

run('applyShortcutHints no-ops when no hint markup exists', () => {
  applyShortcutHints(new FakeRoot([]), 'mac');
});
