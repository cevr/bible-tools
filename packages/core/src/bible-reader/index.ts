/**
 * Bible Reader Module
 *
 * Renderer-agnostic Bible reading functionality.
 * Can be used by TUI, Web, or CLI.
 */

// Types
export type {
  BibleVerse,
  BibleBook,
  BibleReference,
  BiblePosition,
  BibleSearchResult,
  BibleBookmark,
  BibleHistoryEntry,
  BiblePreferences,
  BibleReaderState,
} from './types.js';

export { initialReaderState, isBibleReaderState } from './types.js';

// Books data
export {
  BIBLE_BOOK_ALIASES,
  BIBLE_BOOKS,
  getBibleBook,
  getBibleBookByName,
  formatBibleReference,
} from './books.js';

// Parsing
export type {
  ParsedBibleQuery,
  ParseBibleQueryOptions,
  ExtractedReference,
  TextSegmentWithRefs,
} from './parse.js';
export { ParsedBibleQuery as ParsedBibleQueryConstructors } from './parse.js';
export {
  parseBibleQuery,
  isReference,
  isSearch,
  extractBibleReferences,
  segmentTextWithReferences,
} from './parse.js';

// Navigation
export {
  getNextChapter,
  getPrevChapter,
  getNextChapterWithMap,
  getPrevChapterWithMap,
} from './navigation.js';
