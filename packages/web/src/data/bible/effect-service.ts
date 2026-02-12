import { Context, Effect, Layer } from 'effect';
import type { ChapterResponse, SearchResult, Verse } from '@bible/api';
import {
  getNextChapter as getNextChapterNav,
  getPrevChapter as getPrevChapterNav,
} from '@bible/core/bible-reader';

import { getBook } from './types';
import { DbClientService } from '../db-client-service';
import type { DatabaseQueryError } from '../errors';
import { RecordNotFoundError } from '../errors';

interface VerseRow {
  book: number;
  chapter: number;
  verse: number;
  text: string;
}

interface WebBibleServiceShape {
  readonly fetchChapter: (
    book: number,
    chapter: number,
  ) => Effect.Effect<ChapterResponse, DatabaseQueryError | RecordNotFoundError>;

  readonly fetchVerses: (
    book: number,
    chapter: number,
  ) => Effect.Effect<readonly Verse[], DatabaseQueryError>;

  readonly searchVerses: (
    query: string,
    limit?: number,
  ) => Effect.Effect<readonly SearchResult[], DatabaseQueryError>;
}

export class WebBibleService extends Context.Tag('@bible-web/BibleService')<
  WebBibleService,
  WebBibleServiceShape
>() {
  static Live = Layer.effect(
    WebBibleService,
    Effect.gen(function* () {
      const db = yield* DbClientService;

      const fetchChapter = Effect.fn('WebBibleService.fetchChapter')(function* (
        book: number,
        chapter: number,
      ) {
        const verses = yield* db.query<VerseRow>(
          'bible',
          'SELECT book, chapter, verse, text FROM verses WHERE book = ? AND chapter = ? ORDER BY verse',
          [book, chapter],
        );

        const bookInfo = getBook(book);
        if (!bookInfo) {
          return yield* new RecordNotFoundError({
            entity: 'Book',
            id: String(book),
          });
        }

        const prev = getPrevChapterNav(book, chapter);
        const next = getNextChapterNav(book, chapter);

        return {
          book: {
            number: bookInfo.number,
            name: bookInfo.name,
            chapters: bookInfo.chapters,
            testament: bookInfo.testament,
          },
          chapter,
          verses: verses.map((v) => ({
            book: v.book,
            chapter: v.chapter,
            verse: v.verse,
            text: v.text,
          })),
          prevChapter: prev ? { book: prev.book, chapter: prev.chapter } : null,
          nextChapter: next ? { book: next.book, chapter: next.chapter } : null,
        } satisfies ChapterResponse;
      });

      const fetchVerses = Effect.fn('WebBibleService.fetchVerses')(function* (
        book: number,
        chapter: number,
      ) {
        return yield* db.query<Verse>(
          'bible',
          'SELECT book, chapter, verse, text FROM verses WHERE book = ? AND chapter = ? ORDER BY verse',
          [book, chapter],
        );
      });

      const searchVerses = Effect.fn('WebBibleService.searchVerses')(function* (
        query: string,
        limit = 50,
      ) {
        if (!query.trim()) return [] as readonly SearchResult[];

        const rows = yield* db.query<VerseRow>(
          'bible',
          `SELECT v.book, v.chapter, v.verse, v.text
           FROM verses_fts fts
           JOIN verses v ON v.rowid = fts.rowid
           WHERE verses_fts MATCH ?
           LIMIT ?`,
          [query, limit],
        );

        return rows.map((r) => {
          const bookInfo = getBook(r.book);
          return {
            book: r.book,
            bookName: bookInfo?.name ?? `Book ${r.book}`,
            chapter: r.chapter,
            verse: r.verse,
            text: r.text,
          } satisfies SearchResult;
        });
      });

      return WebBibleService.of({ fetchChapter, fetchVerses, searchVerses });
    }),
  );
}
