import { deepStrictEqual } from 'node:assert/strict';
import { revealEnhanced } from './enhance';

interface FakeElement {
  attrs: Map<string, string>;
  removeAttribute(name: string): void;
  setAttribute(name: string, value: string): void;
}

/** Minimal ParentNode double: matches `[attr="value"]` selectors against fake elements. */
class FakeRoot {
  readonly elements: FakeElement[] = [];

  add(attrs: Record<string, string>): FakeElement {
    const element: FakeElement = {
      attrs: new Map(Object.entries(attrs)),
      removeAttribute(name) {
        this.attrs.delete(name);
      },
      setAttribute(name, value) {
        this.attrs.set(name, value);
      },
    };
    this.elements.push(element);
    return element;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const match = /^\[([\w-]+)="(.*)"\]$/.exec(selector);
    if (!match) throw new Error(`unsupported selector | received: ${selector}`);
    const [, name, value] = match;
    return this.elements.filter((element) => element.attrs.get(name ?? '') === value);
  }
}

function snapshot(element: FakeElement): Record<string, string> {
  return Object.fromEntries(element.attrs);
}

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.warn(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

run('revealEnhanced removes the gate attribute only for the named feature', () => {
  const root = new FakeRoot();
  const install = root.add({ 'data-enhance': 'install' });
  const copy = root.add({ 'data-enhance': 'copy' });

  revealEnhanced('install', root as unknown as ParentNode);

  deepStrictEqual(snapshot(install), {}, 'expected install gate removed');
  deepStrictEqual(snapshot(copy), { 'data-enhance': 'copy' }, 'expected copy gate untouched');
});

run('revealEnhanced hides the matching static fallback', () => {
  const root = new FakeRoot();
  const fallback = root.add({ 'data-enhance-fallback': 'install' });
  const other = root.add({ 'data-enhance-fallback': 'terminal' });

  revealEnhanced('install', root as unknown as ParentNode);

  deepStrictEqual(snapshot(fallback), { 'data-enhance-fallback': 'install', hidden: '' });
  deepStrictEqual(snapshot(other), { 'data-enhance-fallback': 'terminal' });
});

run('revealEnhanced is a no-op when no markup carries the gate', () => {
  const root = new FakeRoot();
  const plain = root.add({ class: 'plain' });

  revealEnhanced('install', root as unknown as ParentNode);

  deepStrictEqual(snapshot(plain), { class: 'plain' });
});
