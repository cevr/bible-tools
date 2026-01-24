/**
 * EGW CLI Commands
 *
 * Provides CLI access to EGW writings:
 * - `bible egw "PP 351.1"` - Lookup by refcode
 * - `bible egw "great controversy"` - Search
 * - `bible egw open "PP 351.1"` - Open TUI at refcode (handled by main.ts)
 */

import { formatEGWRef, isSearchQuery, parseEGWRef } from '@bible/core/egw';
import { Args, Command } from '@effect/cli';
import { Console, Effect } from 'effect';

// Variadic args to capture "PP 351.1" or "PP" "351.1" etc.
const query = Args.text({ name: 'query' }).pipe(Args.repeated);

/**
 * Main egw command - lookup by refcode or search
 */
export const egw = Command.make('egw', { query }, (args) =>
  Effect.gen(function* () {
    const queryStr = args.query.join(' ').trim();

    if (!queryStr) {
      yield* Console.log('Usage: bible egw <refcode or search query>');
      yield* Console.log('');
      yield* Console.log('Examples:');
      yield* Console.log('  bible egw "PP 351.1"       # Single paragraph');
      yield* Console.log('  bible egw "PP 351.1-5"     # Paragraph range');
      yield* Console.log('  bible egw "PP 351"         # Full page');
      yield* Console.log('  bible egw "PP 351-355"     # Page range');
      yield* Console.log('  bible egw "great controversy"  # Search');
      yield* Console.log('');
      yield* Console.log('To open in TUI:');
      yield* Console.log('  bible egw open "PP 351.1"');
      return;
    }

    const parsed = parseEGWRef(queryStr);

    if (isSearchQuery(parsed)) {
      // Search query - TODO: implement search when we have the database
      yield* Console.log(`Search for "${parsed.query}" - Feature coming soon`);
      yield* Console.log('');
      yield* Console.log('For now, use refcode lookup:');
      yield* Console.log('  bible egw "PP 351.1"');
      return;
    }

    // Reference lookup - TODO: implement when we have the database service
    const refStr = formatEGWRef(parsed);
    yield* Console.log(`Looking up: ${refStr}`);
    yield* Console.log('');

    switch (parsed._tag) {
      case 'paragraph':
        yield* Console.log(`Book: ${parsed.bookCode}`);
        yield* Console.log(`Page: ${parsed.page}`);
        yield* Console.log(`Paragraph: ${parsed.paragraph}`);
        break;
      case 'paragraph-range':
        yield* Console.log(`Book: ${parsed.bookCode}`);
        yield* Console.log(`Page: ${parsed.page}`);
        yield* Console.log(`Paragraphs: ${parsed.paragraphStart}-${parsed.paragraphEnd}`);
        break;
      case 'page':
        yield* Console.log(`Book: ${parsed.bookCode}`);
        yield* Console.log(`Page: ${parsed.page}`);
        yield* Console.log('(All paragraphs on this page)');
        break;
      case 'page-range':
        yield* Console.log(`Book: ${parsed.bookCode}`);
        yield* Console.log(`Pages: ${parsed.pageStart}-${parsed.pageEnd}`);
        break;
      case 'book':
        yield* Console.log(`Book: ${parsed.bookCode}`);
        yield* Console.log('(Entire book)');
        break;
    }

    yield* Console.log('');
    yield* Console.log('Note: Database lookup coming soon. Use "bible egw open" to view in TUI.');
  }),
);

/**
 * egw open subcommand - launches TUI at specified refcode
 * This is handled specially in main.ts, but we define it here for help text
 */
export const egwOpen = Command.make('open', { query }, (args) =>
  Effect.gen(function* () {
    const queryStr = args.query.join(' ').trim();

    if (!queryStr) {
      yield* Console.log('Usage: bible egw open <refcode>');
      yield* Console.log('');
      yield* Console.log('Opens the EGW reader TUI at the specified location.');
      yield* Console.log('');
      yield* Console.log('Examples:');
      yield* Console.log('  bible egw open "PP 351.1"');
      yield* Console.log('  bible egw open "DA 1"');
      return;
    }

    // This case is handled in main.ts before we get here
    // If we reach here, something went wrong
    yield* Console.log(`Opening: ${queryStr}`);
    yield* Console.log('(This should launch the TUI)');
  }),
);

/**
 * Combined egw command with subcommands
 */
export const egwWithSubcommands = Command.make('egw', { query }, (args) =>
  Effect.gen(function* () {
    // If query is provided at top level, treat as lookup
    const queryStr = args.query.join(' ').trim();
    if (queryStr) {
      // Re-run the main egw logic
      const parsed = parseEGWRef(queryStr);

      if (isSearchQuery(parsed)) {
        yield* Console.log(`Search for "${parsed.query}" - Feature coming soon`);
        return;
      }

      const refStr = formatEGWRef(parsed);
      yield* Console.log(`Looking up: ${refStr}`);
      yield* Console.log('');
      yield* Console.log('Note: Database lookup coming soon. Use "bible egw open" to view in TUI.');
      return;
    }

    // No query - show help
    yield* Console.log('Usage: bible egw <refcode or search query>');
    yield* Console.log('       bible egw open <refcode>');
    yield* Console.log('');
    yield* Console.log('Examples:');
    yield* Console.log('  bible egw "PP 351.1"       # Lookup paragraph');
    yield* Console.log('  bible egw open "PP 351.1"  # Open in TUI');
  }),
).pipe(Command.withSubcommands([egwOpen]));
