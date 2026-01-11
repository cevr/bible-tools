import { createContext, useContext, type ParentProps } from 'solid-js';
import { Effect } from 'effect';

import { BibleData, BibleDataLive, type BibleDataService } from '../../bible/data.js';
import { BibleState, BibleStateLayer, type BibleStateService } from '../../bible/state.js';

// Combined services for the Bible viewer
interface BibleContextValue {
  data: BibleDataService;
  state: BibleStateService;
}

const BibleContext = createContext<BibleContextValue>();

// Create services synchronously
function createServices(): BibleContextValue {
  // Access the service implementations directly from the layers
  const dataService = Effect.runSync(
    Effect.provide(BibleData, BibleDataLive)
  );

  const stateService = Effect.runSync(
    Effect.provide(BibleState, BibleStateLayer)
  );

  return {
    data: dataService,
    state: stateService,
  };
}

// Cache services at module level
let cachedServices: BibleContextValue | null = null;

function getServices(): BibleContextValue {
  if (!cachedServices) {
    cachedServices = createServices();
  }
  return cachedServices;
}

export function BibleProvider(props: ParentProps) {
  const value = getServices();

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
export function useBibleData(): BibleDataService {
  return useBible().data;
}

export function useBibleState(): BibleStateService {
  return useBible().state;
}
