/**
 * EGW Commentary Service
 *
 * Provides commentary lookup by Bible verse from the EGW Bible Commentary volumes (BC1-BC7).
 * Uses the indexed paragraph_bible_refs table for fast O(1) lookups.
 */

import { Data, Effect } from 'effect';

import { EGWParagraphDatabase } from '../egw-db/book-database.js';
import type * as EGWSchemas from '../egw/schemas.js';
import type {
  CommentaryEntry,
  CommentaryResult,
  VerseReference,
} from './types.js';

/**
 * Error types for the commentary service
 */
export class CommentaryError extends Data.TaggedError('CommentaryError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Union of all commentary errors
 */
export type CommentaryServiceError = CommentaryError;

/**
 * Convert EGW paragraph to commentary entry
 */
function paragraphToEntry(
  para: EGWSchemas.Paragraph,
  bookCode: string,
  bookTitle: string,
): CommentaryEntry {
  return {
    refcode: para.refcode_short ?? para.refcode_long ?? '',
    bookCode,
    bookTitle,
    content: para.content ?? '',
    puborder: para.puborder,
  };
}

/**
 * EGW Commentary Service
 *
 * Provides commentary lookup from EGW Bible Commentary volumes.
 */
export class EGWCommentaryService extends Effect.Service<EGWCommentaryService>()(
  'egw-commentary/EGWCommentaryService',
  {
    effect: Effect.gen(function* () {
      const db = yield* EGWParagraphDatabase;

      /**
       * Get commentary for a specific Bible verse
       *
       * Uses the indexed paragraph_bible_refs table for fast O(1) lookup
       * instead of streaming through all paragraphs.
       */
      const getCommentary = (
        verse: VerseReference,
      ): Effect.Effect<CommentaryResult, CommentaryServiceError> =>
        db
          .getParagraphsByBibleRef(verse.book, verse.chapter, verse.verse)
          .pipe(
            Effect.map((paragraphs) => ({
              verse,
              entries: paragraphs.map((para) =>
                paragraphToEntry(para, para.bookCode, para.bookTitle),
              ),
            })),
            Effect.mapError(
              (e) =>
                new CommentaryError({
                  message: 'Failed to get commentary',
                  cause: e,
                }),
            ),
          );

      /**
       * Search commentary by text query
       *
       * Uses FTS5 full-text search for efficient text matching.
       */
      const searchCommentary = (
        query: string,
        limit: number = 20,
      ): Effect.Effect<readonly CommentaryEntry[], CommentaryServiceError> =>
        db.searchParagraphs(query, limit).pipe(
          Effect.map((paragraphs) =>
            // Filter to BC volumes only
            paragraphs
              .filter((para) => {
                const refcode = para.refcode_short ?? para.refcode_long ?? '';
                return /^[1-7]BC/i.test(refcode);
              })
              .map((para) => {
                const refcode = para.refcode_short ?? para.refcode_long ?? '';
                const bcVolume = refcode.substring(0, 3).toUpperCase();
                return paragraphToEntry(
                  para,
                  bcVolume,
                  `Bible Commentary Volume ${bcVolume.charAt(0)}`,
                );
              }),
          ),
          Effect.mapError(
            (e) =>
              new CommentaryError({
                message: 'Failed to search commentary',
                cause: e,
              }),
          ),
        );

      return {
        getCommentary,
        searchCommentary,
      } as const;
    }),
    dependencies: [EGWParagraphDatabase.Default],
  },
) {}
