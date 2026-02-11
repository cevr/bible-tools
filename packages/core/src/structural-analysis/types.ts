/**
 * Structural Analysis Types
 */

import type {
  BibleVerse,
  CrossReference,
  MarginNote,
  StrongsEntry,
  VerseWord,
} from '../bible-db/bible-database.js';

/** Symbolic numbers with theological significance */
export const SYMBOLIC_NUMBERS = [3, 4, 7, 10, 12, 40, 70, 490] as const;
export type SymbolicNumber = (typeof SYMBOLIC_NUMBERS)[number];

/** A word frequency entry with optional symbolic flag */
export interface WordFrequencyEntry {
  readonly word: string;
  readonly count: number;
  /** Set when the count matches a symbolic number */
  readonly symbolicCount: SymbolicNumber | null;
}

/** Result of word frequency analysis for a passage */
export interface WordFrequencyResult {
  readonly entries: readonly WordFrequencyEntry[];
  /** Entries where count matches a symbolic number */
  readonly symbolicEntries: readonly WordFrequencyEntry[];
}

/** Combined passage context — all data needed for structural analysis */
export interface PassageContext {
  readonly book: number;
  readonly chapter: number;
  readonly verseStart: number;
  readonly verseEnd: number;
  readonly verses: readonly BibleVerse[];
  readonly words: ReadonlyMap<number, readonly VerseWord[]>;
  readonly strongsEntries: ReadonlyMap<string, StrongsEntry>;
  readonly crossRefs: ReadonlyMap<number, readonly CrossReference[]>;
  readonly marginNotes: ReadonlyMap<number, readonly MarginNote[]>;
  readonly wordFrequency: WordFrequencyResult;
}
