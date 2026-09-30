/**
 * Platform-aware shortcut hints layered on top of static markup.
 *
 * The server renders every hint with a neutral fallback ("Ctrl K / ⌘K") plus
 * `data-hint-mac` / `data-hint-other` attributes, so the text is correct without
 * JavaScript. This script only narrows it to the shortcut of the current platform.
 */

export type HintPlatform = 'mac' | 'other';

interface HintElement {
  dataset: Record<string, string | undefined>;
  textContent: string | null;
}

interface HintRoot {
  querySelectorAll(selector: string): Iterable<HintElement>;
}

/**
 * Classify a platform string (from `navigator.platform` or the UA) as Apple or not.
 *
 * @example
 * resolveHintPlatform('MacIntel'); // 'mac'
 */
export function resolveHintPlatform(platform: string): HintPlatform {
  return /mac|iphone|ipad|ipod/i.test(platform) ? 'mac' : 'other';
}

/**
 * Replace each `[data-cmdk-hint]` text with the variant for `platform`. Elements
 * missing the matching data attribute keep their static fallback.
 *
 * @example
 * applyShortcutHints(document, 'mac'); // <kbd data-cmdk-hint> now reads "⌘K"
 */
export function applyShortcutHints(root: HintRoot, platform: HintPlatform): void {
  for (const hint of root.querySelectorAll('[data-cmdk-hint]')) {
    const text = platform === 'mac' ? hint.dataset.hintMac : hint.dataset.hintOther;
    if (text) hint.textContent = text;
  }
}

/** Read the current platform from the browser; empty when it cannot be determined. */
function currentPlatform(): string {
  const uaData = (navigator as { userAgentData?: { platform?: string } }).userAgentData;
  return uaData?.platform || navigator.platform || navigator.userAgent || '';
}

/** No-ops when the page has no hint markup. */
export function initCmdkHints(): void {
  applyShortcutHints(document, resolveHintPlatform(currentPlatform()));
}
