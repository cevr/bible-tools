import {
  BIBLE_BOOK_ALIASES,
  BIBLE_BOOKS,
  formatBibleReference,
  getBibleBook,
  getBibleBookByName,
  isReference,
  isSearch,
  parseBibleQuery,
  ParsedBibleQueryConstructors as ParsedQuery,
} from '@bible/core/bible-reader';
import { describe, expect, it } from 'bun:test';

describe('Bible reference parser (core)', () => {
  describe('parseBibleQuery', () => {
    it('should parse single verse reference', () => {
      const result = parseBibleQuery('john 3:16');
      expect(result).toEqual({
        _tag: 'single',
        ref: { book: 43, chapter: 3, verse: 16 },
      });
    });

    it('should parse chapter reference', () => {
      const result = parseBibleQuery('john 3');
      expect(result).toEqual({
        _tag: 'chapter',
        book: 43,
        chapter: 3,
      });
    });

    it('should parse verse range', () => {
      const result = parseBibleQuery('john 3:16-18');
      expect(result).toEqual({
        _tag: 'verseRange',
        book: 43,
        chapter: 3,
        startVerse: 16,
        endVerse: 18,
      });
    });

    it('should parse chapter range', () => {
      const result = parseBibleQuery('psalm 1-3');
      expect(result).toEqual({
        _tag: 'chapterRange',
        book: 19,
        startChapter: 1,
        endChapter: 3,
      });
    });

    it('should parse full book name', () => {
      const result = parseBibleQuery('ruth');
      expect(result).toEqual({
        _tag: 'fullBook',
        book: 8,
      });
    });

    it('should handle numbered book names with space', () => {
      const result = parseBibleQuery('1 cor 13');
      expect(result).toEqual({
        _tag: 'chapter',
        book: 46,
        chapter: 13,
      });
    });

    it('should handle numbered book names without space', () => {
      const result = parseBibleQuery('1cor 13');
      expect(result).toEqual({
        _tag: 'chapter',
        book: 46,
        chapter: 13,
      });
    });

    it('should handle abbreviations', () => {
      const result = parseBibleQuery('gen 1:1');
      expect(result).toEqual({
        _tag: 'single',
        ref: { book: 1, chapter: 1, verse: 1 },
      });
    });

    it('should handle psalms abbreviation', () => {
      const result = parseBibleQuery('ps 23');
      expect(result).toEqual({
        _tag: 'chapter',
        book: 19,
        chapter: 23,
      });
    });

    it('should handle revelation', () => {
      const result = parseBibleQuery('rev 22:21');
      expect(result).toEqual({
        _tag: 'single',
        ref: { book: 66, chapter: 22, verse: 21 },
      });
    });

    it('should fall back to search for unrecognized queries', () => {
      const result = parseBibleQuery('faith without works');
      expect(result).toEqual({
        _tag: 'search',
        query: 'faith without works',
      });
    });

    it('should fall back to search for empty input', () => {
      const result = parseBibleQuery('');
      expect(result).toEqual({
        _tag: 'search',
        query: '',
      });
    });

    it('should handle case insensitivity', () => {
      const result = parseBibleQuery('JOHN 3:16');
      expect(result).toEqual({
        _tag: 'single',
        ref: { book: 43, chapter: 3, verse: 16 },
      });
    });

    it('should handle extra whitespace', () => {
      const result = parseBibleQuery('  john   3 : 16  ');
      expect(result).toEqual({
        _tag: 'single',
        ref: { book: 43, chapter: 3, verse: 16 },
      });
    });
  });

  describe('ParsedQuery constructors', () => {
    it('should create single verse query', () => {
      const query = ParsedQuery.single({ book: 43, chapter: 3, verse: 16 });
      expect(query._tag).toBe('single');
    });

    it('should create chapter query', () => {
      const query = ParsedQuery.chapter(43, 3);
      expect(query._tag).toBe('chapter');
    });

    it('should create verse range query', () => {
      const query = ParsedQuery.verseRange(43, 3, 16, 18);
      expect(query._tag).toBe('verseRange');
    });

    it('should create chapter range query', () => {
      const query = ParsedQuery.chapterRange(19, 1, 3);
      expect(query._tag).toBe('chapterRange');
    });

    it('should create full book query', () => {
      const query = ParsedQuery.fullBook(8);
      expect(query._tag).toBe('fullBook');
    });

    it('should create search query', () => {
      const query = ParsedQuery.search('test');
      expect(query._tag).toBe('search');
    });
  });

  describe('isReference and isSearch', () => {
    it('should identify references correctly', () => {
      expect(isReference(parseBibleQuery('john 3:16'))).toBe(true);
      expect(isReference(parseBibleQuery('john 3'))).toBe(true);
      expect(isReference(parseBibleQuery('ruth'))).toBe(true);
    });

    it('should identify search correctly', () => {
      expect(isSearch(parseBibleQuery('faith hope love'))).toBe(true);
      expect(isSearch(parseBibleQuery('john 3:16'))).toBe(false);
    });
  });
});

describe('Bible books data (core)', () => {
  describe('BIBLE_BOOKS', () => {
    it('should have 66 books', () => {
      expect(BIBLE_BOOKS).toHaveLength(66);
    });

    it('should have Genesis as book 1', () => {
      const genesis = BIBLE_BOOKS[0];
      expect(genesis?.number).toBe(1);
      expect(genesis?.name).toBe('Genesis');
      expect(genesis?.chapters).toBe(50);
      expect(genesis?.testament).toBe('old');
    });

    it('should have Revelation as book 66', () => {
      const revelation = BIBLE_BOOKS[65];
      expect(revelation?.number).toBe(66);
      expect(revelation?.name).toBe('Revelation');
      expect(revelation?.chapters).toBe(22);
      expect(revelation?.testament).toBe('new');
    });

    it('should have correct testament assignments', () => {
      const oldTestament = BIBLE_BOOKS.filter((b) => b.testament === 'old');
      const newTestament = BIBLE_BOOKS.filter((b) => b.testament === 'new');
      expect(oldTestament).toHaveLength(39);
      expect(newTestament).toHaveLength(27);
    });
  });

  describe('BIBLE_BOOK_ALIASES', () => {
    it('should include common abbreviations', () => {
      expect(BIBLE_BOOK_ALIASES['gen']).toBe(1);
      expect(BIBLE_BOOK_ALIASES['genesis']).toBe(1);
      expect(BIBLE_BOOK_ALIASES['john']).toBe(43);
      expect(BIBLE_BOOK_ALIASES['jn']).toBe(43);
      expect(BIBLE_BOOK_ALIASES['rev']).toBe(66);
    });

    it('should include numbered book aliases', () => {
      expect(BIBLE_BOOK_ALIASES['1sam']).toBe(9);
      expect(BIBLE_BOOK_ALIASES['1 sam']).toBe(9);
      expect(BIBLE_BOOK_ALIASES['1 samuel']).toBe(9);
      expect(BIBLE_BOOK_ALIASES['1cor']).toBe(46);
      expect(BIBLE_BOOK_ALIASES['1 cor']).toBe(46);
    });
  });

  describe('getBibleBook', () => {
    it('should return book by number', () => {
      const book = getBibleBook(1);
      expect(book?.name).toBe('Genesis');
    });

    it('should return undefined for invalid number', () => {
      expect(getBibleBook(0)).toBeUndefined();
      expect(getBibleBook(67)).toBeUndefined();
    });
  });

  describe('getBibleBookByName', () => {
    it('should return book by name', () => {
      const book = getBibleBookByName('Genesis');
      expect(book?.number).toBe(1);
    });

    it('should return book by abbreviation', () => {
      const book = getBibleBookByName('gen');
      expect(book?.number).toBe(1);
    });

    it('should return undefined for invalid name', () => {
      expect(getBibleBookByName('NotABook')).toBeUndefined();
    });
  });

  describe('formatBibleReference', () => {
    it('should format reference with verse', () => {
      expect(formatBibleReference({ book: 43, chapter: 3, verse: 16 })).toBe('John 3:16');
    });

    it('should format reference without verse', () => {
      expect(formatBibleReference({ book: 43, chapter: 3 })).toBe('John 3');
    });

    it('should return empty string for invalid book', () => {
      expect(formatBibleReference({ book: 99, chapter: 1 })).toBe('');
    });
  });
});
