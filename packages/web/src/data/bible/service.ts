import { Context, Layer } from 'effect';
import kjvData from '../kjv.json';
import {
  type Book,
  type Reference,
  type SearchResult,
  type Verse,
  BOOKS,
  BOOK_ALIASES,
  getBook,
} from './types';

/**
 * Pre-process verses into a map by book and chapter for O(1) lookup
 */
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

/**
 * Bible data service interface
 */
export interface BibleDataService {
  readonly getBooks: () => Book[];
  readonly getBook: (bookNumber: number) => Book | undefined;
  readonly getChapter: (book: number, chapter: number) => Verse[];
  readonly getVerse: (
    book: number,
    chapter: number,
    verse: number
  ) => Verse | undefined;
  readonly searchVerses: (query: string, limit?: number) => SearchResult[];
  readonly parseReference: (ref: string) => Reference | undefined;
  readonly getNextChapter: (
    book: number,
    chapter: number
  ) => Reference | undefined;
  readonly getPrevChapter: (
    book: number,
    chapter: number
  ) => Reference | undefined;
}

/**
 * Effect service tag
 */
export class BibleData extends Context.Tag('BibleData')<
  BibleData,
  BibleDataService
>() {}

/**
 * Create the service implementation
 */
function createBibleDataService(): BibleDataService {
  return {
    getBooks(): Book[] {
      return BOOKS;
    },

    getBook(bookNumber: number): Book | undefined {
      return getBook(bookNumber);
    },

    getChapter(book: number, chapter: number): Verse[] {
      return chapterMap.get(book)?.get(chapter) ?? [];
    },

    getVerse(book: number, chapter: number, verse: number): Verse | undefined {
      const verses = this.getChapter(book, chapter);
      return verses.find((v) => v.verse === verse);
    },

    searchVerses(query: string, limit = 50): SearchResult[] {
      if (!query.trim()) return [];

      const searchTerms = query.toLowerCase().split(/\s+/);
      const results: SearchResult[] = [];

      for (const verse of allVerses) {
        const text = verse.text.toLowerCase();
        const matches = searchTerms.every((term) => text.includes(term));

        if (matches) {
          results.push({
            verse,
            reference: {
              book: verse.book,
              chapter: verse.chapter,
              verse: verse.verse,
            },
            matchScore: 1,
          });

          if (results.length >= limit) break;
        }
      }

      return results;
    },

    parseReference(ref: string): Reference | undefined {
      const input = ref.trim().toLowerCase();
      if (!input) return undefined;

      // Try to match patterns like:
      // "john 3:16", "john 3", "john3:16", "1 cor 13:1"
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
        const numberedBookMatch = input.match(/^(\d+\s*[a-z]+)/);
        if (numberedBookMatch?.[1]) {
          bookPart = numberedBookMatch[1];
        }
      }

      if (!bookPart) return undefined;

      // Look up the book number
      let bookNum: number | undefined = BOOK_ALIASES[bookPart];

      // Try variations
      if (!bookNum) {
        const noSpaces = bookPart.replace(/\s+/g, '');
        bookNum = BOOK_ALIASES[noSpaces];
      }
      if (!bookNum) {
        const withSpace = bookPart.replace(/^(\d)([a-z])/, '$1 $2');
        bookNum = BOOK_ALIASES[withSpace];
      }
      if (!bookNum) {
        // Try fuzzy match on book names
        const lower = bookPart.toLowerCase();
        const match = BOOKS.find(
          (b) =>
            b.name.toLowerCase().startsWith(lower) ||
            b.name.toLowerCase().includes(lower)
        );
        if (match) {
          bookNum = match.number;
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

/**
 * Live layer providing the BibleData service
 */
export const BibleDataLive = Layer.succeed(BibleData, createBibleDataService());

/**
 * Singleton instance for direct use (not via Effect)
 */
export const bibleDataService = createBibleDataService();
