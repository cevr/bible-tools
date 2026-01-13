/**
 * Search state machine for in-chapter text search.
 *
 * States:
 * - closed: Search box is closed, no active search
 * - closedWithQuery: Search box closed but query persists for highlighting
 * - open: Search box is open and active
 *
 * This eliminates impossible states like:
 * - currentMatchIndex > matches.length
 * - isActive=false but query has a value (now explicit with closedWithQuery)
 */

export interface SearchMatch {
  verse: number;
  startIndex: number;
  endIndex: number;
}

export type SearchState =
  | { _tag: 'closed' }
  | {
      _tag: 'closedWithQuery';
      query: string;
      matches: SearchMatch[];
      currentIndex: number;
    }
  | {
      _tag: 'open';
      query: string;
      matches: SearchMatch[];
      currentIndex: number;
    };

// State constructors
export const SearchState = {
  closed: (): SearchState => ({ _tag: 'closed' }),
  closedWithQuery: (
    query: string,
    matches: SearchMatch[],
    currentIndex: number,
  ): SearchState => ({
    _tag: 'closedWithQuery',
    query,
    matches,
    currentIndex: clampIndex(currentIndex, matches.length),
  }),
  open: (
    query: string,
    matches: SearchMatch[],
    currentIndex: number,
  ): SearchState => ({
    _tag: 'open',
    query,
    matches,
    currentIndex: clampIndex(currentIndex, matches.length),
  }),
} as const;

// Helper to ensure currentIndex is always valid
function clampIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

// Helper predicates and accessors
export function isSearchOpen(state: SearchState): boolean {
  return state._tag === 'open';
}

export function isSearchActive(state: SearchState): boolean {
  return state._tag !== 'closed';
}

export function getSearchQuery(state: SearchState): string {
  if (state._tag === 'closed') return '';
  return state.query;
}

export function getSearchMatches(state: SearchState): SearchMatch[] {
  if (state._tag === 'closed') return [];
  return state.matches;
}

export function getCurrentMatchIndex(state: SearchState): number {
  if (state._tag === 'closed') return 0;
  return state.currentIndex;
}

export function getCurrentMatch(state: SearchState): SearchMatch | null {
  if (state._tag === 'closed') return null;
  return state.matches[state.currentIndex] ?? null;
}

// Transition helpers
export function nextMatch(state: SearchState): SearchState {
  if (state._tag === 'closed' || state.matches.length === 0) return state;
  const nextIndex = (state.currentIndex + 1) % state.matches.length;
  return { ...state, currentIndex: nextIndex };
}

export function prevMatch(state: SearchState): SearchState {
  if (state._tag === 'closed' || state.matches.length === 0) return state;
  const prevIndex =
    (state.currentIndex - 1 + state.matches.length) % state.matches.length;
  return { ...state, currentIndex: prevIndex };
}

export function updateQuery(
  state: SearchState,
  query: string,
  matches: SearchMatch[],
): SearchState {
  if (state._tag === 'closed') return state;
  return {
    ...state,
    query,
    matches,
    currentIndex: clampIndex(0, matches.length),
  };
}

export function closeSearch(state: SearchState): SearchState {
  if (state._tag === 'closed') return state;
  if (state.query === '') return SearchState.closed();
  return SearchState.closedWithQuery(
    state.query,
    state.matches,
    state.currentIndex,
  );
}

export function openSearch(state: SearchState): SearchState {
  if (state._tag === 'open') return state;
  if (state._tag === 'closedWithQuery') {
    return SearchState.open(state.query, state.matches, state.currentIndex);
  }
  return SearchState.open('', [], 0);
}

export function clearSearch(): SearchState {
  return SearchState.closed();
}
