/**
 * Bible API Group - Endpoints for Bible data access
 *
 * Provides typed endpoints for:
 * - Listing all books
 * - Getting a chapter with verses
 * - Searching verses
 */
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform';
import { Schema as S } from 'effect';

// ============================================================================
// Schemas
// ============================================================================

export const BookSchema = S.Struct({
  number: S.Number,
  name: S.String,
  chapters: S.Number,
  testament: S.Literal('old', 'new'),
});

export type Book = S.Schema.Type<typeof BookSchema>;

export const VerseSchema = S.Struct({
  book: S.Number,
  chapter: S.Number,
  verse: S.Number,
  text: S.String,
});

export type Verse = S.Schema.Type<typeof VerseSchema>;

export const ChapterReferenceSchema = S.Struct({
  book: S.Number,
  chapter: S.Number,
});

export type ChapterReference = S.Schema.Type<typeof ChapterReferenceSchema>;

export const ChapterResponseSchema = S.Struct({
  book: BookSchema,
  chapter: S.Number,
  verses: S.Array(VerseSchema),
  // Adjacent chapters for prefetch hints
  prevChapter: S.NullOr(ChapterReferenceSchema),
  nextChapter: S.NullOr(ChapterReferenceSchema),
});

export type ChapterResponse = S.Schema.Type<typeof ChapterResponseSchema>;

export const SearchResultSchema = S.Struct({
  book: S.Number,
  bookName: S.String,
  chapter: S.Number,
  verse: S.Number,
  text: S.String,
});

export type SearchResult = S.Schema.Type<typeof SearchResultSchema>;

// ============================================================================
// Errors
// ============================================================================

export class ChapterNotFoundError extends S.TaggedError<ChapterNotFoundError>()(
  'ChapterNotFoundError',
  {
    book: S.Number,
    chapter: S.Number,
    message: S.String,
  },
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class BookNotFoundError extends S.TaggedError<BookNotFoundError>()(
  'BookNotFoundError',
  {
    book: S.Number,
    message: S.String,
  },
  HttpApiSchema.annotations({ status: 404 }),
) {}

// ============================================================================
// Group Definition
// ============================================================================

export const BibleGroup = HttpApiGroup.make('Bible')
  .add(
    HttpApiEndpoint.get('books', '/books').addSuccess(S.Array(BookSchema)),
  )
  .add(
    HttpApiEndpoint.get('chapter', '/:book/:chapter')
      .setPath(
        S.Struct({
          book: S.NumberFromString,
          chapter: S.NumberFromString,
        }),
      )
      .addSuccess(ChapterResponseSchema)
      .addError(ChapterNotFoundError)
      .addError(BookNotFoundError),
  )
  .add(
    HttpApiEndpoint.get('search', '/search')
      .setUrlParams(
        S.Struct({
          q: S.String,
          limit: S.optional(S.NumberFromString).pipe(
            S.withDecodingDefault(() => 20),
          ),
        }),
      )
      .addSuccess(S.Array(SearchResultSchema)),
  )
  .prefix('/bible');
