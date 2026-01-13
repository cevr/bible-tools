/**
 * Bible Reader Types
 *
 * Renderer-agnostic types for Bible data and navigation.
 * Used by both TUI and Web renderers.
 */

/**
 * A verse from the Bible
 */
export interface BibleVerse {
  readonly bookName: string;
  readonly book: number;
  readonly chapter: number;
  readonly verse: number;
  readonly text: string;
}

/**
 * Book information
 */
export interface BibleBook {
  readonly number: number;
  readonly name: string;
  readonly chapters: number;
  readonly testament: 'old' | 'new';
}

/**
 * Reference to a position in the Bible
 */
export interface BibleReference {
  readonly book: number;
  readonly chapter: number;
  readonly verse?: number;
  readonly verseEnd?: number;
}

/**
 * Current reading position
 */
export interface BiblePosition {
  readonly book: number;
  readonly chapter: number;
  readonly verse: number;
}

/**
 * Search result
 */
export interface BibleSearchResult {
  readonly reference: BibleReference;
  readonly verse: BibleVerse;
  readonly matchScore: number;
}

/**
 * Bookmark
 */
export interface BibleBookmark {
  readonly id: string;
  readonly reference: BibleReference;
  readonly note?: string;
  readonly createdAt: number;
}

/**
 * History entry
 */
export interface BibleHistoryEntry {
  readonly reference: BibleReference;
  readonly visitedAt: number;
}

/**
 * User preferences
 */
export interface BiblePreferences {
  readonly theme: string;
  readonly displayMode: 'verse' | 'paragraph';
}

/**
 * Reader state - discriminated union for loading states
 */
export type BibleReaderState =
  | { readonly _tag: 'idle' }
  | { readonly _tag: 'loading'; readonly message: string }
  | { readonly _tag: 'loaded'; readonly position: BiblePosition }
  | { readonly _tag: 'error'; readonly error: string };

/**
 * Initial reader state
 */
export const initialReaderState: BibleReaderState = { _tag: 'idle' };

/**
 * State matchers
 */
export const isBibleReaderState = {
  idle: (
    state: BibleReaderState,
  ): state is Extract<BibleReaderState, { _tag: 'idle' }> =>
    state._tag === 'idle',
  loading: (
    state: BibleReaderState,
  ): state is Extract<BibleReaderState, { _tag: 'loading' }> =>
    state._tag === 'loading',
  loaded: (
    state: BibleReaderState,
  ): state is Extract<BibleReaderState, { _tag: 'loaded' }> =>
    state._tag === 'loaded',
  error: (
    state: BibleReaderState,
  ): state is Extract<BibleReaderState, { _tag: 'error' }> =>
    state._tag === 'error',
} as const;
