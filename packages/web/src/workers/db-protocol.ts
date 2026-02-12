/** Message types shared between main thread and db worker */

export type WorkerRequest =
  | { type: 'init' }
  | { type: 'query'; id: number; db: 'bible' | 'state'; sql: string; params?: unknown[] }
  | { type: 'exec'; id: number; db: 'state'; sql: string; params?: unknown[] }
  | { type: 'export-state' }
  | { type: 'is-dirty' };

export type WorkerResponse =
  | { type: 'init-progress'; stage: string; progress: number }
  | { type: 'init-complete' }
  | { type: 'init-error'; error: string }
  | { type: 'query-result'; id: number; rows: Record<string, unknown>[] }
  | { type: 'query-error'; id: number; error: string }
  | { type: 'exec-result'; id: number; changes: number }
  | { type: 'exec-error'; id: number; error: string }
  | { type: 'export-state-result'; data: ArrayBuffer }
  | { type: 'export-state-error'; error: string }
  | { type: 'is-dirty-result'; dirty: boolean };
