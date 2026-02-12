/**
 * SQLite Web Worker
 *
 * Runs wa-sqlite with OPFSCoopSyncVFS for persistent local-first storage.
 * Manages two databases:
 *   - bible.db (read-only, downloaded from server on first visit)
 *   - state.db (read-write, user data — position, bookmarks, etc.)
 */
import * as SQLite from 'wa-sqlite';
import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite.mjs';
import { OPFSCoopSyncVFS } from 'wa-sqlite/src/examples/OPFSCoopSyncVFS.js';

import type { WorkerRequest, WorkerResponse } from './db-protocol.js';

let sqlite3: SQLiteAPI;
let bibleDb: number;
let stateDb: number;
let dirty = false;

function post(msg: WorkerResponse) {
  self.postMessage(msg);
}

const STATE_SCHEMA = `
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

  INSERT OR IGNORE INTO position (id, book, chapter, verse) VALUES (1, 1, 1, 1);
  INSERT OR IGNORE INTO preferences (id, theme, display_mode) VALUES (1, 'system', 'verse');

  CREATE INDEX IF NOT EXISTS idx_history_visited_at ON history(visited_at DESC);

  CREATE TABLE IF NOT EXISTS cross_ref_classifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_book INTEGER NOT NULL,
    source_chapter INTEGER NOT NULL,
    source_verse INTEGER NOT NULL,
    ref_book INTEGER NOT NULL,
    ref_chapter INTEGER NOT NULL,
    ref_verse INTEGER,
    ref_verse_end INTEGER,
    type TEXT NOT NULL,
    confidence REAL,
    classified_at INTEGER NOT NULL,
    UNIQUE(source_book, source_chapter, source_verse, ref_book, ref_chapter, COALESCE(ref_verse, 0))
  );

  CREATE INDEX IF NOT EXISTS idx_classifications_source
    ON cross_ref_classifications(source_book, source_chapter, source_verse);

  CREATE TABLE IF NOT EXISTS user_cross_refs (
    id TEXT PRIMARY KEY,
    source_book INTEGER NOT NULL,
    source_chapter INTEGER NOT NULL,
    source_verse INTEGER NOT NULL,
    ref_book INTEGER NOT NULL,
    ref_chapter INTEGER NOT NULL,
    ref_verse INTEGER,
    ref_verse_end INTEGER,
    type TEXT,
    note TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_user_cross_refs_source
    ON user_cross_refs(source_book, source_chapter, source_verse);

  CREATE TABLE IF NOT EXISTS sync_meta (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    device_id TEXT NOT NULL,
    last_synced_at INTEGER
  );
`;

async function execQuery(
  db: number,
  sql: string,
  params?: unknown[],
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for await (const stmt of sqlite3.statements(db, sql)) {
    if (params?.length) {
      sqlite3.bind_collection(stmt, params as (SQLiteCompatibleType | null)[]);
    }
    const columns = sqlite3.column_names(stmt);
    // eslint-disable-next-line no-await-in-loop -- sequential SQLite iteration
    while ((await sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
      const row: Record<string, unknown> = {};
      const values = sqlite3.row(stmt);
      for (let i = 0; i < columns.length; i++) {
        row[columns[i]] = values[i];
      }
      rows.push(row);
    }
  }
  return rows;
}

async function execWrite(db: number, sql: string, params?: unknown[]): Promise<number> {
  for await (const stmt of sqlite3.statements(db, sql)) {
    if (params?.length) {
      sqlite3.bind_collection(stmt, params as (SQLiteCompatibleType | null)[]);
    }
    await sqlite3.step(stmt);
  }
  return sqlite3.changes(db);
}

async function checkBibleDbExists(): Promise<boolean> {
  try {
    const rows = await execQuery(bibleDb, 'SELECT COUNT(*) as cnt FROM books');
    return (rows[0]?.cnt as number) > 0;
  } catch {
    return false;
  }
}

async function downloadBibleDb(): Promise<void> {
  post({ type: 'init-progress', stage: 'Downloading Bible database...', progress: 0 });

  const response = await fetch('/api/db/bible');
  if (!response.ok) {
    throw new Error(`Failed to download bible.db: ${response.statusText}`);
  }
  if (!response.body) {
    throw new Error('No response body for bible.db download');
  }

  await sqlite3.close(bibleDb);

  const contentLength = Number(response.headers.get('Content-Length') ?? 0);
  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle('bible.db', { create: true });
  const writable = await fileHandle.createWritable();

  const reader = response.body.getReader();
  let received = 0;

  /* eslint-disable no-await-in-loop -- sequential stream read */
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    await writable.write(value);
    received += value.byteLength;
    if (contentLength > 0) {
      post({
        type: 'init-progress',
        stage: 'Downloading Bible database...',
        progress: Math.round((received / contentLength) * 100),
      });
    }
  }
  /* eslint-enable no-await-in-loop */

  await writable.close();

  // Reopen as readonly
  bibleDb = await sqlite3.open_v2('bible.db', SQLite.SQLITE_OPEN_READONLY, 'opfs-coop-sync');
}

async function init(): Promise<void> {
  try {
    post({ type: 'init-progress', stage: 'Loading SQLite...', progress: 0 });

    const module = await SQLiteESMFactory();
    sqlite3 = SQLite.Factory(module);

    const vfs = await OPFSCoopSyncVFS.create('opfs-coop-sync', module);
    sqlite3.vfs_register(vfs as unknown as SQLiteVFS, false);

    bibleDb = await sqlite3.open_v2(
      'bible.db',
      SQLite.SQLITE_OPEN_READWRITE | SQLite.SQLITE_OPEN_CREATE,
      'opfs-coop-sync',
    );

    const hasData = await checkBibleDbExists();
    if (!hasData) {
      await downloadBibleDb();
    }

    post({ type: 'init-progress', stage: 'Initializing...', progress: 100 });
    stateDb = await sqlite3.open_v2(
      'state.db',
      SQLite.SQLITE_OPEN_READWRITE | SQLite.SQLITE_OPEN_CREATE,
      'opfs-coop-sync',
    );
    await sqlite3.exec(stateDb, STATE_SCHEMA);

    post({ type: 'init-complete' });
  } catch (err) {
    post({ type: 'init-error', error: err instanceof Error ? err.message : String(err) });
  }
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'init':
      await init();
      break;

    case 'query': {
      try {
        const db = msg.db === 'bible' ? bibleDb : stateDb;
        const rows = await execQuery(db, msg.sql, msg.params);
        post({ type: 'query-result', id: msg.id, rows });
      } catch (err) {
        post({
          type: 'query-error',
          id: msg.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      break;
    }

    case 'exec': {
      try {
        const changes = await execWrite(stateDb, msg.sql, msg.params);
        dirty = true;
        post({ type: 'exec-result', id: msg.id, changes });
      } catch (err) {
        post({
          type: 'exec-error',
          id: msg.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      break;
    }

    case 'export-state': {
      try {
        const root = await navigator.storage.getDirectory();
        const handle = await root.getFileHandle('state.db');
        const file = await handle.getFile();
        const buffer = await file.arrayBuffer();
        dirty = false;
        const msg: WorkerResponse = { type: 'export-state-result', data: buffer };
        self.postMessage(msg, [buffer]);
      } catch (err) {
        post({
          type: 'export-state-error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
      break;
    }

    case 'is-dirty': {
      post({ type: 'is-dirty-result', dirty });
      break;
    }
  }
};
