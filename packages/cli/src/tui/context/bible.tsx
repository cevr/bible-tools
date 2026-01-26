// @effect-diagnostics strictBooleanExpressions:off strictEffectProvide:off
import { Effect } from 'effect';
import {
  createContext,
  createResource,
  useContext,
  type ParentProps,
  type Resource,
} from 'solid-js';

import { BibleData, BibleDataLive, type BibleDataService } from '../../data/bible/data.js';
import type { BibleDataSyncService } from '../../data/bible/types.js';
import { BibleState, BibleStateLive, type BibleStateService } from '../../data/bible/state.js';

// Combined services for the Bible viewer
interface BibleContextValue {
  ready: Resource<boolean>;
  isLoading: () => boolean;
  error: () => Error | undefined;
  data: BibleDataSyncService;
  state: BibleStateService;
}

const BibleContext = createContext<BibleContextValue>();

// Cache services at module level
let cachedDataService: BibleDataService | null = null;
let cachedStateService: BibleStateService | null = null;

async function initBibleServices(): Promise<{
  data: BibleDataService;
  state: BibleStateService;
}> {
  if (!cachedDataService) {
    // BibleDataLive includes BibleDatabase.Default which is scoped
    cachedDataService = await Effect.runPromise(
      Effect.scoped(Effect.provide(BibleData, BibleDataLive)),
    );
  }

  if (!cachedStateService) {
    // BibleStateLive is scoped - use Effect.scoped to properly manage lifecycle
    cachedStateService = await Effect.runPromise(
      Effect.scoped(Effect.provide(BibleState, BibleStateLive)),
    );
  }

  return {
    data: cachedDataService,
    state: cachedStateService,
  };
}

export function BibleProvider(props: ParentProps) {
  // Use createResource to load services in background
  const [services] = createResource(initBibleServices);

  // Create sync wrapper that runs Effects synchronously
  // This works because the database connection is already open after init
  const createSyncWrapper = (): BibleDataSyncService => {
    const svc = services();
    if (!svc) {
      // Return stub that returns empty results while loading
      return {
        getBooks: () => [],
        getBook: () => undefined,
        getChapter: () => [],
        getVerse: () => undefined,
        searchVerses: () => [],
        parseReference: () => undefined,
        getNextChapter: () => undefined,
        getPrevChapter: () => undefined,
      };
    }

    return {
      getBooks: () => Effect.runSync(svc.data.getBooks()),
      getBook: (n) => Effect.runSync(svc.data.getBook(n)),
      getChapter: (b, c) => Effect.runSync(svc.data.getChapter(b, c)),
      getVerse: (b, c, v) => Effect.runSync(svc.data.getVerse(b, c, v)),
      searchVerses: (q, l) => Effect.runSync(svc.data.searchVerses(q, l)),
      parseReference: (ref) => svc.data.parseReference(ref),
      getNextChapter: (b, c) => svc.data.getNextChapter(b, c),
      getPrevChapter: (b, c) => svc.data.getPrevChapter(b, c),
    };
  };

  const value: BibleContextValue = {
    ready: services as Resource<boolean>,
    isLoading: () => services.loading,
    error: () => services.error as Error | undefined,
    get data() {
      return createSyncWrapper();
    },
    get state() {
      const svc = services();
      if (!svc) {
        throw new Error('Bible services not initialized');
      }
      return svc.state;
    },
  };

  return <BibleContext.Provider value={value}>{props.children}</BibleContext.Provider>;
}

export function useBible(): BibleContextValue {
  const context = useContext(BibleContext);
  if (!context) {
    throw new Error('useBible must be used within a BibleProvider');
  }
  return context;
}

// Convenience hooks
export function useBibleData(): BibleDataSyncService {
  return useBible().data;
}

export function useBibleState(): BibleStateService {
  return useBible().state;
}
