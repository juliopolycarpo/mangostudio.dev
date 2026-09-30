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
 * Small inline controls whose absence would shift the layout when they appear
 * (header buttons, copy buttons) also carry `data-enhance-reserve`. Without JS
 * they are still `display: none`; when JS is expected (`html.js`) they keep
 * their box and are only `visibility: hidden` until revealed, so revealing
 * causes no layout shift and blocked bundles leave them invisible and inert.
 * Large blocks can reserve too when a fallback overlays them (see the install
 * widget: its static list is absolutely positioned over the reserved tabs while
 * `html.js` is set, so swapping causes no shift). Without an overlay they would
 * leave a blank hole when the bundle is blocked.
 *
 * Static content that only makes sense without the enhancement (for example a
 * plain-text list of every install command) is rendered with
 * `data-enhance-fallback="<name>"`. It stays visible until the same call hides it.
 *
 * Do not use the inline `html.js` flag to decide that an enhancement is ready:
 * it is set before scripts load, so it stays true when the bundle is blocked.
 * It only says "JS is expected", which is what `data-enhance-reserve` keys on.
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
