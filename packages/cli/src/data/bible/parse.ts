/**
 * Bible Reference Parser for CLI
 *
 * Thin wrapper around @bible/core parser with fuzzy matching via match-sorter.
 */

import { matchSorter } from 'match-sorter';

import type { BibleBook, ParseBibleQueryOptions } from '@bible/core/bible-reader';
import { parseBibleQuery as coreParseBibleQuery } from '@bible/core/bible-reader';

// Re-export types and constructors from core
export type { ParsedBibleQuery } from '@bible/core/bible-reader';
export { ParsedBibleQueryConstructors as ParsedQuery } from '@bible/core/bible-reader';

import type { BibleDataSyncService, Verse } from './types.js';

/**
 * Fuzzy matcher using match-sorter library
 */
function fuzzyMatcher(books: readonly BibleBook[], query: string): BibleBook | undefined {
  const matches = matchSorter([...books], query, {
    keys: ['name'],
    threshold: matchSorter.rankings.WORD_STARTS_WITH,
  });
  return matches[0];
}

/**
 * Default parsing options with fuzzy matching enabled
 */
const defaultOptions: ParseBibleQueryOptions = {
  fuzzyMatcher,
};

/**
 * Parse a verse query into a structured result
 *
 * Uses the core parser with fuzzy matching enabled via match-sorter.
 * The BibleDataSyncService parameter is kept for backwards compatibility
 * but is no longer used for parsing (only for getVersesForQuery).
 */
export function parseVerseQuery(
  query: string,
  _data?: BibleDataSyncService,
): ReturnType<typeof coreParseBibleQuery> {
  return coreParseBibleQuery(query, defaultOptions);
}

/**
 * Get verses for a parsed query
 *
 * This is CLI-specific as it uses the CLI's Verse type and BibleDataSyncService.
 */
export function getVersesForQuery(
  query: ReturnType<typeof coreParseBibleQuery>,
  data: BibleDataSyncService,
): Verse[] {
  switch (query._tag) {
    case 'single': {
      const verseNum = query.ref.verse ?? 1;
      const verse = data.getVerse(query.ref.book, query.ref.chapter, verseNum);
      return verse ? [verse] : [];
    }

    case 'chapter': {
      return data.getChapter(query.book, query.chapter);
    }

    case 'verseRange': {
      const chapter = data.getChapter(query.book, query.chapter);
      return chapter.filter((v) => v.verse >= query.startVerse && v.verse <= query.endVerse);
    }

    case 'chapterRange': {
      const verses: Verse[] = [];
      for (let ch = query.startChapter; ch <= query.endChapter; ch++) {
        verses.push(...data.getChapter(query.book, ch));
      }
      return verses;
    }

    case 'fullBook': {
      const book = data.getBook(query.book);
      if (!book) return [];
      const verses: Verse[] = [];
      for (let ch = 1; ch <= book.chapters; ch++) {
        verses.push(...data.getChapter(query.book, ch));
      }
      return verses;
    }

    case 'search':
      return [];
  }
}
