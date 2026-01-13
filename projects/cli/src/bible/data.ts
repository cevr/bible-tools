import { Context, Effect, Layer } from 'effect';
import { matchSorter } from 'match-sorter';

import kjvData from '../../assets/kjv.json';
import {
  BOOK_ALIASES,
  BOOKS,
  type Book,
  type Reference,
  type SearchResult,
  type Verse,
} from './types.js';

// Pre-process verses into a map by book and chapter for fast lookup
type ChapterMap = Map<number, Map<number, Verse[]>>;

function buildChapterMap(verses: Verse[]): ChapterMap {
  const map: ChapterMap = new Map();
  for (const verse of verses) {
    if (!map.has(verse.book)) {
      map.set(verse.book, new Map());
    }
    const bookMap = map.get(verse.book)!;
    if (!bookMap.has(verse.chapter)) {
      bookMap.set(verse.chapter, []);
    }
    bookMap.get(verse.chapter)!.push(verse);
  }
  return map;
}

// Build the chapter map at module load time
const allVerses = kjvData.verses as Verse[];
const chapterMap = buildChapterMap(allVerses);

// Service interface
export interface BibleDataService {
  readonly getBooks: () => Book[];
  readonly getBook: (bookNumber: number) => Book | undefined;
  readonly getChapter: (book: number, chapter: number) => Verse[];
  readonly getVerse: (
    book: number,
    chapter: number,
    verse: number,
  ) => Verse | undefined;
  readonly searchVerses: (query: string, limit?: number) => SearchResult[];
  readonly parseReference: (ref: string) => Reference | undefined;
  readonly getNextChapter: (
    book: number,
    chapter: number,
  ) => Reference | undefined;
  readonly getPrevChapter: (
    book: number,
    chapter: number,
  ) => Reference | undefined;
}

// Effect service tag
export class BibleData extends Context.Tag('BibleData')<
  BibleData,
  BibleDataService
>() {}

// Create the service implementation
function createBibleDataService(): BibleDataService {
  return {
    getBooks(): Book[] {
      return BOOKS;
    },

    getBook(bookNumber: number): Book | undefined {
      return BOOKS.find((b) => b.number === bookNumber);
    },

    getChapter(book: number, chapter: number): Verse[] {
      return chapterMap.get(book)?.get(chapter) ?? [];
    },

    getVerse(book: number, chapter: number, verse: number): Verse | undefined {
      const verses = this.getChapter(book, chapter);
      return verses.find((v) => v.verse === verse);
    },

    searchVerses(query: string, limit = 50): SearchResult[] {
      // Full-text search using match-sorter
      const results = matchSorter(allVerses, query, {
        keys: ['text'],
        threshold: matchSorter.rankings.CONTAINS,
      });

      return results.slice(0, limit).map((verse, index) => ({
        verse,
        reference: {
          book: verse.book,
          chapter: verse.chapter,
          verse: verse.verse,
        },
        matchScore: 1 - index / results.length,
      }));
    },

    parseReference(ref: string): Reference | undefined {
      // Normalize input
      const input = ref.trim().toLowerCase();
      if (!input) return undefined;

      // Try to match patterns like:
      // "john 3:16", "john 3", "john3:16", "1 cor 13:1", "1cor13:1"
      // First, try to extract chapter and verse numbers from the end
      const chapterVerseMatch = input.match(/(\d+)(?::(\d+))?$/);
      if (!chapterVerseMatch) {
        // No chapter/verse found, try to match book name only
        const bookNum = BOOK_ALIASES[input];
        if (bookNum) {
          return { book: bookNum, chapter: 1, verse: 1 };
        }
        return undefined;
      }

      const chapterStr = chapterVerseMatch[1];
      const verseStr = chapterVerseMatch[2];
      if (!chapterStr) return undefined;

      const chapter = parseInt(chapterStr, 10);
      const verse = verseStr ? parseInt(verseStr, 10) : undefined;

      // Extract book name (everything before the chapter/verse)
      let bookPart = input.slice(0, chapterVerseMatch.index).trim();

      // Handle cases like "1cor" where there's no space
      if (!bookPart) {
        // Try to extract book name that might be stuck to the number
        const numberedBookMatch = input.match(/^(\d+\s*[a-z]+)/);
        if (numberedBookMatch && numberedBookMatch[1]) {
          bookPart = numberedBookMatch[1];
        }
      }

      if (!bookPart) return undefined;

      // Look up the book number
      let bookNum: number | undefined = BOOK_ALIASES[bookPart];

      // If not found, try some variations
      if (!bookNum) {
        // Try removing spaces
        const noSpaces = bookPart.replace(/\s+/g, '');
        bookNum = BOOK_ALIASES[noSpaces];
      }
      if (!bookNum) {
        // Try adding space after number (e.g., "1cor" -> "1 cor")
        const withSpace = bookPart.replace(/^(\d)([a-z])/, '$1 $2');
        bookNum = BOOK_ALIASES[withSpace];
      }
      if (!bookNum) {
        // Try fuzzy match on book names
        const bookMatches = matchSorter(BOOKS, bookPart, {
          keys: ['name'],
          threshold: matchSorter.rankings.WORD_STARTS_WITH,
        });
        const firstMatch = bookMatches[0];
        if (firstMatch) {
          bookNum = firstMatch.number;
        }
      }

      if (!bookNum) return undefined;

      // Validate chapter exists
      const book = this.getBook(bookNum);
      if (!book || chapter < 1 || chapter > book.chapters) {
        return undefined;
      }

      // Validate verse exists if specified
      if (verse !== undefined) {
        const verses = this.getChapter(bookNum, chapter);
        if (verse < 1 || verse > verses.length) {
          return { book: bookNum, chapter, verse: undefined };
        }
      }

      return { book: bookNum, chapter, verse };
    },

    getNextChapter(book: number, chapter: number): Reference | undefined {
      const currentBook = this.getBook(book);
      if (!currentBook) return undefined;

      if (chapter < currentBook.chapters) {
        // Next chapter in same book
        return { book, chapter: chapter + 1 };
      }

      // Move to next book
      const nextBook = this.getBook(book + 1);
      if (nextBook) {
        return { book: book + 1, chapter: 1 };
      }

      // Wrap to Genesis
      return { book: 1, chapter: 1 };
    },

    getPrevChapter(book: number, chapter: number): Reference | undefined {
      if (chapter > 1) {
        // Previous chapter in same book
        return { book, chapter: chapter - 1 };
      }

      // Move to previous book
      const prevBook = this.getBook(book - 1);
      if (prevBook) {
        return { book: book - 1, chapter: prevBook.chapters };
      }

      // Wrap to Revelation
      const lastBook = BOOKS[BOOKS.length - 1];
      if (lastBook) {
        return { book: lastBook.number, chapter: lastBook.chapters };
      }
      return undefined;
    },
  };
}

// Live layer
export const BibleDataLive = Layer.succeed(BibleData, createBibleDataService());

// Helper to access the service in effects
export const bibleData = Effect.map(BibleData, (service) => service);
