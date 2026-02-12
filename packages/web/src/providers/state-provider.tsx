/**
 * State Provider - Web application state management via Effect.
 *
 * Provides hooks backed by AppStateService (Effect) for position,
 * bookmarks, history, and preferences. All reads are async via runtime.
 */
import { createResource, type Resource } from 'solid-js';
import { Effect } from 'effect';
import { useRuntime } from './db-provider';
import {
  AppStateService,
  type Position,
  type Bookmark,
  type HistoryEntry,
  type Preferences,
} from '@/data/state/effect-service';
import type { Reference } from '@/data/bible/types';

// Re-export types for consumers
export type { Position, Bookmark, HistoryEntry, Preferences };

/**
 * Access application state — returns a promise-based interface matching the old API.
 * Must be called during component setup (captures runtime via context).
 */
export function useAppState() {
  const runtime = useRuntime();

  function run<A>(effect: Effect.Effect<A, unknown, AppStateService>): Promise<A> {
    return runtime.runPromise(effect as Effect.Effect<A, never, AppStateService>);
  }

  return {
    getPosition: () => run(Effect.flatMap(AppStateService, (s) => s.getPosition())),
    setPosition: (pos: Position) => run(Effect.flatMap(AppStateService, (s) => s.setPosition(pos))),
    getBookmarks: () => run(Effect.flatMap(AppStateService, (s) => s.getBookmarks())),
    addBookmark: (ref: Reference, note?: string) =>
      run(Effect.flatMap(AppStateService, (s) => s.addBookmark(ref, note))),
    removeBookmark: (id: string) =>
      run(Effect.flatMap(AppStateService, (s) => s.removeBookmark(id))),
    getHistory: (limit?: number) =>
      run(Effect.flatMap(AppStateService, (s) => s.getHistory(limit))),
    addToHistory: (ref: Reference) =>
      run(Effect.flatMap(AppStateService, (s) => s.addToHistory(ref))),
    clearHistory: () => run(Effect.flatMap(AppStateService, (s) => s.clearHistory())),
    getPreferences: () => run(Effect.flatMap(AppStateService, (s) => s.getPreferences())),
    setPreferences: (prefs: Partial<Preferences>) =>
      run(Effect.flatMap(AppStateService, (s) => s.setPreferences(prefs))),
  };
}

// Convenience hooks with createResource-backed reactivity

export function usePosition() {
  const state = useAppState();
  const [position, { refetch }] = createResource(() => state.getPosition());

  return {
    position: position as Resource<Position>,
    async set(pos: Position) {
      await state.setPosition(pos);
      refetch();
    },
  };
}

export function useBookmarks() {
  const state = useAppState();
  const [bookmarks, { refetch }] = createResource(() => state.getBookmarks());

  return {
    bookmarks: bookmarks as Resource<Bookmark[]>,
    async add(ref: { book: number; chapter: number; verse?: number }, note?: string) {
      const b = await state.addBookmark(ref, note);
      refetch();
      return b;
    },
    async remove(id: string) {
      await state.removeBookmark(id);
      refetch();
    },
  };
}

export function useHistory() {
  const state = useAppState();
  const [history, { refetch }] = createResource(() => state.getHistory());

  return {
    history: history as Resource<HistoryEntry[]>,
    async add(ref: { book: number; chapter: number; verse?: number }) {
      await state.addToHistory(ref);
      refetch();
    },
    async clear() {
      await state.clearHistory();
      refetch();
    },
  };
}

export function usePreferences() {
  const state = useAppState();
  const [prefs, { refetch }] = createResource(() => state.getPreferences());

  return {
    preferences: prefs as Resource<Preferences>,
    async set(p: Partial<Preferences>) {
      await state.setPreferences(p);
      refetch();
    },
  };
}
