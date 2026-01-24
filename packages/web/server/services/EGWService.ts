/**
 * EGW Service - Re-export from core
 *
 * The unified EGWService now lives in @bible/core.
 * This file provides backwards compatibility for web server imports.
 */

export {
  EGWService,
  EGWBook,
  EGWParagraph,
  EGWChapter,
  EGWPageResponse,
  EGWSearchResult,
  type EGWServiceShape,
} from '@bible/core/egw-service';

import { Layer } from 'effect';

import { EGWParagraphDatabase } from '@bible/core/egw-db';
import { EGWService } from '@bible/core/egw-service';

/**
 * EGWServiceLive - Composed layer with database dependency
 */
export const EGWServiceLive = EGWService.Live.pipe(
  Layer.provide(EGWParagraphDatabase.Live),
);
