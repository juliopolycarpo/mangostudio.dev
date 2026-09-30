/** Placeholder that every copy-button label template must contain. */
export const COPY_TARGET_PLACEHOLDER = '{target}';

/**
 * Builds a copy button's accessible name from a localized template and the thing it copies.
 * Shared by the server-rendered markup and the install widget, which renames its button when
 * the selected install method changes.
 *
 * @example
 * fillCopyLabel('Copy command: {target}', 'brew'); // 'Copy command: brew'
 */
export function fillCopyLabel(template: string, target: string): string {
  if (!template.includes(COPY_TARGET_PLACEHOLDER)) {
    throw new Error(
      `copy label template must contain "${COPY_TARGET_PLACEHOLDER}" | received: ${JSON.stringify(template)}`
    );
  }
  return template.replace(COPY_TARGET_PLACEHOLDER, target);
}
