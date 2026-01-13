/**
 * EGW Reader Service
 *
 * Renderer-agnostic service for reading EGW writings.
 * Provides book listing, chapter navigation, and paragraph access.
 *
 * This service wraps the EGWParagraphDatabase and provides
 * a higher-level API suitable for reader UIs.
 */

import { Data, Effect, Option, Stream } from 'effect';

import { EGWParagraphDatabase } from '../egw-db/book-database.js';
import type * as EGWSchemas from '../egw/schemas.js';
import type { EGWBookInfo, EGWParagraph, EGWReaderPosition } from './types.js';

/**
 * Error types for the reader service
 */
export class EGWReaderError extends Data.TaggedError('EGWReaderError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class BookNotFoundError extends Data.TaggedError('BookNotFoundError')<{
  readonly bookCode: string;
}> {}

export class DatabaseNotInitializedError extends Data.TaggedError(
  'DatabaseNotInitializedError',
)<{
  readonly message: string;
}> {}

/**
 * Union of all reader errors
 */
export type ReaderError =
  | EGWReaderError
  | BookNotFoundError
  | DatabaseNotInitializedError;

/**
 * Convert database Paragraph to EGWParagraph
 */
function schemaParagraphToEGWParagraph(
  para: EGWSchemas.Paragraph,
): EGWParagraph {
  return {
    paraId: para.para_id ?? undefined,
    refcodeShort: para.refcode_short ?? undefined,
    refcodeLong: para.refcode_long ?? undefined,
    content: para.content ?? undefined,
    puborder: para.puborder,
    elementType: para.element_type ?? undefined,
    elementSubtype: para.element_subtype ?? undefined,
  };
}

/**
 * EGW Reader Service
 *
 * Provides high-level reading operations on EGW writings.
 */
export class EGWReaderService extends Effect.Service<EGWReaderService>()(
  'egw-reader/EGWReaderService',
  {
    effect: Effect.gen(function* () {
      const db = yield* EGWParagraphDatabase;

      /**
       * Get all available books
       */
      const getBooks = (
        author: string = 'Ellen Gould White',
      ): Effect.Effect<readonly EGWBookInfo[], ReaderError> =>
        db.getBooksByAuthor(author).pipe(
          Stream.map(
            (row): EGWBookInfo => ({
              bookId: row.book_id,
              bookCode: row.book_code,
              title: row.book_title,
              author,
              pageCount: undefined,
            }),
          ),
          Stream.runCollect,
          Effect.map((chunk) => [...chunk]),
          Effect.mapError(
            (e) =>
              new EGWReaderError({ message: 'Failed to get books', cause: e }),
          ),
        );

      /**
       * Get a book by its code
       */
      const getBookByCode = (
        bookCode: string,
        author: string = 'Ellen Gould White',
      ): Effect.Effect<Option.Option<EGWBookInfo>, ReaderError> =>
        getBooks(author).pipe(
          Effect.map((books) => {
            const book = books.find(
              (b) => b.bookCode.toUpperCase() === bookCode.toUpperCase(),
            );
            return book ? Option.some(book) : Option.none();
          }),
        );

      /**
       * Get all paragraphs for a book
       */
      const getParagraphsByBook = (
        bookId: number,
      ): Effect.Effect<readonly EGWParagraph[], ReaderError> =>
        db.getParagraphsByBook(bookId).pipe(
          Stream.map(schemaParagraphToEGWParagraph),
          Stream.runCollect,
          Effect.map((chunk) => [...chunk]),
          Effect.mapError(
            (e) =>
              new EGWReaderError({
                message: 'Failed to get paragraphs',
                cause: e,
              }),
          ),
        );

      /**
       * Get paragraphs for a book by book code
       */
      const getParagraphsByBookCode = (
        bookCode: string,
        author: string = 'Ellen Gould White',
      ): Effect.Effect<readonly EGWParagraph[], ReaderError> =>
        getBookByCode(bookCode, author).pipe(
          Effect.flatMap((optBook) =>
            Option.match(optBook, {
              onNone: () => Effect.fail(new BookNotFoundError({ bookCode })),
              onSome: (book) => getParagraphsByBook(book.bookId),
            }),
          ),
        );

      /**
       * Get a single paragraph by refcode
       */
      const getParagraphByRefcode = (
        bookId: number,
        refcode: string,
      ): Effect.Effect<Option.Option<EGWParagraph>, ReaderError> =>
        db.getParagraph(bookId, refcode).pipe(
          Effect.map((opt) => Option.map(opt, schemaParagraphToEGWParagraph)),
          Effect.mapError(
            (e) =>
              new EGWReaderError({
                message: 'Failed to get paragraph',
                cause: e,
              }),
          ),
        );

      /**
       * Get paragraphs matching a page number (e.g., "351" from "PP 351.1")
       * Returns all paragraphs where refcode starts with "BOOK PAGE."
       */
      const getParagraphsByPage = (
        bookCode: string,
        page: number,
        author: string = 'Ellen Gould White',
      ): Effect.Effect<readonly EGWParagraph[], ReaderError> =>
        getParagraphsByBookCode(bookCode, author).pipe(
          Effect.map((paragraphs) => {
            const pagePrefix = `${bookCode} ${page}.`;
            return paragraphs.filter((p) => {
              const ref = p.refcodeShort ?? p.refcodeLong ?? '';
              return ref.toUpperCase().startsWith(pagePrefix.toUpperCase());
            });
          }),
        );

      /**
       * Find a paragraph by position (for navigation)
       */
      const findParagraphByPosition = (
        paragraphs: readonly EGWParagraph[],
        position: EGWReaderPosition,
      ): Option.Option<EGWParagraph> => {
        // If we have a puborder, find by that
        if (position.puborder != null) {
          const para = paragraphs.find((p) => p.puborder === position.puborder);
          return para ? Option.some(para) : Option.none();
        }

        // If we have page and paragraph, build refcode and search
        if (position.page != null && position.paragraph != null) {
          const refcode = `${position.bookCode} ${position.page}.${position.paragraph}`;
          const para = paragraphs.find((p) => {
            const ref = p.refcodeShort ?? p.refcodeLong ?? '';
            return ref.toUpperCase() === refcode.toUpperCase();
          });
          return para ? Option.some(para) : Option.none();
        }

        // If just page, find first paragraph on that page
        if (position.page != null) {
          const pagePrefix = `${position.bookCode} ${position.page}.`;
          const para = paragraphs.find((p) => {
            const ref = p.refcodeShort ?? p.refcodeLong ?? '';
            return ref.toUpperCase().startsWith(pagePrefix.toUpperCase());
          });
          return para ? Option.some(para) : Option.none();
        }

        // Default to first paragraph
        const first = paragraphs[0];
        return first ? Option.some(first) : Option.none();
      };

      /**
       * Search paragraphs by content
       */
      const searchParagraphs = (
        query: string,
        author: string = 'Ellen Gould White',
        limit: number = 50,
      ): Effect.Effect<readonly EGWParagraph[], ReaderError> =>
        db.getParagraphsByAuthor(author).pipe(
          Stream.filter((para) => {
            const content = para.content ?? '';
            return content.toLowerCase().includes(query.toLowerCase());
          }),
          Stream.take(limit),
          Stream.map(schemaParagraphToEGWParagraph),
          Stream.runCollect,
          Effect.map((chunk) => [...chunk]),
          Effect.mapError(
            (e) =>
              new EGWReaderError({
                message: 'Failed to search paragraphs',
                cause: e,
              }),
          ),
        );

      return {
        getBooks,
        getBookByCode,
        getParagraphsByBook,
        getParagraphsByBookCode,
        getParagraphByRefcode,
        getParagraphsByPage,
        findParagraphByPosition,
        searchParagraphs,
      } as const;
    }),
    dependencies: [EGWParagraphDatabase.Default],
  },
) {}
