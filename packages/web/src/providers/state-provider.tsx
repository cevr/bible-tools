/**
 * State Provider - Web application state management.
 *
 * Provides localStorage-backed state for position, bookmarks, history,
 * and preferences. Similar to CLI's BibleState but browser-based.
 */
import { createContext, useContext, type ParentComponent } from 'solid-js';

import { createLocalStorageState, type LocalStorageState } from '@/data/state/local-storage';

const StateContext = createContext<LocalStorageState>();

// Create singleton instance
const stateService = createLocalStorageState();

/**
 * Provider for application state.
 *
 * Wraps the app to provide access to localStorage-backed state.
 */
export const StateProvider: ParentComponent = (props) => {
  return <StateContext.Provider value={stateService}>{props.children}</StateContext.Provider>;
};

/**
 * Access application state (position, bookmarks, history, preferences).
 */
export function useAppState(): LocalStorageState {
  const ctx = useContext(StateContext);
  if (!ctx) {
    throw new Error('useAppState must be used within a StateProvider');
  }
  return ctx;
}

// Convenience hooks
export function usePosition() {
  const state = useAppState();
  return {
    get: state.getPosition,
    set: state.setPosition,
  };
}

export function useBookmarks() {
  const state = useAppState();
  return {
    getAll: state.getBookmarks,
    add: state.addBookmark,
    remove: state.removeBookmark,
  };
}

export function useHistory() {
  const state = useAppState();
  return {
    getAll: state.getHistory,
    add: state.addToHistory,
    clear: state.clearHistory,
  };
}

export function usePreferences() {
  const state = useAppState();
  return {
    get: state.getPreferences,
    set: state.setPreferences,
  };
}
