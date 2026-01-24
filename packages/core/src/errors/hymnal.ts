/**
 * Hymnal Error Types
 *
 * Error definitions for hymnal operations.
 */

import { DatabaseConnectionError, DatabaseQueryError, RecordNotFoundError } from './database.js';

/**
 * Error when a hymn is not found.
 * Alias for RecordNotFoundError with entity='Hymn'.
 */
export type HymnNotFoundError = RecordNotFoundError;

/**
 * Union of all hymnal database errors.
 */
export type HymnalDatabaseError =
  | DatabaseConnectionError
  | DatabaseQueryError
  | RecordNotFoundError;

// Re-export base errors for convenience
export { DatabaseConnectionError, DatabaseQueryError, RecordNotFoundError };
