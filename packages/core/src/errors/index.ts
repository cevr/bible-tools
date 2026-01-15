/**
 * Centralized Error Types
 *
 * All error types for @bible/core, organized by domain.
 * Uses Schema.TaggedError for serialization and pattern matching.
 */

// Database errors
export {
  DatabaseConnectionError,
  SchemaInitializationError,
  DatabaseQueryError,
  RecordNotFoundError,
  type DatabaseError,
} from './database.js';
