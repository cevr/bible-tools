import { createContext, useContext, createSignal, createMemo, type ParentProps } from 'solid-js';

import { useBibleData } from './bible.js';
import { useNavigation } from './navigation.js';

interface SearchMatch {
  verse: number;
  indices: Array<[number, number]>; // Start and end positions of matches in text
}

interface SearchContextValue {
  query: () => string;
  setQuery: (q: string) => void;
  isActive: () => boolean;
  setActive: (active: boolean) => void;
  matches: () => SearchMatch[];
  currentMatchIndex: () => number;
  totalMatches: () => number;
  nextMatch: () => void;
  prevMatch: () => void;
  clearSearch: () => void;
}

const SearchContext = createContext<SearchContextValue>();

export function SearchProvider(props: ParentProps) {
  const data = useBibleData();
  const { position, goToVerse } = useNavigation();

  const [query, setQuery] = createSignal('');
  const [isActive, setActive] = createSignal(false);
  const [currentMatchIndex, setCurrentMatchIndex] = createSignal(0);

  // Find all matches in current chapter
  const matches = createMemo(() => {
    const q = query().toLowerCase();
    if (!q || q.length < 2) return [];

    const verses = data.getChapter(position().book, position().chapter);
    const results: SearchMatch[] = [];

    for (const verse of verses) {
      const text = verse.text.toLowerCase();
      const indices: Array<[number, number]> = [];
      let pos = 0;

      while ((pos = text.indexOf(q, pos)) !== -1) {
        indices.push([pos, pos + q.length]);
        pos += 1;
      }

      if (indices.length > 0) {
        results.push({ verse: verse.verse, indices });
      }
    }

    return results;
  });

  const totalMatches = createMemo(() => {
    return matches().reduce((sum, m) => sum + m.indices.length, 0);
  });

  const nextMatch = () => {
    const m = matches();
    if (m.length === 0) return;

    const newIndex = (currentMatchIndex() + 1) % m.length;
    setCurrentMatchIndex(newIndex);

    // Navigate to the verse with this match
    const match = m[newIndex];
    if (match) {
      goToVerse(match.verse);
    }
  };

  const prevMatch = () => {
    const m = matches();
    if (m.length === 0) return;

    const newIndex = (currentMatchIndex() - 1 + m.length) % m.length;
    setCurrentMatchIndex(newIndex);

    // Navigate to the verse with this match
    const match = m[newIndex];
    if (match) {
      goToVerse(match.verse);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setActive(false);
    setCurrentMatchIndex(0);
  };

  // When activating search, optionally clear the query
  const activateSearch = (active: boolean) => {
    if (active) {
      // Clear query when opening fresh search
      setQuery('');
      setCurrentMatchIndex(0);
    }
    setActive(active);
  };

  // Reset match index when query changes
  const setQueryAndReset = (q: string) => {
    setQuery(q);
    setCurrentMatchIndex(0);
  };

  const value: SearchContextValue = {
    query,
    setQuery: setQueryAndReset,
    isActive,
    setActive: activateSearch,
    matches,
    currentMatchIndex,
    totalMatches,
    nextMatch,
    prevMatch,
    clearSearch,
  };

  return <SearchContext.Provider value={value}>{props.children}</SearchContext.Provider>;
}

export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return ctx;
}
