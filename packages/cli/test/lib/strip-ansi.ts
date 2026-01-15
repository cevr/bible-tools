/**
 * ANSI Stripping Utilities
 *
 * Utilities for removing ANSI escape codes from terminal output
 * to enable plain-text assertions in tests.
 */

// ANSI escape code regex pattern
// Matches:
// - CSI sequences: \x1b[...X (where X is any letter)
// - OSC sequences: \x1b]...;...\x07 or \x1b]...;...\x1b\\
// - Simple escape sequences: \x1b followed by single char
const ANSI_REGEX = new RegExp(
  [
    // CSI sequences (cursor movement, colors, etc.)
    '\\x1b\\[[0-9;]*[A-Za-z]',
    // CSI sequences with ? (like ?1049h for alternate screen)
    '\\x1b\\[\\?[0-9;]*[A-Za-z]',
    // OSC sequences (like title setting)
    '\\x1b\\][^\x07]*(?:\x07|\\x1b\\\\)',
    // Simple escape sequences
    '\\x1b[PX^_][^\x1b]*\\x1b\\\\',
    '\\x1b.',
  ].join('|'),
  'g',
);

/**
 * Strip ANSI escape codes from text.
 *
 * @example
 * ```typescript
 * const plain = stripAnsi('\x1b[32mHello\x1b[0m');
 * // plain === 'Hello'
 * ```
 */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, '');
}

/**
 * Split text into lines and strip ANSI codes from each.
 *
 * @example
 * ```typescript
 * const lines = getPlainLines('\x1b[32mLine 1\x1b[0m\nLine 2');
 * // lines === ['Line 1', 'Line 2']
 * ```
 */
export function getPlainLines(text: string): string[] {
  return stripAnsi(text).split('\n');
}

/**
 * Normalize whitespace in text for easier assertions.
 * Collapses multiple spaces and trims each line.
 */
export function normalizeWhitespace(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

/**
 * Extract visible text content, removing empty lines and extra whitespace.
 * Useful for checking what the user actually sees.
 */
export function getVisibleText(text: string): string {
  const plain = stripAnsi(text);
  return normalizeWhitespace(plain);
}
