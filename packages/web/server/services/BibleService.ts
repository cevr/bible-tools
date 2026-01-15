/**
 * Bible Service - Database-backed Bible data access
 *
 * Uses the unified BibleDatabase from @bible/core for all Bible operations.
 * This service wraps the database layer to provide the interface expected
 * by the API handlers.
 */
import { Context, Effect, Layer, Option } from 'effect';

import type { Book, ChapterReference, SearchResult, Verse } from '@bible/api';
import {
  BibleDatabase,
  type BibleDatabaseError,
} from '@bible/core/bible-db';

// ============================================================================
// Service Definition
// ============================================================================

export class BibleService extends Context.Tag('@bible/web/BibleService')<
  BibleService,
  {
    readonly getBooks: () => Effect.Effect<readonly Book[], BibleDatabaseError>;
    readonly getBook: (
      bookNum: number,
    ) => Effect.Effect<Option.Option<Book>, BibleDatabaseError>;
    readonly getChapter: (
      bookNum: number,
      chapterNum: number,
    ) => Effect.Effect<readonly Verse[], BibleDatabaseError>;
    readonly getPrevChapter: (
      bookNum: number,
      chapterNum: number,
    ) => Effect.Effect<ChapterReference | null>;
    readonly getNextChapter: (
      bookNum: number,
      chapterNum: number,
    ) => Effect.Effect<ChapterReference | null>;
    readonly search: (
      query: string,
      limit: number,
    ) => Effect.Effect<readonly SearchResult[], BibleDatabaseError>;
  }
>() {}

// ============================================================================
// Service Implementation
// ============================================================================

export const BibleServiceLive = Layer.effect(
  BibleService,
  Effect.gen(function* () {
    const db = yield* BibleDatabase;

    // Build book map for navigation lookups (initialization - fail fast on error)
    const booksResult = yield* db.getBooks().pipe(Effect.orDie);
    const bookMap = new Map<number, (typeof booksResult)[number]>();
    for (const book of booksResult) {
      bookMap.set(book.number, book);
    }

    return {
      getBooks: () =>
        db.getBooks().pipe(
          Effect.map((books) =>
            books.map((b) => ({
              number: b.number,
              name: b.name,
              chapters: b.chapters,
              testament: b.testament,
            })),
          ),
        ),

      getBook: (bookNum) =>
        db.getBook(bookNum).pipe(
          Effect.map((optBook) =>
            Option.map(optBook, (b) => ({
              number: b.number,
              name: b.name,
              chapters: b.chapters,
              testament: b.testament,
            })),
          ),
        ),

      getChapter: (bookNum, chapterNum) =>
        db.getChapter(bookNum, chapterNum).pipe(
          Effect.map((verses) =>
            verses.map((v) => ({
              book: v.book,
              chapter: v.chapter,
              verse: v.verse,
              text: v.text,
            })),
          ),
        ),

      getPrevChapter: (bookNum, chapterNum) =>
        Effect.succeed(
          (() => {
            if (chapterNum > 1) {
              return { book: bookNum, chapter: chapterNum - 1 };
            }
            const prevBookNum = bookNum - 1;
            const prevBook = bookMap.get(prevBookNum);
            if (prevBook) {
              return { book: prevBookNum, chapter: prevBook.chapters };
            }
            return null;
          })(),
        ),

      getNextChapter: (bookNum, chapterNum) =>
        Effect.succeed(
          (() => {
            const currentBook = bookMap.get(bookNum);
            if (currentBook && chapterNum < currentBook.chapters) {
              return { book: bookNum, chapter: chapterNum + 1 };
            }
            const nextBookNum = bookNum + 1;
            const nextBook = bookMap.get(nextBookNum);
            if (nextBook) {
              return { book: nextBookNum, chapter: 1 };
            }
            return null;
          })(),
        ),

      search: (query, limit) =>
        db.searchVerses(query, limit).pipe(
          Effect.map((results) =>
            results.map((r) => {
              const book = bookMap.get(r.book);
              return {
                book: r.book,
                bookName: book?.name ?? `Book ${r.book}`,
                chapter: r.chapter,
                verse: r.verse,
                text: r.text,
              };
            }),
          ),
        ),
    };
  }),
);
