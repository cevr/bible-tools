/**
 * HTML content cleaning utilities for EGW text.
 *
 * Separated from page-view.tsx so that utility consumers don't cause
 * HMR invalidation of the component (or vice versa).
 */

const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

const ENTITY_RE = /&(?:amp|lt|gt|quot|#39|apos|nbsp);/g;
const TAG_RE = /<br\s*\/?>/gi;
const STRIP_TAGS_RE = /<[^>]*>/g;

export function cleanHtml(content: string): string {
  return content
    .replace(TAG_RE, '\n')
    .replace(STRIP_TAGS_RE, '')
    .replace(ENTITY_RE, (m) => ENTITY_MAP[m] ?? m)
    .trim();
}
