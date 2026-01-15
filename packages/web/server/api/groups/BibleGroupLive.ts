/**
 * BibleGroupLive - HTTP API handler implementations for Bible endpoints
 */
import { HttpApiBuilder } from '@effect/platform';
import { Effect, Option } from 'effect';

import {
  BibleToolsApi,
  BookNotFoundError,
  ChapterNotFoundError,
} from '@bible/api';

import { BibleService } from '../../services/BibleService.js';

export const BibleGroupLive = HttpApiBuilder.group(
  BibleToolsApi,
  'Bible',
  (handlers) =>
    Effect.gen(function* () {
      const bible = yield* BibleService;

      return handlers
        .handle('books', () => bible.getBooks())
        .handle('chapter', ({ path: { book, chapter } }) =>
          Effect.gen(function* () {
            // Get book info
            const bookInfo = yield* bible.getBook(book);
            if (Option.isNone(bookInfo)) {
              return yield* Effect.fail(
                new BookNotFoundError({
                  book,
                  message: `Book ${book} not found`,
                }),
              );
            }

            // Get chapter verses
            const verses = yield* bible.getChapter(book, chapter);
            if (verses.length === 0) {
              return yield* Effect.fail(
                new ChapterNotFoundError({
                  book,
                  chapter,
                  message: `Chapter ${book}:${chapter} not found`,
                }),
              );
            }

            // Get navigation hints
            const prevChapter = yield* bible.getPrevChapter(book, chapter);
            const nextChapter = yield* bible.getNextChapter(book, chapter);

            return {
              book: bookInfo.value,
              chapter,
              verses,
              prevChapter,
              nextChapter,
            };
          }),
        )
        .handle('search', ({ urlParams: { q, limit } }) =>
          bible.search(q, limit),
        );
    }),
);
