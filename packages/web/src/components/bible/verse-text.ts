/**
 * Pure text segmentation for verse rendering.
 *
 * Separated from verse-renderer.tsx so that utility consumers don't cause
 * HMR invalidation of the component (or vice versa).
 */
import type { MarginNote } from '@/data/study/service';

// --- Types ---

export type TextSegment =
  | { type: 'text'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'highlight'; text: string }
  | { type: 'redLetter'; text: string }
  | { type: 'redLetterItalic'; text: string }
  | { type: 'redLetterQuote'; text: string }
  | { type: 'margin'; noteIndex: number };

// --- Segmentation (pure functions) ---

/**
 * Split text segments on [brackets] into italic segments.
 * KJV uses square brackets to denote words added by translators for clarity.
 * Handles both 'text' -> 'italic' and 'redLetter' -> 'redLetterItalic'.
 */
export function applyItalicSegments(segments: TextSegment[]): TextSegment[] {
  const result: TextSegment[] = [];
  for (const segment of segments) {
    if (segment.type !== 'text' && segment.type !== 'redLetter') {
      result.push(segment);
      continue;
    }
    const italicType = segment.type === 'redLetter' ? 'redLetterItalic' : 'italic';
    const parts = segment.text.split(/(\[[^\]]+\])/);
    for (const part of parts) {
      if (part.startsWith('[') && part.endsWith(']')) {
        result.push({ type: italicType, text: part.slice(1, -1) });
      } else if (part) {
        result.push({ type: segment.type, text: part });
      }
    }
  }
  return result;
}

/**
 * Split text segments on single angle quotes into redLetter segments.
 * Replaces opening with left double quote and closing with right double quote.
 * Tracks red-letter state across segment boundaries so that margin note
 * superscripts inserted mid-quote don't break the parsing.
 */
export function applyRedLetterSegments(segments: TextSegment[]): TextSegment[] {
  const result: TextSegment[] = [];
  let inRedLetter = false;

  for (const segment of segments) {
    if (segment.type !== 'text') {
      result.push(segment);
      continue;
    }

    let text = segment.text;
    while (text.length > 0) {
      if (inRedLetter) {
        const closeIdx = text.indexOf('\u203A');
        if (closeIdx === -1) {
          result.push({ type: 'redLetter', text });
          text = '';
        } else {
          if (closeIdx > 0) {
            result.push({ type: 'redLetter', text: text.slice(0, closeIdx) });
          }
          result.push({ type: 'redLetterQuote', text: '\u201D' });
          inRedLetter = false;
          text = text.slice(closeIdx + 1);
        }
      } else {
        const openIdx = text.indexOf('\u2039');
        if (openIdx === -1) {
          if (text.length > 0) {
            result.push({ type: 'text', text });
          }
          text = '';
        } else {
          if (openIdx > 0) {
            result.push({ type: 'text', text: text.slice(0, openIdx) });
          }
          result.push({ type: 'redLetterQuote', text: '\u201C' });
          inRedLetter = true;
          text = text.slice(openIdx + 1);
        }
      }
    }
  }
  return result;
}

/**
 * Apply search highlighting to text segments.
 * Only splits 'text' segments (preserves margin, redLetter, etc).
 */
function applySearchHighlights(segments: TextSegment[], searchQuery: string): TextSegment[] {
  if (!searchQuery || searchQuery.length < 2) return segments;

  const result: TextSegment[] = [];
  const lowerQuery = searchQuery.toLowerCase();

  for (const segment of segments) {
    if (segment.type !== 'text') {
      result.push(segment);
      continue;
    }

    const segText = segment.text;
    const lowerSegText = segText.toLowerCase();
    let pos = 0;
    let searchPos = 0;

    while ((searchPos = lowerSegText.indexOf(lowerQuery, pos)) !== -1) {
      if (searchPos > pos) {
        result.push({ type: 'text', text: segText.slice(pos, searchPos) });
      }
      result.push({
        type: 'highlight',
        text: segText.slice(searchPos, searchPos + searchQuery.length),
      });
      pos = searchPos + searchQuery.length;
    }

    if (pos < segText.length) {
      result.push({ type: 'text', text: segText.slice(pos) });
    }
  }

  return result;
}

/**
 * Split verse text into segments with margin note superscripts inserted
 * after matching phrases. Optionally applies search highlighting.
 */
export function segmentVerseText(
  text: string,
  marginNotes: MarginNote[],
  searchQuery?: string,
): TextSegment[] {
  const phraseMatches: Array<{ start: number; end: number; noteIndex: number }> = [];

  for (const note of marginNotes) {
    const pos = text.toLowerCase().indexOf(note.phrase.toLowerCase());
    if (pos !== -1) {
      phraseMatches.push({
        start: pos,
        end: pos + note.phrase.length,
        noteIndex: note.noteIndex,
      });
    }
  }

  phraseMatches.sort((a, b) => a.end - b.end);

  const segments: TextSegment[] = [];
  let lastIndex = 0;

  for (const match of phraseMatches) {
    if (match.end > lastIndex) {
      segments.push({ type: 'text', text: text.slice(lastIndex, match.end) });
    }
    segments.push({ type: 'margin', noteIndex: match.noteIndex });
    lastIndex = match.end;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', text: text.slice(lastIndex) });
  }

  if (segments.length === 0) {
    segments.push({ type: 'text', text });
  }

  const highlighted = searchQuery ? applySearchHighlights(segments, searchQuery) : segments;

  return applyItalicSegments(applyRedLetterSegments(highlighted));
}

/** Strip leading pilcrow and whitespace. */
export function cleanVerseText(text: string): string {
  return text.replace(/^\u00b6\s*/, '');
}
