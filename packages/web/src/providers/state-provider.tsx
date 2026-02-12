/**
 * State hooks — backed by AppService (which wraps Effect runtime).
 *
 * Uses createCache for reads, manual invalidation for writes.
 */
import { createCache, useCache, type Cache } from '@/lib/cache';
import { useApp } from './db-provider';
import type { Position, Bookmark, HistoryEntry, Preferences } from '@/data/state/effect-service';
import type { Reference } from '@/data/bible/types';

export type { Position, Bookmark, HistoryEntry, Preferences };

// ---------------------------------------------------------------------------
// Caches — created once per app instance (singletons)
// ---------------------------------------------------------------------------

let positionCache: Cache<[], Position> | null = null;
let bookmarksCache: Cache<[], Bookmark[]> | null = null;
let historyCache: Cache<[], HistoryEntry[]> | null = null;
let preferencesCache: Cache<[], Preferences> | null = null;

function getPositionCache(app: ReturnType<typeof useApp>) {
  if (!positionCache) positionCache = createCache(() => app.getPosition());
  return positionCache;
}

function getBookmarksCache(app: ReturnType<typeof useApp>) {
  if (!bookmarksCache) bookmarksCache = createCache(() => app.getBookmarks());
  return bookmarksCache;
}

function getHistoryCache(app: ReturnType<typeof useApp>) {
  if (!historyCache) historyCache = createCache(() => app.getHistory());
  return historyCache;
}

function getPreferencesCache(app: ReturnType<typeof useApp>) {
  if (!preferencesCache) preferencesCache = createCache(() => app.getPreferences());
  return preferencesCache;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function usePosition() {
  const app = useApp();
  const cache = getPositionCache(app);
  const position = useCache(cache);

  return {
    position,
    async set(pos: Position) {
      await app.setPosition(pos);
      cache.invalidateAll();
    },
  };
}

export function useBookmarks() {
  const app = useApp();
  const cache = getBookmarksCache(app);
  const bookmarks = useCache(cache);

  return {
    bookmarks,
    async add(ref: Reference, note?: string) {
      const bm = await app.addBookmark(ref, note);
      cache.invalidateAll();
      return bm;
    },
    async remove(id: string) {
      await app.removeBookmark(id);
      cache.invalidateAll();
    },
  };
}

export function useHistory() {
  const app = useApp();
  const cache = getHistoryCache(app);
  const history = useCache(cache);

  return {
    history,
    async add(ref: Reference) {
      await app.addToHistory(ref);
      cache.invalidateAll();
    },
    async clear() {
      await app.clearHistory();
      cache.invalidateAll();
    },
  };
}

export function usePreferences() {
  const app = useApp();
  const cache = getPreferencesCache(app);
  const preferences = useCache(cache);

  return {
    preferences,
    async set(prefs: Partial<Preferences>) {
      await app.setPreferences(prefs);
      cache.invalidateAll();
    },
  };
}
