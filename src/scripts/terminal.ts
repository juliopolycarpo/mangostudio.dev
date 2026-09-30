/**
 * Types the demo command and reveals the boot lines one by one.
 *
 * The lines stay readable until this runs; CSS hides them only under
 * `[data-terminal="ready"]`, which is set here. Never gate on the inline `html.js`
 * flag, because it is set even when this bundle fails to load.
 */
export function initTerminal(): void {
  const root = document.getElementById('terminal-demo');
  if (!root) return;
  const typedEl = root.querySelector('[data-typed]');
  if (!(typedEl instanceof HTMLElement)) return;

  const lines = Array.from(root.querySelectorAll('[data-term-line]'));
  root.dataset.terminal = 'ready';
  const cmd = typedEl.dataset.cmd ?? 'mangostudio serve';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion) {
    typedEl.textContent = cmd;
    for (const line of lines) line.classList.add('is-visible');
    return;
  }

  let lineIndex = 0;
  const revealLines = (): void => {
    if (lineIndex >= lines.length) return;
    lines[lineIndex].classList.add('is-visible');
    lineIndex += 1;
    window.setTimeout(revealLines, 430);
  };

  let charIndex = 0;
  const typeChar = (): void => {
    charIndex += 1;
    typedEl.textContent = cmd.slice(0, charIndex);
    if (charIndex < cmd.length) {
      window.setTimeout(typeChar, 52 + Math.random() * 45);
    } else {
      window.setTimeout(revealLines, 420);
    }
  };

  typedEl.textContent = '';
  window.setTimeout(typeChar, 650);
}
