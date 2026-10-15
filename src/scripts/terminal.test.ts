import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { initTerminal } from './terminal';

class FakeElement {
  dataset: Record<string, string> = {};
  textContent = 'mangostudio serve';
  readonly classes = new Set<string>();
  readonly classList = { add: (name: string) => this.classes.add(name) };
  readonly children = new Map<string, FakeElement>();
  lines: FakeElement[] = [];

  querySelector(selector: string): FakeElement | null {
    return this.children.get(selector) ?? null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    strictEqual(selector, '[data-term-line]', 'expected terminal line selector');
    return this.lines;
  }
}

class FakeTimers {
  readonly pending: (() => void)[] = [];

  setTimeout = (callback: () => void): number => this.pending.push(callback);

  flush(): void {
    let remaining = 100;
    while (this.pending.length && remaining > 0) {
      remaining -= 1;
      this.pending.shift()?.();
    }
    strictEqual(this.pending.length, 0, 'expected timers settled within 100 callbacks');
  }
}

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly targets: FakeElement[] = [];
  disconnects = 0;

  constructor(
    private readonly callback: IntersectionObserverCallback,
    readonly options: IntersectionObserverInit
  ) {
    FakeIntersectionObserver.instances.push(this);
  }

  observe(target: FakeElement): void {
    this.targets.push(target);
  }

  disconnect(): void {
    this.disconnects += 1;
  }

  emit(ratio: number, isIntersecting = ratio > 0): void {
    const entries = this.targets.map((target) => ({
      target,
      isIntersecting,
      intersectionRatio: ratio,
    }));
    this.callback(
      entries as unknown as IntersectionObserverEntry[],
      this as unknown as IntersectionObserver
    );
  }
}

function fixture(options: { reducedMotion?: boolean; observer?: boolean } = {}) {
  const root = new FakeElement();
  const typed = new FakeElement();
  const panel = new FakeElement();
  root.children.set('[data-typed]', typed);
  root.children.set('.demo-term', panel);
  root.lines = [new FakeElement(), new FakeElement()];
  const timers = new FakeTimers();
  FakeIntersectionObserver.instances = [];
  const replacements = {
    document: { getElementById: () => root },
    HTMLElement: FakeElement,
    window: {
      matchMedia: () => ({ matches: options.reducedMotion ?? false }),
      setTimeout: timers.setTimeout,
      ...(options.observer === false ? {} : { IntersectionObserver: FakeIntersectionObserver }),
    },
  };
  const saved = Object.keys(replacements).map(
    (name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const
  );
  for (const [name, value] of Object.entries(replacements)) {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  return {
    root,
    typed,
    panel,
    timers,
    observer(): FakeIntersectionObserver {
      strictEqual(FakeIntersectionObserver.instances.length, 1, 'expected one terminal observer');
      const observer = FakeIntersectionObserver.instances[0];
      if (!observer) throw new Error('expected terminal observer | received: undefined');
      return observer;
    },
    restore(): void {
      for (const [name, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
    },
  };
}

function run(
  name: string,
  test: (env: ReturnType<typeof fixture>) => void,
  options: Parameters<typeof fixture>[0] = {}
): void {
  const env = fixture(options);
  try {
    test(env);
    console.warn(`ok - ${name}`);
  } finally {
    env.restore();
  }
}

run('terminal remains idle before intersecting', ({ root, typed, timers }) => {
  initTerminal();
  timers.flush();
  strictEqual(root.dataset.terminal, 'ready', 'expected terminal ready gate');
  strictEqual(typed.textContent, '', 'expected no typing before visibility | received command');
  deepStrictEqual(
    root.lines.map((line) => [...line.classes]),
    [[], []]
  );
});

run('terminal starts at 40 percent visibility and disconnects once', (env) => {
  initTerminal();
  const observer = env.observer();
  strictEqual(observer.options.threshold, 0.4, 'expected 40 percent visibility threshold');
  deepStrictEqual(
    observer.targets,
    [env.panel],
    'expected terminal panel, including mobile layout'
  );
  observer.emit(0);
  observer.emit(0.39);
  strictEqual(env.timers.pending.length, 0, 'expected no timers below visibility threshold');
  observer.emit(0.4);
  strictEqual(observer.disconnects, 1, 'expected observer disconnected after first visibility');
  strictEqual(env.timers.pending.length, 1, 'expected one typing sequence scheduled');
  observer.emit(1);
  strictEqual(env.timers.pending.length, 1, 'expected queued callbacks not to restart typing');
  strictEqual(observer.disconnects, 1, 'expected exactly one disconnect');
  env.timers.flush();
  strictEqual(env.typed.textContent, 'mangostudio serve');
  strictEqual(
    env.root.lines.every((line) => line.classes.has('is-visible')),
    true
  );
});

run('reinitialization does not create observers or reset completed text', (env) => {
  initTerminal();
  initTerminal();
  env.observer().emit(1);
  env.timers.flush();
  initTerminal();
  strictEqual(env.typed.textContent, 'mangostudio serve');
  strictEqual(env.timers.pending.length, 0, 'expected no restart after initialization');
  strictEqual(FakeIntersectionObserver.instances.length, 1);
});

run(
  'reduced motion reveals the command and lines without observer or timers',
  (env) => {
    initTerminal();
    strictEqual(env.typed.textContent, 'mangostudio serve');
    strictEqual(
      env.root.lines.every((line) => line.classes.has('is-visible')),
      true
    );
    strictEqual(FakeIntersectionObserver.instances.length, 0);
    strictEqual(env.timers.pending.length, 0);
  },
  { reducedMotion: true }
);

run(
  'missing observer falls back to typing and revealing lines',
  (env) => {
    env.typed.dataset.cmd = 'custom serve';
    initTerminal();
    env.timers.flush();
    strictEqual(env.typed.textContent, 'custom serve');
    strictEqual(
      env.root.lines.every((line) => line.classes.has('is-visible')),
      true
    );
  },
  { observer: false }
);

run('missing typed markup preserves readable content', (env) => {
  env.root.children.delete('[data-typed]');
  initTerminal();
  strictEqual(env.root.dataset.terminal, undefined, 'expected no ready gate without typed markup');
  strictEqual(env.timers.pending.length, 0);
  strictEqual(FakeIntersectionObserver.instances.length, 0);
});

run('missing terminal markup is a no-op', (env) => {
  Object.defineProperty(globalThis, 'document', { value: { getElementById: () => null } });
  initTerminal();
  strictEqual(env.timers.pending.length, 0);
  strictEqual(FakeIntersectionObserver.instances.length, 0);
});
