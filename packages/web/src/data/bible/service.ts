/**
 * Bible Data Service
 *
 * Provides Bible data via HTTP API instead of embedded JSON.
 * This significantly reduces the frontend bundle size (~7.9MB savings).
 */

import type { Book, ChapterResponse, SearchResult, Verse } from '@bible/api';
import {
  getNextChapter as getNextChapterNav,
  getPrevChapter as getPrevChapterNav,
} from '@bible/core/bible-reader';

import { BOOKS, BOOK_ALIASES, getBook, type Reference } from './types.js';

// ============================================================================
// Chapter Cache
// ============================================================================

const chapterCache = new Map<string, ChapterResponse>();

function getCacheKey(book: number, chapter: number): string {
  return `${book}:${chapter}`;
}

// ============================================================================
// API Fetchers
// ============================================================================

/**
 * Fetch a chapter from the API.
 */
export async function fetchChapter(book: number, chapter: number): Promise<ChapterResponse> {
  const cacheKey = getCacheKey(book, chapter);
  const cached = chapterCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await fetch(`/api/bible/${book}/${chapter}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch chapter: ${response.statusText}`);
  }

  const data = (await response.json()) as ChapterResponse;
  chapterCache.set(cacheKey, data);
  return data;
}

/**
 * Fetch verses for a chapter.
 */
export async function fetchVerses(book: number, chapter: number): Promise<readonly Verse[]> {
  const data = await fetchChapter(book, chapter);
  return data.verses;
}

/**
 * Search verses via API.
 */
export async function searchVerses(query: string, limit = 50): Promise<readonly SearchResult[]> {
  if (!query.trim()) return [];

  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const response = await fetch(`/api/bible/search?${params}`);
  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`);
  }

  return response.json();
}

// ============================================================================
// Synchronous Service (for book metadata only)
// ============================================================================

/**
 * Static Bible data methods that don't require API calls.
 * For verse/chapter data, use the async fetchers above.
 */
export const bibleDataService = {
  getBooks(): readonly Book[] {
    return BOOKS.map((b) => ({
      number: b.number,
      name: b.name,
      chapters: b.chapters,
      testament: b.testament,
    }));
  },

  getBook(bookNumber: number): Book | undefined {
    const book = getBook(bookNumber);
    if (!book) return undefined;
    return {
      number: book.number,
      name: book.name,
      chapters: book.chapters,
      testament: book.testament,
    };
  },

  parseReference(ref: string): Reference | undefined {
    const input = ref.trim().toLowerCase();
    if (!input) return undefined;

    const chapterVerseMatch = input.match(/(\d+)(?::(\d+))?$/);
    if (!chapterVerseMatch) {
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

    let bookPart = input.slice(0, chapterVerseMatch.index).trim();

    if (!bookPart) {
      const numberedBookMatch = input.match(/^(\d+\s*[a-z]+)/);
      if (numberedBookMatch?.[1]) {
        bookPart = numberedBookMatch[1];
      }
    }

    if (!bookPart) return undefined;

    let bookNum: number | undefined = BOOK_ALIASES[bookPart];

    if (!bookNum) {
      const noSpaces = bookPart.replace(/\s+/g, '');
      bookNum = BOOK_ALIASES[noSpaces];
    }
    if (!bookNum) {
      const withSpace = bookPart.replace(/^(\d)([a-z])/, '$1 $2');
      bookNum = BOOK_ALIASES[withSpace];
    }
    if (!bookNum) {
      const lower = bookPart.toLowerCase();
      const match = BOOKS.find(
        (b) => b.name.toLowerCase().startsWith(lower) || b.name.toLowerCase().includes(lower),
      );
      if (match) {
        bookNum = match.number;
      }
    }

    if (!bookNum) return undefined;

    const book = getBook(bookNum);
    if (!book || chapter < 1 || chapter > book.chapters) {
      return undefined;
    }

    return { book: bookNum, chapter, verse };
  },

  getNextChapter(book: number, chapter: number): Reference | undefined {
    return getNextChapterNav(book, chapter);
  },

  getPrevChapter(book: number, chapter: number): Reference | undefined {
    return getPrevChapterNav(book, chapter);
  },
};
