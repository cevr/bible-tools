/**
 * EGW Service - Wraps EGWParagraphDatabase for API access
 *
 * Provides methods for accessing EGW writings stored in SQLite.
 * Translates between database types and API response types.
 */
import { Context, Effect, Layer, Option, Stream } from 'effect';

import type {
  EGWBookInfo,
  EGWChapter,
  EGWPageResponse,
  EGWParagraph,
  EGWSearchResult,
} from '@bible/api';
import {
  EGWParagraphDatabase,
  type BookRow,
  type ParagraphDatabaseError,
} from '@bible/core/egw-db';

// ============================================================================
// Service Definition
// ============================================================================

export class EGWService extends Context.Tag('@bible/web/EGWService')<
  EGWService,
  {
    readonly getBooks: () => Effect.Effect<
      readonly EGWBookInfo[],
      ParagraphDatabaseError
    >;
    readonly getBook: (
      bookCode: string,
    ) => Effect.Effect<Option.Option<EGWBookInfo>, ParagraphDatabaseError>;
    readonly getPage: (
      bookCode: string,
      page: number,
    ) => Effect.Effect<EGWPageResponse | null, ParagraphDatabaseError>;
    readonly getChapters: (
      bookCode: string,
    ) => Effect.Effect<readonly EGWChapter[], ParagraphDatabaseError>;
    readonly search: (
      query: string,
      limit: number,
      bookCode?: string,
    ) => Effect.Effect<readonly EGWSearchResult[], ParagraphDatabaseError>;
  }
>() {}

// ============================================================================
// Helper Functions
// ============================================================================

function bookRowToInfo(row: BookRow): EGWBookInfo {
  return {
    bookId: row.book_id,
    bookCode: row.book_code,
    title: row.book_title,
    author: row.book_author,
    paragraphCount: row.paragraph_count,
  };
}

// ============================================================================
// Layer - Wraps EGWParagraphDatabase
// ============================================================================

export const EGWServiceLive = Layer.effect(
  EGWService,
  Effect.gen(function* () {
    const db = yield* EGWParagraphDatabase;

    // Default author for EGW writings
    const EGW_AUTHOR = 'Ellen G. White';

    return {
      getBooks: () =>
        Stream.runCollect(db.getBooksByAuthor(EGW_AUTHOR)).pipe(
          Effect.map((chunk) => [...chunk].map(bookRowToInfo)),
        ),

      getBook: (bookCode: string) =>
        db.getBookByCode(bookCode).pipe(
          Effect.map((opt) => Option.map(opt, bookRowToInfo)),
        ),

      getPage: (bookCode: string, page: number) =>
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
          const apiParagraphs: EGWParagraph[] = paragraphs.map((p) => ({
            paraId: p.para_id ?? null,
            refcodeShort: p.refcode_short ?? null,
            content: p.content ?? null,
            puborder: p.puborder,
            elementType: p.element_type ?? null,
          }));

          // Find chapter heading for this page (if any)
          const chapterHeading =
            paragraphs.find(
              (p) =>
                p.element_type?.toLowerCase().startsWith('h') ||
                p.element_type === 'chapter' ||
                p.element_type === 'title',
            )?.content ?? null;

          // Calculate total pages (rough estimate based on max page number)
          // This is a simplification - in production you'd query for max page
          const totalPages = Math.ceil(book.paragraph_count / 10) || 1;

          return {
            book: bookRowToInfo(book),
            page,
            paragraphs: apiParagraphs,
            chapterHeading,
            prevPage: page > 1 ? page - 1 : null,
            nextPage: page < totalPages ? page + 1 : null,
            totalPages,
          };
        }),

      getChapters: (bookCode: string) =>
        Effect.gen(function* () {
          const bookOpt = yield* db.getBookByCode(bookCode);
          if (Option.isNone(bookOpt)) {
            return [];
          }

          const headings = yield* db.getChapterHeadings(bookOpt.value.book_id);

          return headings.map((h): EGWChapter => {
            // Parse page number from refcode
            const pageMatch = h.refcode_short?.match(/\s(\d+)\./);
            const page = pageMatch ? parseInt(pageMatch[1]!, 10) : null;

            return {
              title: h.content ?? null,
              refcodeShort: h.refcode_short ?? null,
              puborder: h.puborder,
              page,
            };
          });
        }),

      search: (query: string, limit: number, _bookCode?: string) =>
        db.searchParagraphs(query, limit).pipe(
          Effect.map((results) =>
            results.map(
              (r): EGWSearchResult => ({
                paraId: r.para_id ?? null,
                refcodeShort: r.refcode_short ?? null,
                content: r.content ?? null,
                puborder: r.puborder,
                bookCode: r.bookCode,
                bookTitle: r.bookCode, // We don't have title in search results
              }),
            ),
          ),
        ),
    };
  }),
);
