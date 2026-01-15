/**
 * EGWGroupLive - HTTP API handler implementations for EGW endpoints
 */
import { HttpApiBuilder } from '@effect/platform';
import { Effect, Option } from 'effect';

import {
  BibleToolsApi,
  EGWBookNotFoundError,
  EGWPageNotFoundError,
} from '@bible/api';

import { EGWService } from '../../services/EGWService.js';

export const EGWGroupLive = HttpApiBuilder.group(
  BibleToolsApi,
  'EGW',
  (handlers) =>
    Effect.gen(function* () {
      const egw = yield* EGWService;

      return handlers
        .handle('books', () =>
          egw.getBooks().pipe(Effect.orDie),
        )
        .handle('page', ({ path: { bookCode, page } }) =>
          Effect.gen(function* () {
            // Check if book exists
            const bookOpt = yield* egw.getBook(bookCode).pipe(Effect.orDie);
            if (Option.isNone(bookOpt)) {
              return yield* Effect.fail(
                new EGWBookNotFoundError({
                  bookCode,
                  message: `Book '${bookCode}' not found`,
                }),
              );
            }

            // Get page
            const pageData = yield* egw.getPage(bookCode, page).pipe(Effect.orDie);
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
            const bookOpt = yield* egw.getBook(bookCode).pipe(Effect.orDie);
            if (Option.isNone(bookOpt)) {
              return yield* Effect.fail(
                new EGWBookNotFoundError({
                  bookCode,
                  message: `Book '${bookCode}' not found`,
                }),
              );
            }

            return yield* egw.getChapters(bookCode).pipe(Effect.orDie);
          }),
        )
        .handle('search', ({ urlParams: { q, limit, bookCode } }) =>
          egw.search(q, limit, bookCode).pipe(Effect.orDie),
        );
    }),
);
