/**
 * LocalStorage-based state persistence for the web application.
 *
 * Mirrors the CLI's BibleState interface for position, bookmarks, and history.
 * Uses localStorage for persistence across sessions.
 */

import type { Reference } from '../bible/types.js';

// Storage keys
const STORAGE_KEYS = {
  position: 'bible-position',
  bookmarks: 'bible-bookmarks',
  history: 'bible-history',
  preferences: 'bible-preferences',
} as const;

// Default values
const DEFAULT_POSITION: Position = { book: 1, chapter: 1, verse: 1 };
const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  displayMode: 'verse',
};

// Types
export interface Position {
  book: number;
  chapter: number;
  verse: number;
}

export interface Bookmark {
  id: string;
  reference: Reference;
  note?: string;
  createdAt: number;
}

export interface HistoryEntry {
  reference: Reference;
  visitedAt: number;
}

export interface Preferences {
  theme: 'light' | 'dark' | 'system';
  displayMode: 'verse' | 'paragraph';
}

// Helpers
function safeJsonParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function safeLocalStorage<T>(operation: () => T, fallback: T): T {
  try {
    return operation();
  } catch {
    // localStorage may be unavailable in SSR or private browsing
    return fallback;
  }
}

/**
 * Local storage state service.
 *
 * Similar interface to CLI's BibleState but backed by localStorage.
 */
export interface LocalStorageState {
  readonly getPosition: () => Position;
  readonly setPosition: (pos: Position) => void;
  readonly getBookmarks: () => Bookmark[];
  readonly addBookmark: (ref: Reference, note?: string) => Bookmark;
  readonly removeBookmark: (id: string) => void;
  readonly getHistory: (limit?: number) => HistoryEntry[];
  readonly addToHistory: (ref: Reference) => void;
  readonly clearHistory: () => void;
  readonly getPreferences: () => Preferences;
  readonly setPreferences: (prefs: Partial<Preferences>) => void;
}

/**
 * Create a localStorage-backed state service.
 */
export function createLocalStorageState(): LocalStorageState {
  return {
    getPosition(): Position {
      return safeLocalStorage(() => {
        const stored = localStorage.getItem(STORAGE_KEYS.position);
        return safeJsonParse(stored, DEFAULT_POSITION);
      }, DEFAULT_POSITION);
    },

    setPosition(pos: Position): void {
      safeLocalStorage(() => {
        localStorage.setItem(STORAGE_KEYS.position, JSON.stringify(pos));
      }, undefined);
    },

    getBookmarks(): Bookmark[] {
      return safeLocalStorage(() => {
        const stored = localStorage.getItem(STORAGE_KEYS.bookmarks);
        return safeJsonParse<Bookmark[]>(stored, []);
      }, []);
    },

    addBookmark(ref: Reference, note?: string): Bookmark {
      const bookmark: Bookmark = {
        id: crypto.randomUUID(),
        reference: ref,
        note,
        createdAt: Date.now(),
      };

      safeLocalStorage(() => {
        const bookmarks = this.getBookmarks();
        bookmarks.unshift(bookmark);
        localStorage.setItem(STORAGE_KEYS.bookmarks, JSON.stringify(bookmarks));
      }, undefined);

      return bookmark;
    },

    removeBookmark(id: string): void {
      safeLocalStorage(() => {
        const bookmarks = this.getBookmarks().filter((b) => b.id !== id);
        localStorage.setItem(STORAGE_KEYS.bookmarks, JSON.stringify(bookmarks));
      }, undefined);
    },

    getHistory(limit = 100): HistoryEntry[] {
      return safeLocalStorage(() => {
        const stored = localStorage.getItem(STORAGE_KEYS.history);
        const history = safeJsonParse<HistoryEntry[]>(stored, []);
        return history.slice(0, limit);
      }, []);
    },

    addToHistory(ref: Reference): void {
      safeLocalStorage(() => {
        const history = this.getHistory();
        const entry: HistoryEntry = {
          reference: ref,
          visitedAt: Date.now(),
        };
        // Add to front, limit to 100 entries
        history.unshift(entry);
        if (history.length > 100) {
          history.pop();
        }
        localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
      }, undefined);
    },

    clearHistory(): void {
      safeLocalStorage(() => {
        localStorage.removeItem(STORAGE_KEYS.history);
      }, undefined);
    },

    getPreferences(): Preferences {
      return safeLocalStorage(() => {
        const stored = localStorage.getItem(STORAGE_KEYS.preferences);
        return safeJsonParse(stored, DEFAULT_PREFERENCES);
      }, DEFAULT_PREFERENCES);
    },

    setPreferences(prefs: Partial<Preferences>): void {
      safeLocalStorage(() => {
        const current = this.getPreferences();
        const updated = { ...current, ...prefs };
        localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify(updated));
      }, undefined);
    },
  };
}
