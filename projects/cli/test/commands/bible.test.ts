import { describe, expect, it } from 'vitest';

import { parseVerseQuery, getVersesForQuery, ParsedQuery } from '../../src/bible/parse.js';
import type { BibleDataService } from '../../src/bible/data.js';
import type { Verse, Book } from '../../src/bible/types.js';

// Minimal mock BibleDataService for testing parsing logic
function createMockBibleData(): BibleDataService {
  const books: Book[] = [
    { number: 8, name: 'Ruth', chapters: 4, testament: 'old' },
    { number: 19, name: 'Psalms', chapters: 150, testament: 'old' },
    { number: 43, name: 'John', chapters: 21, testament: 'new' },
    { number: 46, name: '1 Corinthians', chapters: 16, testament: 'new' },
  ];

  const verses: Record<string, Verse[]> = {
    '43-3': [
      { book_name: 'John', book: 43, chapter: 3, verse: 16, text: 'For God so loved the world...' },
      { book_name: 'John', book: 43, chapter: 3, verse: 17, text: 'For God sent not his Son...' },
      { book_name: 'John', book: 43, chapter: 3, verse: 18, text: 'He that believeth...' },
    ],
    '8-1': [
      { book_name: 'Ruth', book: 8, chapter: 1, verse: 1, text: 'Now it came to pass...' },
      { book_name: 'Ruth', book: 8, chapter: 1, verse: 2, text: 'And the name of the man...' },
    ],
    '8-2': [
      { book_name: 'Ruth', book: 8, chapter: 2, verse: 1, text: 'And Naomi had a kinsman...' },
    ],
    '19-1': [
      { book_name: 'Psalms', book: 19, chapter: 1, verse: 1, text: 'Blessed is the man...' },
      { book_name: 'Psalms', book: 19, chapter: 1, verse: 2, text: 'But his delight...' },
    ],
    '19-2': [
      { book_name: 'Psalms', book: 19, chapter: 2, verse: 1, text: 'Why do the heathen rage...' },
    ],
    '19-3': [
      { book_name: 'Psalms', book: 19, chapter: 3, verse: 1, text: 'LORD, how are they increased...' },
    ],
  };

  return {
    getBooks: () => books,
    getBook: (num) => books.find((b) => b.number === num),
    getChapter: (book, chapter) => verses[`${book}-${chapter}`] ?? [],
    getVerse: (book, chapter, verse) => {
      const ch = verses[`${book}-${chapter}`];
      return ch?.find((v) => v.verse === verse);
    },
    searchVerses: () => [],
    parseReference: () => undefined,
    getNextChapter: () => undefined,
    getPrevChapter: () => undefined,
  };
}

describe('bible verse parsing', () => {
  const data = createMockBibleData();

  describe('parseVerseQuery', () => {
    it('should parse single verse reference', () => {
      const result = parseVerseQuery('john 3:16', data);
      expect(result).toEqual({
        _tag: 'single',
        ref: { book: 43, chapter: 3, verse: 16 },
      });
    });

    it('should parse chapter reference', () => {
      const result = parseVerseQuery('john 3', data);
      expect(result).toEqual({
        _tag: 'chapter',
        book: 43,
        chapter: 3,
      });
    });

    it('should parse verse range', () => {
      const result = parseVerseQuery('john 3:16-18', data);
      expect(result).toEqual({
        _tag: 'verseRange',
        book: 43,
        chapter: 3,
        startVerse: 16,
        endVerse: 18,
      });
    });

    it('should parse chapter range', () => {
      const result = parseVerseQuery('psalm 1-3', data);
      expect(result).toEqual({
        _tag: 'chapterRange',
        book: 19,
        startChapter: 1,
        endChapter: 3,
      });
    });

    it('should parse full book name', () => {
      const result = parseVerseQuery('ruth', data);
      expect(result).toEqual({
        _tag: 'fullBook',
        book: 8,
      });
    });

    it('should handle numbered book names', () => {
      const result = parseVerseQuery('1 cor 13', data);
      expect(result).toEqual({
        _tag: 'chapter',
        book: 46,
        chapter: 13,
      });
    });

    it('should fall back to search for unrecognized queries', () => {
      const result = parseVerseQuery('faith without works', data);
      expect(result).toEqual({
        _tag: 'search',
        query: 'faith without works',
      });
    });

    it('should fall back to search for empty input', () => {
      const result = parseVerseQuery('', data);
      expect(result).toEqual({
        _tag: 'search',
        query: '',
      });
    });
  });

  describe('getVersesForQuery', () => {
    it('should get single verse', () => {
      const query = ParsedQuery.single({ book: 43, chapter: 3, verse: 16 });
      const verses = getVersesForQuery(query, data);
      expect(verses).toHaveLength(1);
      expect(verses[0]?.verse).toBe(16);
    });

    it('should get full chapter', () => {
      const query = ParsedQuery.chapter(43, 3);
      const verses = getVersesForQuery(query, data);
      expect(verses).toHaveLength(3);
    });

    it('should get verse range', () => {
      const query = ParsedQuery.verseRange(43, 3, 16, 17);
      const verses = getVersesForQuery(query, data);
      expect(verses).toHaveLength(2);
      expect(verses[0]?.verse).toBe(16);
      expect(verses[1]?.verse).toBe(17);
    });

    it('should get chapter range', () => {
      const query = ParsedQuery.chapterRange(19, 1, 3);
      const verses = getVersesForQuery(query, data);
      expect(verses).toHaveLength(4); // 2 + 1 + 1 verses
    });

    it('should get full book', () => {
      const query = ParsedQuery.fullBook(8);
      const verses = getVersesForQuery(query, data);
      expect(verses).toHaveLength(3); // 2 + 1 verses
    });

    it('should return empty array for search query', () => {
      const query = ParsedQuery.search('test');
      const verses = getVersesForQuery(query, data);
      expect(verses).toHaveLength(0);
    });
  });
});
