// @effect-diagnostics strictBooleanExpressions:off
import { Context, Effect, Layer, Schema } from 'effect';

/**
 * Error thrown when a storage operation fails.
 */
export class StorageError extends Schema.TaggedError<StorageError>()('StorageError', {
  key: Schema.String,
  operation: Schema.Literal('read', 'write', 'delete'),
  cause: Schema.Defect,
}) {}

// ============================================================================
// Service Interface
// ============================================================================

/**
 * Storage adapter service interface.
 * CLI implements this with filesystem storage.
 * Web could implement with IndexedDB or server-side storage.
 */
export interface StorageAdapterService {
  /**
   * Read content from storage.
   * @param key - The storage key (e.g., file path)
   */
  readonly read: (key: string) => Effect.Effect<string, StorageError>;

  /**
   * Write content to storage.
   * @param key - The storage key (e.g., file path)
   * @param content - The content to write
   */
  readonly write: (key: string, content: string) => Effect.Effect<void, StorageError>;

  /**
   * Check if a key exists in storage.
   * @param key - The storage key to check
   */
  readonly exists: (key: string) => Effect.Effect<boolean>;

  /**
   * Delete content from storage.
   * @param key - The storage key to delete
   */
  readonly remove: (key: string) => Effect.Effect<void, StorageError>;

  /**
   * List all keys matching a prefix.
   * @param prefix - The key prefix to match
   */
  readonly list: (prefix: string) => Effect.Effect<readonly string[]>;
}

// ============================================================================
// Service Definition
// ============================================================================

/**
 * Adapter for persistent storage operations.
 */
export class StorageAdapter extends Context.Tag('@bible/core/adapters/storage/StorageAdapter')<
  StorageAdapter,
  StorageAdapterService
>() {
  /**
   * Test implementation with in-memory storage.
   */
  static Test = (initialData: Record<string, string> = {}): Layer.Layer<StorageAdapter> => {
    const storage = new Map(Object.entries(initialData));
    return Layer.succeed(StorageAdapter, {
      read: (key) =>
        Effect.fromNullable(storage.get(key)).pipe(
          Effect.mapError(() => new StorageError({ key, operation: 'read', cause: null })),
        ),
      write: (key, content) =>
        Effect.sync(() => {
          storage.set(key, content);
        }),
      exists: (key) => Effect.succeed(storage.has(key)),
      remove: (key) =>
        Effect.sync(() => {
          storage.delete(key);
        }),
      list: (prefix) => Effect.succeed([...storage.keys()].filter((k) => k.startsWith(prefix))),
    });
  };
}
