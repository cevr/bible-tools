/**
 * Main-thread client for the SQLite Web Worker.
 *
 * Provides a Promise-based API for querying bible.db and state.db.
 * Singleton — call getDbClient() to get the shared instance.
 */
import type { WorkerRequest, WorkerResponse } from './db-protocol.js';

export interface DbClient {
  /** Initialize the worker and databases. Resolves when ready. */
  init(): Promise<void>;
  /** Register a progress callback for init. */
  onProgress(cb: (stage: string, progress: number) => void): void;
  /** Query a database. Returns rows as record arrays. */
  query<T = Record<string, unknown>>(
    db: 'bible' | 'state',
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;
  /** Execute a write statement on state.db. Returns affected row count. */
  exec(sql: string, params?: unknown[]): Promise<number>;
  /** Export state.db as a binary blob from OPFS. */
  exportState(): Promise<ArrayBuffer>;
  /** Check if state.db has been written to since last export. */
  isDirty(): Promise<boolean>;
  /** Register a callback that fires after every successful exec. */
  onExec(cb: () => void): void;
}

function createDbClient(): DbClient {
  const worker = new Worker(new URL('./db-worker.ts', import.meta.url), { type: 'module' });

  let nextId = 1;
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (err: Error) => void }
  >();
  let initResolve: (() => void) | null = null;
  let initReject: ((err: Error) => void) | null = null;
  let progressCallbacks: ((stage: string, progress: number) => void)[] = [];
  let execCallbacks: (() => void)[] = [];
  let exportResolve: ((buf: ArrayBuffer) => void) | null = null;
  let exportReject: ((err: Error) => void) | null = null;
  let dirtyResolve: ((dirty: boolean) => void) | null = null;

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const msg = event.data;

    switch (msg.type) {
      case 'init-progress': {
        for (const cb of progressCallbacks) {
          cb(msg.stage, msg.progress);
        }
        break;
      }
      case 'init-complete': {
        initResolve?.();
        break;
      }
      case 'init-error': {
        initReject?.(new Error(msg.error));
        break;
      }
      case 'query-result': {
        pending.get(msg.id)?.resolve(msg.rows);
        pending.delete(msg.id);
        break;
      }
      case 'query-error': {
        pending.get(msg.id)?.reject(new Error(msg.error));
        pending.delete(msg.id);
        break;
      }
      case 'exec-result': {
        pending.get(msg.id)?.resolve(msg.changes);
        pending.delete(msg.id);
        for (const cb of execCallbacks) cb();
        break;
      }
      case 'exec-error': {
        pending.get(msg.id)?.reject(new Error(msg.error));
        pending.delete(msg.id);
        break;
      }
      case 'export-state-result': {
        exportResolve?.(msg.data);
        exportResolve = null;
        exportReject = null;
        break;
      }
      case 'export-state-error': {
        exportReject?.(new Error(msg.error));
        exportResolve = null;
        exportReject = null;
        break;
      }
      case 'is-dirty-result': {
        dirtyResolve?.(msg.dirty);
        dirtyResolve = null;
        break;
      }
    }
  };

  function send(msg: WorkerRequest) {
    worker.postMessage(msg);
  }

  return {
    init() {
      return new Promise<void>((resolve, reject) => {
        initResolve = resolve;
        initReject = reject;
        send({ type: 'init' });
      });
    },

    onProgress(cb) {
      progressCallbacks.push(cb);
    },

    query<T = Record<string, unknown>>(
      db: 'bible' | 'state',
      sql: string,
      params?: unknown[],
    ): Promise<T[]> {
      const id = nextId++;
      return new Promise<T[]>((resolve, reject) => {
        pending.set(id, {
          resolve: resolve as (value: unknown) => void,
          reject,
        });
        send({ type: 'query', id, db, sql, params });
      });
    },

    exec(sql: string, params?: unknown[]): Promise<number> {
      const id = nextId++;
      return new Promise<number>((resolve, reject) => {
        pending.set(id, {
          resolve: resolve as (value: unknown) => void,
          reject,
        });
        send({ type: 'exec', id, db: 'state', sql, params });
      });
    },

    exportState(): Promise<ArrayBuffer> {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        exportResolve = resolve;
        exportReject = reject;
        send({ type: 'export-state' });
      });
    },

    isDirty(): Promise<boolean> {
      return new Promise<boolean>((resolve) => {
        dirtyResolve = resolve;
        send({ type: 'is-dirty' });
      });
    },

    onExec(cb: () => void) {
      execCallbacks.push(cb);
    },
  };
}

// Singleton
let instance: DbClient | null = null;

export function getDbClient(): DbClient {
  if (!instance) {
    instance = createDbClient();
  }
  return instance;
}
