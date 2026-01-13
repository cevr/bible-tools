/**
 * EGW Context
 *
 * Provides access to the EGW Reader service from core.
 * Wraps the Effect service for use in Solid.js components.
 */

import { EGWParagraphDatabase } from '@bible/core/egw-db';
import {
  EGWReaderService,
  type EGWBookInfo,
  type EGWParagraph,
  type EGWReaderPosition,
} from '@bible/core/egw-reader';
import { BunContext } from '@effect/platform-bun';
import { Effect, Layer } from 'effect';
import { createContext, useContext, type ParentProps } from 'solid-js';

// Re-export types for convenience
export type { EGWBookInfo, EGWParagraph, EGWReaderPosition };

interface EGWContextValue {
  getBooks: () => Promise<readonly EGWBookInfo[]>;
  getBookByCode: (bookCode: string) => Promise<EGWBookInfo | undefined>;
  getParagraphsByBookCode: (
    bookCode: string,
  ) => Promise<readonly EGWParagraph[]>;
  searchParagraphs: (
    query: string,
    limit?: number,
  ) => Promise<readonly EGWParagraph[]>;
}

const EGWContext = createContext<EGWContextValue>();

// Create combined layer with all dependencies
// BunContext provides FileSystem and Path needed by EGWParagraphDatabase
// EGWParagraphDatabase is needed by EGWReaderService
const EGWServicesLayer = EGWReaderService.Default.pipe(
  Layer.provideMerge(EGWParagraphDatabase.Default),
  Layer.provideMerge(BunContext.layer),
);

// Create service layer
function createEGWService(): EGWContextValue {
  const runService = <A, E>(
    effect: Effect.Effect<A, E, EGWReaderService>,
  ): Promise<A> =>
    Effect.runPromise(
      effect.pipe(Effect.provide(EGWServicesLayer), Effect.scoped),
    );

  return {
    getBooks: () =>
      runService(
        Effect.gen(function* () {
          const service = yield* EGWReaderService;
          return yield* service.getBooks();
        }),
      ),

    getBookByCode: (bookCode: string) =>
      runService(
        Effect.gen(function* () {
          const service = yield* EGWReaderService;
          const optBook = yield* service.getBookByCode(bookCode);
          return optBook._tag === 'Some' ? optBook.value : undefined;
        }),
      ),

    getParagraphsByBookCode: (bookCode: string) =>
      runService(
        Effect.gen(function* () {
          const service = yield* EGWReaderService;
          return yield* service.getParagraphsByBookCode(bookCode);
        }),
      ),

    searchParagraphs: (query: string, limit = 50) =>
      runService(
        Effect.gen(function* () {
          const service = yield* EGWReaderService;
          return yield* service.searchParagraphs(query, limit);
        }),
      ),
  };
}

// Cache service at module level
let cachedService: EGWContextValue | null = null;

function getService(): EGWContextValue {
  if (!cachedService) {
    cachedService = createEGWService();
  }
  return cachedService;
}

export function EGWProvider(props: ParentProps) {
  const value = getService();
  return (
    <EGWContext.Provider value={value}>{props.children}</EGWContext.Provider>
  );
}

export function useEGW(): EGWContextValue {
  const context = useContext(EGWContext);
  if (!context) {
    throw new Error('useEGW must be used within an EGWProvider');
  }
  return context;
}
