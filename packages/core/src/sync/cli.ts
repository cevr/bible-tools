#!/usr/bin/env bun
/**
 * EGW Sync CLI
 *
 * Command-line interface for syncing EGW books to local database.
 *
 * Usage:
 *   bun run src/sync/cli.ts [options] [languageCode] [authorName]
 *
 * Options:
 *   --force      Resync all books, even successful ones
 *   --failed     Only retry failed books
 *   --status     Show sync status and exit
 *
 * Environment Variables Required:
 *   - EGW_CLIENT_ID: EGW API client ID
 *   - EGW_CLIENT_SECRET: EGW API client secret
 *   - EGW_PARAGRAPH_DB: (optional) Path to paragraph database file
 */

import { FetchHttpClient } from '@effect/platform';
import { BunContext, BunRuntime } from '@effect/platform-bun';
import { Effect, Layer } from 'effect';

import { EGWParagraphDatabase } from '../egw-db/index.js';
import { EGWApiClient } from '../egw/client.js';
import { getSyncStatusSummary, syncEgwBooks } from './egw-sync.js';

// Parse CLI arguments
const args = process.argv.slice(2);
const forceSync = args.includes('--force');
const failedOnly = args.includes('--failed');
const showStatus = args.includes('--status');

// Filter out flags to get positional args
const positionalArgs = args.filter((arg) => !arg.startsWith('--'));
const languageCode = positionalArgs[0] || 'en';
const authorName = positionalArgs[1] || 'Ellen Gould White';

/**
 * Show sync status and exit
 */
const showSyncStatusProgram = Effect.gen(function* () {
  const summary = yield* getSyncStatusSummary;

  yield* Effect.log('=== Sync Status ===');
  yield* Effect.log(`Success: ${summary.success} books`);
  yield* Effect.log(`Failed: ${summary.failed} books`);
  yield* Effect.log(`Pending: ${summary.pending} books`);

  if (summary.failedBooks.length > 0) {
    yield* Effect.log('');
    yield* Effect.log('Failed books:');
    for (const book of summary.failedBooks) {
      yield* Effect.log(`  ${book.bookCode}: ${book.error ?? 'Unknown error'}`);
    }
  }

  yield* Effect.log('');
  yield* Effect.log(`Total paragraphs synced: ${summary.totalParagraphs}`);
});

/**
 * Run sync program
 */
const syncProgram = syncEgwBooks({
  force: forceSync,
  failedOnly,
  languageCode,
  authorName,
}).pipe(Effect.asVoid);

// Choose program based on flags
const program = showStatus ? showSyncStatusProgram : syncProgram;

// Compose layers
const ServiceLayer = Layer.mergeAll(
  EGWParagraphDatabase.Default,
  Layer.provide(EGWApiClient.Default, FetchHttpClient.layer),
);

const AppLayer = ServiceLayer.pipe(Layer.provide(BunContext.layer));

// Run
BunRuntime.runMain(program.pipe(Effect.provide(AppLayer)));
