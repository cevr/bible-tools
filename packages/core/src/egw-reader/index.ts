/**
 * EGW Reader Module
 *
 * Provides the EGW reader service and types for building
 * reader UIs (TUI, Web, etc).
 */

export type {
  EGWBookInfo,
  EGWChapterInfo,
  EGWParagraph,
  EGWReaderPosition,
  EGWReaderState,
} from './types.js';

export { initialReaderState, isReaderState } from './types.js';

export {
  EGWReaderService,
  EGWReaderError,
  BookNotFoundError,
  DatabaseNotInitializedError,
  type ReaderError,
} from './service.js';
