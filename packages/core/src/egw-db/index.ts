/**
 * EGW Paragraph Database - Main Export
 *
 * This module provides a service for storing and retrieving EGW paragraphs
 * in a local SQLite database, avoiding repeated HTTP calls to the EGW API.
 */

export {
  EGWParagraphDatabase,
  DatabaseConnectionError,
  DatabaseQueryError,
  ParagraphNotFoundError,
  SchemaInitializationError,
  isChapterHeading,
} from './book-database.js';
export type {
  ParagraphDatabaseError,
  ParagraphRow,
  SyncStatus,
  SyncStatusRow,
} from './book-database.js';
