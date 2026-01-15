/**
 * EGW API Group - Endpoints for Ellen G. White writings
 *
 * Provides typed endpoints for:
 * - Listing available books
 * - Getting a page with paragraphs
 * - Getting chapter headings for navigation
 * - Searching paragraphs
 */
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform';
import { Schema as S } from 'effect';

// ============================================================================
// Schemas
// ============================================================================

export const EGWBookInfoSchema = S.Struct({
  bookId: S.Number,
  bookCode: S.String,
  title: S.String,
  author: S.String,
  paragraphCount: S.optional(S.Number),
});

export type EGWBookInfo = S.Schema.Type<typeof EGWBookInfoSchema>;

export const EGWParagraphSchema = S.Struct({
  paraId: S.NullOr(S.String),
  refcodeShort: S.NullOr(S.String),
  content: S.NullOr(S.String),
  puborder: S.Number,
  elementType: S.NullOr(S.String),
});

export type EGWParagraph = S.Schema.Type<typeof EGWParagraphSchema>;

export const EGWPageResponseSchema = S.Struct({
  book: EGWBookInfoSchema,
  page: S.Number,
  paragraphs: S.Array(EGWParagraphSchema),
  chapterHeading: S.NullOr(S.String),
  // For prefetch hints
  prevPage: S.NullOr(S.Number),
  nextPage: S.NullOr(S.Number),
  totalPages: S.Number,
});

export type EGWPageResponse = S.Schema.Type<typeof EGWPageResponseSchema>;

export const EGWChapterSchema = S.Struct({
  title: S.NullOr(S.String),
  refcodeShort: S.NullOr(S.String),
  puborder: S.Number,
  page: S.NullOr(S.Number),
});

export type EGWChapter = S.Schema.Type<typeof EGWChapterSchema>;

export const EGWSearchResultSchema = S.Struct({
  paraId: S.NullOr(S.String),
  refcodeShort: S.NullOr(S.String),
  content: S.NullOr(S.String),
  puborder: S.Number,
  bookCode: S.String,
  bookTitle: S.String,
});

export type EGWSearchResult = S.Schema.Type<typeof EGWSearchResultSchema>;

// ============================================================================
// Errors
// ============================================================================

export class EGWBookNotFoundError extends S.TaggedError<EGWBookNotFoundError>()(
  'EGWBookNotFoundError',
  {
    bookCode: S.String,
    message: S.String,
  },
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class EGWPageNotFoundError extends S.TaggedError<EGWPageNotFoundError>()(
  'EGWPageNotFoundError',
  {
    bookCode: S.String,
    page: S.Number,
    message: S.String,
  },
  HttpApiSchema.annotations({ status: 404 }),
) {}

// ============================================================================
// Group Definition
// ============================================================================

export const EGWGroup = HttpApiGroup.make('EGW')
  .add(
    HttpApiEndpoint.get('books', '/books').addSuccess(
      S.Array(EGWBookInfoSchema),
    ),
  )
  .add(
    HttpApiEndpoint.get('page', '/:bookCode/:page')
      .setPath(
        S.Struct({
          bookCode: S.String,
          page: S.NumberFromString,
        }),
      )
      .addSuccess(EGWPageResponseSchema)
      .addError(EGWBookNotFoundError)
      .addError(EGWPageNotFoundError),
  )
  .add(
    HttpApiEndpoint.get('chapters', '/:bookCode/chapters')
      .setPath(
        S.Struct({
          bookCode: S.String,
        }),
      )
      .addSuccess(S.Array(EGWChapterSchema))
      .addError(EGWBookNotFoundError),
  )
  .add(
    HttpApiEndpoint.get('search', '/search')
      .setUrlParams(
        S.Struct({
          q: S.String,
          bookCode: S.optional(S.String),
          limit: S.optional(S.NumberFromString).pipe(
            S.withDecodingDefault(() => 50),
          ),
        }),
      )
      .addSuccess(S.Array(EGWSearchResultSchema)),
  )
  .prefix('/egw');
