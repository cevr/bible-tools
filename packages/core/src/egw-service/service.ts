// @effect-diagnostics strictBooleanExpressions:off
/**
 * EGW Service - Unified EGW writings access
 *
 * This service provides a high-level API for EGW operations.
 * Used by both TUI (via RPC) and web (via HttpApi) clients.
 */

import { Context, Effect, Layer, Option, Schema, Stream } from 'effect';

import { EGWParagraphDatabase, type ParagraphDatabaseError } from '../egw-db/book-database.js';

// ============================================================================
// Types
// ============================================================================

/**
 * EGW Book info
 */
export class EGWBook extends Schema.Class<EGWBook>('EGWBook')({
  bookId: Schema.Number,
  bookCode: Schema.String,
  title: Schema.String,
  author: Schema.String,
  paragraphCount: Schema.optional(Schema.Number),
}) {}

/**
 * EGW Paragraph
 */
export class EGWParagraph extends Schema.Class<EGWParagraph>('EGWParagraph')({
  paraId: Schema.NullOr(Schema.String),
  refcodeShort: Schema.NullOr(Schema.String),
  content: Schema.NullOr(Schema.String),
  puborder: Schema.Number,
  elementType: Schema.NullOr(Schema.String),
}) {}

/**
 * EGW Chapter (table of contents entry)
 */
export class EGWChapter extends Schema.Class<EGWChapter>('EGWChapter')({
  title: Schema.NullOr(Schema.String),
  refcodeShort: Schema.NullOr(Schema.String),
  puborder: Schema.Number,
  page: Schema.NullOr(Schema.Number),
}) {}

/**
 * EGW Page response
 */
export class EGWPageResponse extends Schema.Class<EGWPageResponse>('EGWPageResponse')({
  book: EGWBook,
  page: Schema.Number,
  paragraphs: Schema.Array(EGWParagraph),
  chapterHeading: Schema.NullOr(Schema.String),
  prevPage: Schema.NullOr(Schema.Number),
  nextPage: Schema.NullOr(Schema.Number),
  totalPages: Schema.Number,
}) {}

/**
 * EGW Search result
 */
export class EGWSearchResult extends Schema.Class<EGWSearchResult>('EGWSearchResult')({
  paraId: Schema.NullOr(Schema.String),
  refcodeShort: Schema.NullOr(Schema.String),
  content: Schema.NullOr(Schema.String),
  puborder: Schema.Number,
  bookCode: Schema.String,
  bookTitle: Schema.String,
}) {}

// ============================================================================
// Service Interface
// ============================================================================

/**
 * EGW service interface
 */
export interface EGWServiceShape {
  readonly getBooks: () => Effect.Effect<readonly EGWBook[], ParagraphDatabaseError>;
  readonly getBook: (
    bookCode: string,
  ) => Effect.Effect<Option.Option<EGWBook>, ParagraphDatabaseError>;
  readonly getPage: (
    bookCode: string,
    page: number,
  ) => Effect.Effect<EGWPageResponse | null, ParagraphDatabaseError>;
  readonly getChapters: (
    bookCode: string,
  ) => Effect.Effect<readonly EGWChapter[], ParagraphDatabaseError>;
  readonly search: (
    query: string,
    limit?: number,
    bookCode?: string,
  ) => Effect.Effect<readonly EGWSearchResult[], ParagraphDatabaseError>;
}

// ============================================================================
// Service Definition
// ============================================================================

export class EGWService extends Context.Tag('@bible/core/egw-service/service/EGWService')<
  EGWService,
  EGWServiceShape
>() {
  /**
   * Live implementation using EGWParagraphDatabase
   */
  static Live: Layer.Layer<EGWService, ParagraphDatabaseError, EGWParagraphDatabase> = Layer.effect(
    EGWService,
    Effect.gen(function* () {
      const db = yield* EGWParagraphDatabase;

      // Default author for EGW writings
      const EGW_AUTHOR = 'Ellen G. White';

      const getBooks = (): Effect.Effect<readonly EGWBook[], ParagraphDatabaseError> =>
        Stream.runCollect(db.getBooksByAuthor(EGW_AUTHOR)).pipe(
          Effect.map((chunk) =>
            [...chunk].map(
              (row) =>
                new EGWBook({
                  bookId: row.book_id,
                  bookCode: row.book_code,
                  title: row.book_title,
                  author: row.book_author,
                  paragraphCount: row.paragraph_count,
                }),
            ),
          ),
        );

      const getBook = (
        bookCode: string,
      ): Effect.Effect<Option.Option<EGWBook>, ParagraphDatabaseError> =>
        db.getBookByCode(bookCode).pipe(
          Effect.map((opt) =>
            Option.map(
              opt,
              (row) =>
                new EGWBook({
                  bookId: row.book_id,
                  bookCode: row.book_code,
                  title: row.book_title,
                  author: row.book_author,
                  paragraphCount: row.paragraph_count,
                }),
            ),
          ),
        );

      const getPage = (
        bookCode: string,
        page: number,
      ): Effect.Effect<EGWPageResponse | null, ParagraphDatabaseError> =>
        Effect.gen(function* () {
          // Get book info
          const bookOpt = yield* db.getBookByCode(bookCode);
          if (Option.isNone(bookOpt)) {
            return null;
          }
          const book = bookOpt.value;

          // Get paragraphs for this page
          const paragraphs = yield* db.getParagraphsByPage(book.book_id, page);
          if (paragraphs.length === 0) {
            return null;
          }

          // Convert to API types
          const apiParagraphs = paragraphs.map(
            (p) =>
              new EGWParagraph({
                paraId: p.para_id ?? null,
                refcodeShort: p.refcode_short ?? null,
                content: p.content ?? null,
                puborder: p.puborder,
                elementType: p.element_type ?? null,
              }),
          );

          // Find chapter heading for this page
          const chapterHeading =
            paragraphs.find(
              (p) =>
                p.element_type?.toLowerCase().startsWith('h') ||
                p.element_type === 'chapter' ||
                p.element_type === 'title',
            )?.content ?? null;

          // Calculate total pages
          const totalPages = Math.ceil(book.paragraph_count / 10) || 1;

          return new EGWPageResponse({
            book: new EGWBook({
              bookId: book.book_id,
              bookCode: book.book_code,
              title: book.book_title,
              author: book.book_author,
              paragraphCount: book.paragraph_count,
            }),
            page,
            paragraphs: apiParagraphs,
            chapterHeading,
            prevPage: page > 1 ? page - 1 : null,
            nextPage: page < totalPages ? page + 1 : null,
            totalPages,
          });
        });

      const getChapters = (
        bookCode: string,
      ): Effect.Effect<readonly EGWChapter[], ParagraphDatabaseError> =>
        Effect.gen(function* () {
          const bookOpt = yield* db.getBookByCode(bookCode);
          if (Option.isNone(bookOpt)) {
            return [];
          }

          const headings = yield* db.getChapterHeadings(bookOpt.value.book_id);

          return headings.map((h) => {
            // Parse page number from refcode
            const pageMatch = h.refcode_short?.match(/\s(\d+)\./);
            const pageStr = pageMatch?.[1];
            const page = pageStr ? parseInt(pageStr, 10) : null;

            return new EGWChapter({
              title: h.content ?? null,
              refcodeShort: h.refcode_short ?? null,
              puborder: h.puborder,
              page,
            });
          });
        });

      const search = (
        query: string,
        limit: number = 50,
        _bookCode?: string,
      ): Effect.Effect<readonly EGWSearchResult[], ParagraphDatabaseError> =>
        db.searchParagraphs(query, limit).pipe(
          Effect.map((results) =>
            results.map(
              (r) =>
                new EGWSearchResult({
                  paraId: r.para_id ?? null,
                  refcodeShort: r.refcode_short ?? null,
                  content: r.content ?? null,
                  puborder: r.puborder,
                  bookCode: r.bookCode,
                  bookTitle: r.bookCode, // We don't have title in search results
                }),
            ),
          ),
        );

      return {
        getBooks,
        getBook,
        getPage,
        getChapters,
        search,
      };
    }),
  );

  /**
   * Default layer - alias for Live
   */
  static Default = EGWService.Live;

  /**
   * Test implementation with configurable mock data
   */
  static Test = (
    config: {
      books?: readonly EGWBook[];
      paragraphs?: readonly EGWParagraph[];
    } = {},
  ): Layer.Layer<EGWService> =>
    Layer.succeed(EGWService, {
      getBooks: () => Effect.succeed(config.books ?? []),
      getBook: (bookCode) =>
        Effect.succeed(
          Option.fromNullable(
            config.books?.find((b) => b.bookCode.toLowerCase() === bookCode.toLowerCase()),
          ),
        ),
      getPage: () => Effect.succeed(null),
      getChapters: () => Effect.succeed([]),
      search: () => Effect.succeed([]),
    });
}
