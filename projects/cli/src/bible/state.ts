import { Context, Effect, Layer } from 'effect';
import { Database } from 'bun:sqlite';
import { homedir } from 'os';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

import type { Bookmark, HistoryEntry, Position, Preferences, Reference } from './types.js';

// State storage directory
const STATE_DIR = join(homedir(), '.bible-tools');
const DB_PATH = join(STATE_DIR, 'state.db');

// Ensure state directory exists
function ensureStateDir() {
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }
}

// Initialize database with schema
function initDatabase(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS position (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      book INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      book INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER,
      note TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER,
      visited_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS preferences (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      theme TEXT NOT NULL DEFAULT 'system',
      display_mode TEXT NOT NULL DEFAULT 'verse'
    );

    CREATE TABLE IF NOT EXISTS ai_search_cache (
      query TEXT PRIMARY KEY,
      results TEXT NOT NULL,
      cached_at INTEGER NOT NULL
    );

    -- Initialize default position if not exists
    INSERT OR IGNORE INTO position (id, book, chapter, verse) VALUES (1, 1, 1, 1);

    -- Initialize default preferences if not exists
    INSERT OR IGNORE INTO preferences (id, theme, display_mode) VALUES (1, 'system', 'verse');

    -- Create index for history queries
    CREATE INDEX IF NOT EXISTS idx_history_visited_at ON history(visited_at DESC);
  `);
}

// Service interface
export interface BibleStateService {
  readonly getLastPosition: () => Position;
  readonly setLastPosition: (pos: Position) => void;
  readonly getBookmarks: () => Bookmark[];
  readonly addBookmark: (ref: Reference, note?: string) => Bookmark;
  readonly removeBookmark: (id: string) => void;
  readonly getHistory: (limit?: number) => HistoryEntry[];
  readonly addToHistory: (ref: Reference) => void;
  readonly clearHistory: () => void;
  readonly getPreferences: () => Preferences;
  readonly setPreferences: (prefs: Partial<Preferences>) => void;
  readonly getCachedAISearch: (query: string) => Reference[] | undefined;
  readonly setCachedAISearch: (query: string, results: Reference[]) => void;
  readonly close: () => void;
}

// Effect service tag
export class BibleState extends Context.Tag('BibleState')<BibleState, BibleStateService>() {}

// Create the service implementation
function createBibleStateService(): BibleStateService {
  ensureStateDir();
  const db = new Database(DB_PATH);
  initDatabase(db);

  // Prepare statements for performance
  const getPositionStmt = db.prepare<Position, []>('SELECT book, chapter, verse FROM position WHERE id = 1');
  const setPositionStmt = db.prepare('UPDATE position SET book = ?, chapter = ?, verse = ? WHERE id = 1');

  const getBookmarksStmt = db.prepare<
    { id: string; book: number; chapter: number; verse: number | null; note: string | null; created_at: number },
    []
  >('SELECT id, book, chapter, verse, note, created_at FROM bookmarks ORDER BY created_at DESC');
  const addBookmarkStmt = db.prepare('INSERT INTO bookmarks (id, book, chapter, verse, note, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  const removeBookmarkStmt = db.prepare('DELETE FROM bookmarks WHERE id = ?');

  const getHistoryStmt = db.prepare<
    { book: number; chapter: number; verse: number | null; visited_at: number },
    [number]
  >('SELECT book, chapter, verse, visited_at FROM history ORDER BY visited_at DESC LIMIT ?');
  const addHistoryStmt = db.prepare('INSERT INTO history (book, chapter, verse, visited_at) VALUES (?, ?, ?, ?)');
  const clearHistoryStmt = db.prepare('DELETE FROM history');

  const getPreferencesStmt = db.prepare<{ theme: string; display_mode: string }, []>(
    'SELECT theme, display_mode FROM preferences WHERE id = 1'
  );
  const setPreferencesStmt = db.prepare('UPDATE preferences SET theme = ?, display_mode = ? WHERE id = 1');

  const getCacheStmt = db.prepare<{ results: string; cached_at: number }, [string]>(
    'SELECT results, cached_at FROM ai_search_cache WHERE query = ?'
  );
  const setCacheStmt = db.prepare(
    'INSERT OR REPLACE INTO ai_search_cache (query, results, cached_at) VALUES (?, ?, ?)'
  );

  // Cache expiry: 24 hours
  const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;

  return {
    getLastPosition(): Position {
      const row = getPositionStmt.get();
      return row ?? { book: 1, chapter: 1, verse: 1 };
    },

    setLastPosition(pos: Position): void {
      setPositionStmt.run(pos.book, pos.chapter, pos.verse);
    },

    getBookmarks(): Bookmark[] {
      const rows = getBookmarksStmt.all();
      return rows.map((row) => ({
        id: row.id,
        reference: {
          book: row.book,
          chapter: row.chapter,
          verse: row.verse ?? undefined,
        },
        note: row.note ?? undefined,
        createdAt: row.created_at,
      }));
    },

    addBookmark(ref: Reference, note?: string): Bookmark {
      const id = crypto.randomUUID();
      const createdAt = Date.now();
      addBookmarkStmt.run(id, ref.book, ref.chapter, ref.verse ?? null, note ?? null, createdAt);
      return {
        id,
        reference: ref,
        note,
        createdAt,
      };
    },

    removeBookmark(id: string): void {
      removeBookmarkStmt.run(id);
    },

    getHistory(limit = 100): HistoryEntry[] {
      const rows = getHistoryStmt.all(limit);
      return rows.map((row) => ({
        reference: {
          book: row.book,
          chapter: row.chapter,
          verse: row.verse ?? undefined,
        },
        visitedAt: row.visited_at,
      }));
    },

    addToHistory(ref: Reference): void {
      addHistoryStmt.run(ref.book, ref.chapter, ref.verse ?? null, Date.now());
    },

    clearHistory(): void {
      clearHistoryStmt.run();
    },

    getPreferences(): Preferences {
      const row = getPreferencesStmt.get();
      return {
        theme: row?.theme ?? 'system',
        displayMode: (row?.display_mode as 'verse' | 'paragraph') ?? 'verse',
      };
    },

    setPreferences(prefs: Partial<Preferences>): void {
      const current = this.getPreferences();
      setPreferencesStmt.run(prefs.theme ?? current.theme, prefs.displayMode ?? current.displayMode);
    },

    getCachedAISearch(query: string): Reference[] | undefined {
      const row = getCacheStmt.get(query.toLowerCase().trim());
      if (!row) return undefined;

      // Check if cache is expired
      if (Date.now() - row.cached_at > CACHE_EXPIRY_MS) {
        return undefined;
      }

      try {
        return JSON.parse(row.results) as Reference[];
      } catch {
        return undefined;
      }
    },

    setCachedAISearch(query: string, results: Reference[]): void {
      setCacheStmt.run(query.toLowerCase().trim(), JSON.stringify(results), Date.now());
    },

    close(): void {
      db.close();
    },
  };
}

// Live layer
export const BibleStateLive = Layer.scoped(
  BibleState,
  Effect.acquireRelease(
    Effect.sync(() => createBibleStateService()),
    (service) => Effect.sync(() => service.close())
  )
);

// Simpler non-scoped layer for TUI usage (manages its own lifecycle)
export const BibleStateLayer = Layer.succeed(BibleState, createBibleStateService());
