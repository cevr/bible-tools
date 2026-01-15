/**
 * EGWGroupLive - HTTP API handler implementations for EGW endpoints
 */
import { HttpApiBuilder } from '@effect/platform';
import { Effect, Option } from 'effect';

import {
  BibleToolsApi,
  EGWBookNotFoundError,
  EGWDatabaseError,
  EGWPageNotFoundError,
} from '@bible/api';

import { EGWService } from '../../services/EGWService.js';

/**
 * Map database errors to API EGWDatabaseError
 */
const mapDbError = Effect.mapError(
  (e: unknown) =>
    new EGWDatabaseError({
      message: e instanceof Error ? e.message : 'Database error',
    }),
);

export const EGWGroupLive = HttpApiBuilder.group(
  BibleToolsApi,
  'EGW',
  (handlers) =>
    Effect.gen(function* () {
      const egw = yield* EGWService;

      return handlers
        .handle('books', () =>
          egw.getBooks().pipe(mapDbError),
        )
        .handle('page', ({ path: { bookCode, page } }) =>
          Effect.gen(function* () {
            // Check if book exists
            const bookOpt = yield* egw.getBook(bookCode).pipe(mapDbError);
            if (Option.isNone(bookOpt)) {
              return yield* Effect.fail(
                new EGWBookNotFoundError({
                  bookCode,
                  message: `Book '${bookCode}' not found`,
                }),
              );
            }

            // Get page
            const pageData = yield* egw.getPage(bookCode, page).pipe(mapDbError);
            if (!pageData) {
              return yield* Effect.fail(
                new EGWPageNotFoundError({
                  bookCode,
                  page,
                  message: `Page ${page} not found in '${bookCode}'`,
                }),
              );
            }

            return pageData;
          }),
        )
        .handle('chapters', ({ path: { bookCode } }) =>
          Effect.gen(function* () {
            // Check if book exists
            const bookOpt = yield* egw.getBook(bookCode).pipe(mapDbError);
            if (Option.isNone(bookOpt)) {
              return yield* Effect.fail(
                new EGWBookNotFoundError({
                  bookCode,
                  message: `Book '${bookCode}' not found`,
                }),
              );
            }

            return yield* egw.getChapters(bookCode).pipe(mapDbError);
          }),
        )
        .handle('search', ({ urlParams: { q, limit, bookCode } }) =>
          egw.search(q, limit, bookCode).pipe(mapDbError),
        );
    }),
);
