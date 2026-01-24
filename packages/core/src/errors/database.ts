/**
 * Database Error Types
 *
 * Centralized error definitions for all database operations.
 * Uses Schema.TaggedError for serialization and type safety.
 */

import { Schema } from 'effect';

/**
 * Database connection or initialization error.
 * Used when establishing connection to SQLite databases fails.
 */
export class DatabaseConnectionError extends Schema.TaggedError<DatabaseConnectionError>()(
  'DatabaseConnectionError',
  {
    cause: Schema.Unknown,
    message: Schema.String,
    database: Schema.optional(Schema.String),
  },
) {}

/**
 * Database schema initialization error.
 * Used when creating or migrating database schema fails.
 */
export class SchemaInitializationError extends Schema.TaggedError<SchemaInitializationError>()(
  'SchemaInitializationError',
  {
    cause: Schema.Unknown,
    message: Schema.String,
    database: Schema.optional(Schema.String),
  },
) {}

/**
 * Database query execution error.
 * Generic error for query failures with optional context.
 */
export class DatabaseQueryError extends Schema.TaggedError<DatabaseQueryError>()(
  'DatabaseQueryError',
  {
    cause: Schema.Unknown,
    operation: Schema.String,
    // Common context fields
    bookId: Schema.optional(Schema.Number),
    refCode: Schema.optional(Schema.String),
    storeDisplayName: Schema.optional(Schema.String),
  },
) {}

/**
 * Record not found error.
 * Used when a specific record lookup returns no results.
 */
export class RecordNotFoundError extends Schema.TaggedError<RecordNotFoundError>()(
  'RecordNotFoundError',
  {
    entity: Schema.String,
    id: Schema.String,
    context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  },
) {}

/**
 * Union of all database errors (Schema)
 */
export const DatabaseError = Schema.Union(
  DatabaseConnectionError,
  SchemaInitializationError,
  DatabaseQueryError,
  RecordNotFoundError,
);

/**
 * Union of all database errors (type)
 */
export type DatabaseError = Schema.Schema.Type<typeof DatabaseError>;
