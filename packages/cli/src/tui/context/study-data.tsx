// @effect-diagnostics strictBooleanExpressions:off anyUnknownInErrorContext:off
/**
 * Study Data Context
 *
 * Provides access to cross-references, Strong's concordance, and margin notes.
 * Uses BibleDatabase from @bible/core for unified data access.
 */

import {
  BibleDatabase,
  type CrossReference,
  type StrongsEntry,
  type VerseWord,
  type MarginNote,
  type ConcordanceResult,
} from '@bible/core/bible-db';
import { BunContext } from '@effect/platform-bun';
import { Effect, Layer, ManagedRuntime, Option } from 'effect';
import { createContext, useContext, type ParentProps } from 'solid-js';

import type { Reference } from '../../data/bible/types.js';

// Re-export types from BibleDatabase for consumers
export type { ConcordanceResult, CrossReference, MarginNote, StrongsEntry, VerseWord };

// WordWithStrongs is used by word-mode and verse.tsx
// It's a simplified version of VerseWord
export interface WordWithStrongs {
  text: string;
  strongs?: string[];
}

// Type for Strong's entry (aligned with study-db types for backwards compat)
export interface StrongsEntryCompat {
  number: string;
  lemma: string;
  xlit: string;
  pron?: string;
  def: string;
  kjvDef?: string;
}

// Type for concordance result
export interface ConcordanceResultCompat {
  book: number;
  chapter: number;
  verse: number;
  word: string;
}

// Type for margin note
export interface MarginNoteCompat {
  type: 'hebrew' | 'greek' | 'alternate' | 'name' | 'other';
  phrase: string;
  text: string;
}

// Create combined layer with all dependencies
const BibleServicesLayer = BibleDatabase.Default.pipe(Layer.provideMerge(BunContext.layer));

// Create ManagedRuntime
const runtime = ManagedRuntime.make(BibleServicesLayer);

// Module-level flag to track initialization
let initialized = false;

// Initialization promise
let initPromise: Promise<void> | null = null;

async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = runtime
    .runPromise(
      Effect.gen(function* () {
        // Just access the database to trigger initialization
        const db = yield* BibleDatabase;
        yield* db.getBooks();
      }),
    )
    .then(() => {
      initialized = true;
    });

  return initPromise;
}

// Helper to run an effect synchronously if possible
function runSync<T>(effect: Effect.Effect<T, unknown, BibleDatabase>, defaultValue: T): T {
  if (!initialized) return defaultValue;
  try {
    return runtime.runSync(effect);
  } catch {
    return defaultValue;
  }
}

interface StudyDataContextValue {
  /** Whether the database is still loading */
  isLoading: () => boolean;

  /** Error from database initialization (if any) */
  error: () => Error | undefined;

  /** Get cross-references for a verse (returns empty array if not ready) */
  getCrossRefs: (book: number, chapter: number, verse: number) => Reference[];

  /** Get Strong's entry (returns null if not ready) */
  getStrongsEntry: (number: string) => StrongsEntryCompat | null;

  /** Get words with Strong's numbers for a verse (returns empty array if not ready) */
  getVerseWords: (book: number, chapter: number, verse: number) => WordWithStrongs[];

  /** Get margin notes for a verse (returns empty array if not ready) */
  getMarginNotes: (book: number, chapter: number, verse: number) => MarginNoteCompat[];

  /** Search for all verses containing a Strong's number */
  searchByStrongs: (strongsNumber: string) => ConcordanceResultCompat[];

  /** Get the count of occurrences for a Strong's number */
  getStrongsOccurrenceCount: (strongsNumber: string) => number;

  /** Search Strong's entries by definition */
  searchStrongsByDefinition: (query: string) => StrongsEntryCompat[];
}

const StudyDataContext = createContext<StudyDataContextValue>();

// Initialize the database at module load time
ensureInitialized();

export function StudyDataProvider(props: ParentProps) {
  // Wrap database methods to handle loading state
  const getCrossRefs = (book: number, chapter: number, verse: number): Reference[] =>
    runSync(
      Effect.gen(function* () {
        const db = yield* BibleDatabase;
        const refs = yield* db.getCrossRefs(book, chapter, verse);
        return refs.map((r: CrossReference) => ({
          book: r.book,
          chapter: r.chapter,
          verse: r.verse ?? undefined,
          verseEnd: r.verseEnd ?? undefined,
        }));
      }),
      [],
    );

  const getStrongsEntry = (number: string): StrongsEntryCompat | null =>
    runSync(
      Effect.gen(function* () {
        const db = yield* BibleDatabase;
        const opt = yield* db.getStrongsEntry(number);
        return Option.match(opt, {
          onNone: () => null,
          onSome: (e: StrongsEntry) => ({
            number: e.number,
            lemma: e.lemma,
            xlit: e.transliteration ?? '',
            pron: e.pronunciation ?? undefined,
            def: e.definition,
            kjvDef: e.kjvDefinition ?? undefined,
          }),
        });
      }),
      null,
    );

  const getVerseWords = (book: number, chapter: number, verse: number): WordWithStrongs[] =>
    runSync(
      Effect.gen(function* () {
        const db = yield* BibleDatabase;
        const words = yield* db.getVerseWords(book, chapter, verse);
        return words.map((w: VerseWord) => ({
          text: w.text,
          strongs: w.strongsNumbers ?? undefined,
        }));
      }),
      [],
    );

  const getMarginNotes = (book: number, chapter: number, verse: number): MarginNoteCompat[] =>
    runSync(
      Effect.gen(function* () {
        const db = yield* BibleDatabase;
        const notes = yield* db.getMarginNotes(book, chapter, verse);
        return notes.map((n: MarginNote) => ({
          type: n.type,
          phrase: n.phrase,
          text: n.text,
        }));
      }),
      [],
    );

  const searchByStrongs = (strongsNumber: string): ConcordanceResultCompat[] =>
    runSync(
      Effect.gen(function* () {
        const db = yield* BibleDatabase;
        const results = yield* db.getVersesWithStrongs(strongsNumber);
        return results.map((r: ConcordanceResult) => ({
          book: r.book,
          chapter: r.chapter,
          verse: r.verse,
          word: r.word ?? '',
        }));
      }),
      [],
    );

  const getStrongsOccurrenceCount = (strongsNumber: string): number =>
    runSync(
      Effect.gen(function* () {
        const db = yield* BibleDatabase;
        return yield* db.getStrongsCount(strongsNumber);
      }),
      0,
    );

  const searchStrongsByDefinition = (query: string): StrongsEntryCompat[] =>
    runSync(
      Effect.gen(function* () {
        const db = yield* BibleDatabase;
        const entries = yield* db.searchStrongs(query);
        return entries.map((e: StrongsEntry) => ({
          number: e.number,
          lemma: e.lemma,
          xlit: e.transliteration ?? '',
          pron: e.pronunciation ?? undefined,
          def: e.definition,
          kjvDef: e.kjvDefinition ?? undefined,
        }));
      }),
      [],
    );

  const value: StudyDataContextValue = {
    isLoading: () => !initialized,
    error: () => undefined,
    getCrossRefs,
    getStrongsEntry,
    getVerseWords,
    getMarginNotes,
    searchByStrongs,
    getStrongsOccurrenceCount,
    searchStrongsByDefinition,
  };

  return <StudyDataContext.Provider value={value}>{props.children}</StudyDataContext.Provider>;
}

export function useStudyData(): StudyDataContextValue {
  const ctx = useContext(StudyDataContext);
  if (!ctx) {
    throw new Error('useStudyData must be used within a StudyDataProvider');
  }
  return ctx;
}
