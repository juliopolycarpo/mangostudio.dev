/**
 * Progressive-enhancement gate shared by every initializer.
 *
 * Markup that only works with JavaScript (buttons, tablists, copy controls) is
 * rendered with `data-enhance="<name>"`. Global CSS hides every `[data-enhance]`
 * element, so a visitor without JavaScript, or whose script bundle fails to
 * load, never sees a control that does nothing. The initializer that owns the
 * feature calls `revealEnhanced(<name>)` once it has wired its listeners, which
 * removes the attribute and shows the controls.
 *
 * Static content that only makes sense without the enhancement (for example a
 * plain-text list of every install command) is rendered with
 * `data-enhance-fallback="<name>"`. It stays visible until the same call hides it.
 *
 * Do not gate on the inline `html.js` flag: it is set before scripts load, so it
 * stays true when the bundle is blocked.
 *
 * @example
 * // markup: <button data-enhance="copy">Copy</button>
 * export function initCopy(): void {
 *   document.addEventListener('click', onClick);
 *   revealEnhanced('copy');
 * }
 */
export function revealEnhanced(name: string, root: ParentNode = document): void {
  const selectorName = JSON.stringify(name);

  for (const el of root.querySelectorAll(`[data-enhance=${selectorName}]`)) {
    el.removeAttribute('data-enhance');
  }

  for (const el of root.querySelectorAll(`[data-enhance-fallback=${selectorName}]`)) {
    el.setAttribute('hidden', '');
  }
}
