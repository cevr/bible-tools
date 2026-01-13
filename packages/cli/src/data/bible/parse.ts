import { matchSorter } from 'match-sorter';

import type { BibleDataService } from './data.js';
import { BOOK_ALIASES, BOOKS, type Reference, type Verse } from './types.js';

// Parsed query result - discriminated union
export type ParsedQuery =
  | { _tag: 'single'; ref: Reference }
  | { _tag: 'chapter'; book: number; chapter: number }
  | {
      _tag: 'verseRange';
      book: number;
      chapter: number;
      startVerse: number;
      endVerse: number;
    }
  | {
      _tag: 'chapterRange';
      book: number;
      startChapter: number;
      endChapter: number;
    }
  | { _tag: 'fullBook'; book: number }
  | { _tag: 'search'; query: string };

export const ParsedQuery = {
  single: (ref: Reference): ParsedQuery => ({ _tag: 'single', ref }),
  chapter: (book: number, chapter: number): ParsedQuery => ({
    _tag: 'chapter',
    book,
    chapter,
  }),
  verseRange: (
    book: number,
    chapter: number,
    startVerse: number,
    endVerse: number,
  ): ParsedQuery => ({
    _tag: 'verseRange',
    book,
    chapter,
    startVerse,
    endVerse,
  }),
  chapterRange: (
    book: number,
    startChapter: number,
    endChapter: number,
  ): ParsedQuery => ({
    _tag: 'chapterRange',
    book,
    startChapter,
    endChapter,
  }),
  fullBook: (book: number): ParsedQuery => ({ _tag: 'fullBook', book }),
  search: (query: string): ParsedQuery => ({ _tag: 'search', query }),
} as const;

// Try to resolve a book name to a book number
function resolveBook(bookPart: string): number | undefined {
  const normalized = bookPart.trim().toLowerCase();

  // Direct alias lookup
  let bookNum = BOOK_ALIASES[normalized];
  if (bookNum) return bookNum;

  // Try removing spaces
  const noSpaces = normalized.replace(/\s+/g, '');
  bookNum = BOOK_ALIASES[noSpaces];
  if (bookNum) return bookNum;

  // Try adding space after number (e.g., "1cor" -> "1 cor")
  const withSpace = normalized.replace(/^(\d)([a-z])/, '$1 $2');
  bookNum = BOOK_ALIASES[withSpace];
  if (bookNum) return bookNum;

  // Fuzzy match on book names
  const bookMatches = matchSorter(BOOKS, normalized, {
    keys: ['name'],
    threshold: matchSorter.rankings.WORD_STARTS_WITH,
  });
  if (bookMatches[0]) {
    return bookMatches[0].number;
  }

  return undefined;
}

// Parse a verse query into a structured result
export function parseVerseQuery(
  query: string,
  data: BibleDataService,
): ParsedQuery {
  const input = query.trim();
  if (!input) return ParsedQuery.search(query);

  // Regex patterns for different formats
  // "john 3:16-18" - verse range
  const verseRangeMatch = input.match(
    /^(.+?)\s*(\d+)\s*:\s*(\d+)\s*-\s*(\d+)$/i,
  );
  if (verseRangeMatch) {
    const [, bookPart, chapterStr, startVerseStr, endVerseStr] =
      verseRangeMatch;
    const bookNum = resolveBook(bookPart!);
    if (bookNum) {
      const chapter = parseInt(chapterStr!, 10);
      const startVerse = parseInt(startVerseStr!, 10);
      const endVerse = parseInt(endVerseStr!, 10);
      const book = data.getBook(bookNum);
      if (book && chapter >= 1 && chapter <= book.chapters) {
        return ParsedQuery.verseRange(bookNum, chapter, startVerse, endVerse);
      }
    }
  }

  // "john 3-5" - chapter range
  const chapterRangeMatch = input.match(/^(.+?)\s*(\d+)\s*-\s*(\d+)$/i);
  if (chapterRangeMatch) {
    const [, bookPart, startChapterStr, endChapterStr] = chapterRangeMatch;
    const bookNum = resolveBook(bookPart!);
    if (bookNum) {
      const startChapter = parseInt(startChapterStr!, 10);
      const endChapter = parseInt(endChapterStr!, 10);
      const book = data.getBook(bookNum);
      if (book && startChapter >= 1 && endChapter <= book.chapters) {
        return ParsedQuery.chapterRange(bookNum, startChapter, endChapter);
      }
    }
  }

  // "john 3:16" - single verse
  const singleVerseMatch = input.match(/^(.+?)\s*(\d+)\s*:\s*(\d+)$/i);
  if (singleVerseMatch) {
    const [, bookPart, chapterStr, verseStr] = singleVerseMatch;
    const bookNum = resolveBook(bookPart!);
    if (bookNum) {
      const chapter = parseInt(chapterStr!, 10);
      const verse = parseInt(verseStr!, 10);
      const book = data.getBook(bookNum);
      if (book && chapter >= 1 && chapter <= book.chapters) {
        return ParsedQuery.single({ book: bookNum, chapter, verse });
      }
    }
  }

  // "john 3" - single chapter
  const singleChapterMatch = input.match(/^(.+?)\s*(\d+)$/i);
  if (singleChapterMatch) {
    const [, bookPart, chapterStr] = singleChapterMatch;
    const bookNum = resolveBook(bookPart!);
    if (bookNum) {
      const chapter = parseInt(chapterStr!, 10);
      const book = data.getBook(bookNum);
      if (book && chapter >= 1 && chapter <= book.chapters) {
        return ParsedQuery.chapter(bookNum, chapter);
      }
    }
  }

  // "ruth" - full book (just a book name with no numbers)
  const bookOnlyMatch = input.match(/^([a-z\s]+)$/i);
  if (bookOnlyMatch) {
    const bookNum = resolveBook(bookOnlyMatch[1]!);
    if (bookNum) {
      return ParsedQuery.fullBook(bookNum);
    }
  }

  // Fallback: search
  return ParsedQuery.search(query);
}

// Get verses for a parsed query
export function getVersesForQuery(
  query: ParsedQuery,
  data: BibleDataService,
): Verse[] {
  switch (query._tag) {
    case 'single': {
      const verse = data.getVerse(
        query.ref.book,
        query.ref.chapter,
        query.ref.verse!,
      );
      return verse ? [verse] : [];
    }

    case 'chapter': {
      return data.getChapter(query.book, query.chapter);
    }

    case 'verseRange': {
      const chapter = data.getChapter(query.book, query.chapter);
      return chapter.filter(
        (v) => v.verse >= query.startVerse && v.verse <= query.endVerse,
      );
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
