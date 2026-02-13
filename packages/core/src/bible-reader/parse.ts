// @effect-diagnostics strictBooleanExpressions:off
/**
 * Bible Reference Parser
 *
 * Parses Bible references from strings like "john 3:16", "gen 1", "1 cor 13:1-5".
 * Renderer-agnostic - can be used by TUI, Web, or CLI.
 */

import type { BibleBook, BibleReference } from './types.js';
import { BIBLE_BOOK_ALIASES, BIBLE_BOOKS, getBibleBook } from './books.js';

/**
 * Options for parsing Bible queries
 */
export interface ParseBibleQueryOptions {
  /**
   * Optional fuzzy matcher function for book names.
   * If provided, will be used as a fallback when exact matching fails.
   * Signature: (books: BibleBook[], query: string) => BibleBook | undefined
   */
  readonly fuzzyMatcher?: (books: readonly BibleBook[], query: string) => BibleBook | undefined;
}

/**
 * Parsed query result - discriminated union
 */
export type ParsedBibleQuery =
  | { readonly _tag: 'single'; readonly ref: BibleReference }
  | {
      readonly _tag: 'chapter';
      readonly book: number;
      readonly chapter: number;
    }
  | {
      readonly _tag: 'verseRange';
      readonly book: number;
      readonly chapter: number;
      readonly startVerse: number;
      readonly endVerse: number;
    }
  | {
      readonly _tag: 'chapterRange';
      readonly book: number;
      readonly startChapter: number;
      readonly endChapter: number;
    }
  | { readonly _tag: 'fullBook'; readonly book: number }
  | { readonly _tag: 'search'; readonly query: string };

/**
 * Constructors for ParsedBibleQuery
 */
export const ParsedBibleQuery = {
  single: (ref: BibleReference): ParsedBibleQuery => ({ _tag: 'single', ref }),
  chapter: (book: number, chapter: number): ParsedBibleQuery => ({
    _tag: 'chapter',
    book,
    chapter,
  }),
  verseRange: (
    book: number,
    chapter: number,
    startVerse: number,
    endVerse: number,
  ): ParsedBibleQuery => ({
    _tag: 'verseRange',
    book,
    chapter,
    startVerse,
    endVerse,
  }),
  chapterRange: (book: number, startChapter: number, endChapter: number): ParsedBibleQuery => ({
    _tag: 'chapterRange',
    book,
    startChapter,
    endChapter,
  }),
  fullBook: (book: number): ParsedBibleQuery => ({ _tag: 'fullBook', book }),
  search: (query: string): ParsedBibleQuery => ({ _tag: 'search', query }),
} as const;

/**
 * Try to resolve a book name to a book number
 */
function resolveBook(bookPart: string, options?: ParseBibleQueryOptions): number | undefined {
  const normalized = bookPart.trim().toLowerCase();

  // Direct alias lookup
  let bookNum = BIBLE_BOOK_ALIASES[normalized];
  if (bookNum) return bookNum;

  // Try removing spaces
  const noSpaces = normalized.replace(/\s+/g, '');
  bookNum = BIBLE_BOOK_ALIASES[noSpaces];
  if (bookNum) return bookNum;

  // Try adding space after number (e.g., "1cor" -> "1 cor")
  const withSpace = normalized.replace(/^(\d)([a-z])/, '$1 $2');
  bookNum = BIBLE_BOOK_ALIASES[withSpace];
  if (bookNum) return bookNum;

  // Use fuzzy matcher if provided
  if (options?.fuzzyMatcher) {
    const matched = options.fuzzyMatcher(BIBLE_BOOKS, normalized);
    if (matched) return matched.number;
  }

  // Fallback: Partial match on book names (prefix match)
  for (const book of BIBLE_BOOKS) {
    if (book.name.toLowerCase().startsWith(normalized)) {
      return book.number;
    }
  }

  return undefined;
}

/**
 * Parse a Bible reference string
 *
 * Supported formats:
 * - "john 3:16" - single verse
 * - "john 3:16-18" - verse range
 * - "john 3" - single chapter
 * - "john 3-5" - chapter range
 * - "ruth" - full book
 * - "faith hope love" - search query (fallback)
 *
 * @param query - The query string to parse
 * @param options - Optional parsing options (e.g., fuzzy matcher)
 */
export function parseBibleQuery(query: string, options?: ParseBibleQueryOptions): ParsedBibleQuery {
  const input = query.trim();
  if (!input) return ParsedBibleQuery.search(query);

  // "john 3:16-18" - verse range
  const verseRangeMatch = input.match(/^(.+?)\s*(\d+)\s*:\s*(\d+)\s*-\s*(\d+)$/i);
  if (verseRangeMatch) {
    const bookPart = verseRangeMatch[1];
    const chapterStr = verseRangeMatch[2];
    const startVerseStr = verseRangeMatch[3];
    const endVerseStr = verseRangeMatch[4];
    if (bookPart && chapterStr && startVerseStr && endVerseStr) {
      const bookNum = resolveBook(bookPart, options);
      if (bookNum) {
        const chapter = parseInt(chapterStr, 10);
        const startVerse = parseInt(startVerseStr, 10);
        const endVerse = parseInt(endVerseStr, 10);
        const book = getBibleBook(bookNum);
        if (book && chapter >= 1 && chapter <= book.chapters) {
          return ParsedBibleQuery.verseRange(bookNum, chapter, startVerse, endVerse);
        }
      }
    }
  }

  // "john 3-5" - chapter range
  const chapterRangeMatch = input.match(/^(.+?)\s*(\d+)\s*-\s*(\d+)$/i);
  if (chapterRangeMatch) {
    const bookPart = chapterRangeMatch[1];
    const startChapterStr = chapterRangeMatch[2];
    const endChapterStr = chapterRangeMatch[3];
    if (bookPart && startChapterStr && endChapterStr) {
      const bookNum = resolveBook(bookPart, options);
      if (bookNum) {
        const startChapter = parseInt(startChapterStr, 10);
        const endChapter = parseInt(endChapterStr, 10);
        const book = getBibleBook(bookNum);
        if (book && startChapter >= 1 && endChapter <= book.chapters) {
          return ParsedBibleQuery.chapterRange(bookNum, startChapter, endChapter);
        }
      }
    }
  }

  // "john 3:16" - single verse
  const singleVerseMatch = input.match(/^(.+?)\s*(\d+)\s*:\s*(\d+)$/i);
  if (singleVerseMatch) {
    const bookPart = singleVerseMatch[1];
    const chapterStr = singleVerseMatch[2];
    const verseStr = singleVerseMatch[3];
    if (bookPart && chapterStr && verseStr) {
      const bookNum = resolveBook(bookPart, options);
      if (bookNum) {
        const chapter = parseInt(chapterStr, 10);
        const verse = parseInt(verseStr, 10);
        const book = getBibleBook(bookNum);
        if (book && chapter >= 1 && chapter <= book.chapters) {
          return ParsedBibleQuery.single({ book: bookNum, chapter, verse });
        }
      }
    }
  }

  // "john 3" - single chapter
  const singleChapterMatch = input.match(/^(.+?)\s*(\d+)$/i);
  if (singleChapterMatch) {
    const bookPart = singleChapterMatch[1];
    const chapterStr = singleChapterMatch[2];
    if (bookPart && chapterStr) {
      const bookNum = resolveBook(bookPart, options);
      if (bookNum) {
        const chapter = parseInt(chapterStr, 10);
        const book = getBibleBook(bookNum);
        if (book && chapter >= 1 && chapter <= book.chapters) {
          return ParsedBibleQuery.chapter(bookNum, chapter);
        }
      }
    }
  }

  // "ruth" - full book (just a book name with no numbers)
  const bookOnlyMatch = input.match(/^([a-z\s]+)$/i);
  if (bookOnlyMatch) {
    const bookPart = bookOnlyMatch[1];
    if (bookPart) {
      const bookNum = resolveBook(bookPart, options);
      if (bookNum) {
        return ParsedBibleQuery.fullBook(bookNum);
      }
    }
  }

  // Fallback: search
  return ParsedBibleQuery.search(query);
}

/**
 * Check if a parsed query is a reference (not a search)
 */
export function isReference(query: ParsedBibleQuery): boolean {
  return query._tag !== 'search';
}

/**
 * Check if a parsed query is a search
 */
export function isSearch(query: ParsedBibleQuery): boolean {
  return query._tag === 'search';
}

/**
 * Extracted Bible reference with position in text
 */
export interface ExtractedReference {
  /** The matched text */
  text: string;
  /** Start position in original text */
  start: number;
  /** End position in original text */
  end: number;
  /** Parsed reference */
  ref: BibleReference;
}

/**
 * Two-phase Bible reference extraction for performance.
 *
 * Phase 1: Simple regex finds candidates (no alternation backtracking)
 * Phase 2: O(1) hash map validates book names
 *
 * This is much faster than a single regex with 120+ book name alternations.
 */

// Phase 1: Simple pattern to find potential references
// Matches: optional number prefix + word(s) + chapter:verse with optional range
// Examples: "John 3:16", "1 Cor. 13:1-3", "Song of Solomon 1:1"
const CANDIDATE_PATTERN =
  /([123]?\s*[A-Za-z]+(?:\s+of\s+[A-Za-z]+)?\.?)\s*(\d+)\s*:\s*(\d+)(?:\s*[-–]\s*(\d+))?/g;

/**
 * Normalize a book name for lookup in BIBLE_BOOK_ALIASES
 */
function normalizeBookName(name: string): string {
  return name
    .replace(/\.$/, '') // Remove trailing period
    .replace(/\s+/g, ' ') // Normalize multiple spaces to single
    .trim()
    .toLowerCase();
}

/**
 * Extract all Bible references from text
 *
 * Uses a two-phase approach for performance:
 * 1. Simple regex finds candidates without alternation backtracking
 * 2. Hash map lookup validates book names in O(1)
 *
 * Matches patterns like:
 * - "John 3:16"
 * - "Gen. 1:1"
 * - "1 Cor. 13:1-3"
 * - "Psalm 23:1, 2"
 * - "Matt. 5:3-12"
 */
export function extractBibleReferences(text: string): ExtractedReference[] {
  const results: ExtractedReference[] = [];

  // Reset lastIndex for reuse (global flag)
  CANDIDATE_PATTERN.lastIndex = 0;

  for (const match of text.matchAll(CANDIDATE_PATTERN)) {
    const fullMatch = match[0];
    const bookPart = match[1];
    const chapterStr = match[2];
    const verseStr = match[3];
    const matchIndex = match.index;

    if (!fullMatch || !bookPart || !chapterStr || !verseStr || matchIndex === undefined) {
      continue;
    }

    // Normalize and look up book name
    const normalized = normalizeBookName(bookPart);

    // Try direct lookup first (O(1))
    let bookNum = BIBLE_BOOK_ALIASES[normalized];

    // If not found, try variations
    if (!bookNum) {
      // Try without spaces (e.g., "1cor" for "1 cor")
      const noSpaces = normalized.replace(/\s+/g, '');
      bookNum = BIBLE_BOOK_ALIASES[noSpaces];
    }

    if (!bookNum) {
      // Try adding space after number prefix (e.g., "1cor" -> "1 cor")
      const withSpace = normalized.replace(/^(\d)([a-z])/, '$1 $2');
      bookNum = BIBLE_BOOK_ALIASES[withSpace];
    }

    if (!bookNum) continue;

    const chapter = parseInt(chapterStr, 10);
    const verse = parseInt(verseStr, 10);
    const book = getBibleBook(bookNum);

    if (!book || chapter < 1 || chapter > book.chapters) continue;

    results.push({
      text: fullMatch,
      start: matchIndex,
      end: matchIndex + fullMatch.length,
      ref: { book: bookNum, chapter, verse },
    });
  }

  return results;
}

/**
 * Segment text with Bible references highlighted
 * Returns segments in order, with type indicating if it's a reference or plain text
 */
export type TextSegmentWithRefs =
  | { type: 'text'; text: string }
  | { type: 'ref'; text: string; ref: BibleReference };

export function segmentTextWithReferences(text: string): TextSegmentWithRefs[] {
  const refs = extractBibleReferences(text);
  if (refs.length === 0) {
    return [{ type: 'text', text }];
  }

  const segments: TextSegmentWithRefs[] = [];
  let lastEnd = 0;

  for (const ref of refs) {
    // Add text before this reference
    if (ref.start > lastEnd) {
      segments.push({ type: 'text', text: text.slice(lastEnd, ref.start) });
    }
    // Add the reference
    segments.push({ type: 'ref', text: ref.text, ref: ref.ref });
    lastEnd = ref.end;
  }

  // Add remaining text
  if (lastEnd < text.length) {
    segments.push({ type: 'text', text: text.slice(lastEnd) });
  }

  return segments;
}
