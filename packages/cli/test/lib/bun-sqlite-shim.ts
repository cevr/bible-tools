/**
 * Bun SQLite shim for vitest.
 * This provides a mock implementation of bun:sqlite for testing.
 */

export class Database {
  private tables: Map<string, unknown[]> = new Map();

  exec(_sql: string): void {
    // Mock exec - do nothing
  }

  query<T = unknown>(_sql: string) {
    return {
      all: (..._params: unknown[]): T[] => [],
      get: (..._params: unknown[]): T | undefined => undefined,
      run: (..._params: unknown[]) => ({ changes: 0, lastInsertRowid: 0 }),
      values: (..._params: unknown[]): unknown[][] => [],
    };
  }

  prepare<T = unknown>(_sql: string) {
    return this.query<T>(_sql);
  }

  close(): void {
    // Mock close
  }

  transaction<T>(fn: () => T): () => T {
    return fn;
  }
}

export default { Database };
