/**
 * Study Data Context
 *
 * Provides async access to cross-references and Strong's concordance data.
 * Uses createResource for background loading so the UI doesn't block on startup.
 */

import {
  createContext,
  createResource,
  useContext,
  type ParentProps,
  type Resource,
} from 'solid-js';

import type { Reference } from '../../data/bible/types.js';
import {
  getCrossRefs as getCrossRefsSync,
  getMarginNotes as getMarginNotesSync,
  getStrongsEntry as getStrongsEntrySync,
  getStrongsOccurrenceCount as getStrongsOccurrenceCountSync,
  getVerseWords as getVerseWordsSync,
  initStudyDatabase,
  searchByStrongs as searchByStrongsSync,
  searchStrongsByDefinition as searchStrongsByDefinitionSync,
  searchStrongsByLemma as searchStrongsByLemmaSync,
  type ConcordanceResult,
  type MarginNote,
  type StrongsEntry,
  type WordWithStrongs,
} from '../../data/study/study-db.js';

interface StudyDataContextValue {
  /** Resource that tracks database initialization */
  ready: Resource<boolean>;

  /** Whether the database is still loading */
  isLoading: () => boolean;

  /** Error from database initialization (if any) */
  error: () => Error | undefined;

  /** Get cross-references for a verse (returns empty array if not ready) */
  getCrossRefs: (book: number, chapter: number, verse: number) => Reference[];

  /** Get Strong's entry (returns null if not ready) */
  getStrongsEntry: (number: string) => StrongsEntry | null;

  /** Get words with Strong's numbers for a verse (returns empty array if not ready) */
  getVerseWords: (
    book: number,
    chapter: number,
    verse: number,
  ) => WordWithStrongs[];

  /** Get margin notes for a verse (returns empty array if not ready) */
  getMarginNotes: (
    book: number,
    chapter: number,
    verse: number,
  ) => MarginNote[];

  /** Search for all verses containing a Strong's number */
  searchByStrongs: (strongsNumber: string) => ConcordanceResult[];

  /** Get the count of occurrences for a Strong's number */
  getStrongsOccurrenceCount: (strongsNumber: string) => number;

  /** Search Strong's entries by lemma (original word) */
  searchStrongsByLemma: (lemma: string) => StrongsEntry[];

  /** Search Strong's entries by definition */
  searchStrongsByDefinition: (query: string) => StrongsEntry[];
}

const StudyDataContext = createContext<StudyDataContextValue>();

export function StudyDataProvider(props: ParentProps) {
  // Use createResource to load database in background
  const [ready] = createResource(async () => {
    await initStudyDatabase();
    return true;
  });

  // Helper to guard functions on ready state
  const withReady = <T,>(fn: () => T, defaultValue: T): T =>
    ready() ? fn() : defaultValue;

  // Wrap sync functions to handle loading state
  const getCrossRefs = (
    book: number,
    chapter: number,
    verse: number,
  ): Reference[] => withReady(() => getCrossRefsSync(book, chapter, verse), []);

  const getStrongsEntry = (number: string): StrongsEntry | null =>
    withReady(() => getStrongsEntrySync(number), null);

  const getVerseWords = (
    book: number,
    chapter: number,
    verse: number,
  ): WordWithStrongs[] =>
    withReady(() => getVerseWordsSync(book, chapter, verse), []);

  const getMarginNotes = (
    book: number,
    chapter: number,
    verse: number,
  ): MarginNote[] =>
    withReady(() => getMarginNotesSync(book, chapter, verse), []);

  const searchByStrongs = (strongsNumber: string): ConcordanceResult[] =>
    withReady(() => searchByStrongsSync(strongsNumber), []);

  const getStrongsOccurrenceCount = (strongsNumber: string): number =>
    withReady(() => getStrongsOccurrenceCountSync(strongsNumber), 0);

  const searchStrongsByLemma = (lemma: string): StrongsEntry[] =>
    withReady(() => searchStrongsByLemmaSync(lemma), []);

  const searchStrongsByDefinition = (query: string): StrongsEntry[] =>
    withReady(() => searchStrongsByDefinitionSync(query), []);

  const value: StudyDataContextValue = {
    ready,
    isLoading: () => ready.loading,
    error: () => ready.error as Error | undefined,
    getCrossRefs,
    getStrongsEntry,
    getVerseWords,
    getMarginNotes,
    searchByStrongs,
    getStrongsOccurrenceCount,
    searchStrongsByLemma,
    searchStrongsByDefinition,
  };

  return (
    <StudyDataContext.Provider value={value}>
      {props.children}
    </StudyDataContext.Provider>
  );
}

export function useStudyData(): StudyDataContextValue {
  const ctx = useContext(StudyDataContext);
  if (!ctx) {
    throw new Error('useStudyData must be used within a StudyDataProvider');
  }
  return ctx;
}
