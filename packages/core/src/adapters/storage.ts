import { Context, Effect, Schema } from 'effect';

/**
 * Error thrown when a storage operation fails.
 */
export class StorageError extends Schema.TaggedError<StorageError>()(
  'StorageError',
  {
    key: Schema.String,
    operation: Schema.Literal('read', 'write', 'delete'),
    cause: Schema.Defect,
  },
) {}

/**
 * Adapter for persistent storage operations.
 * CLI implements this with filesystem storage.
 * Web could implement with IndexedDB or server-side storage.
 */
export class StorageAdapter extends Context.Tag('@bible/StorageAdapter')<
  StorageAdapter,
  {
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
    readonly write: (
      key: string,
      content: string,
    ) => Effect.Effect<void, StorageError>;

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
>() {}
