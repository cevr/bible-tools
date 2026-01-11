import { Args, Command } from '@effect/cli';
import { Console, Effect } from 'effect';

import { BibleData, BibleDataLive } from '~/src/bible/data';
import { parseVerseQuery, getVersesForQuery, type ParsedQuery } from '~/src/bible/parse';
import { formatReference, getBook, type Verse } from '~/src/bible/types';

// Variadic args to capture "john 3:16" or "john" "3:16" etc.
const query = Args.text({ name: 'query' }).pipe(Args.repeated);

// Format a single verse for output
function formatVerse(verse: Verse): string {
  const book = getBook(verse.book);
  const ref = book ? `${book.name} ${verse.chapter}:${verse.verse}` : `${verse.book} ${verse.chapter}:${verse.verse}`;
  return `${ref}\n${verse.text}`;
}

// Print verses to stdout
function printVerses(verses: Verse[]): Effect.Effect<void> {
  if (verses.length === 0) {
    return Console.log('No verses found.');
  }
  const output = verses.map(formatVerse).join('\n\n');
  return Console.log(output);
}

// Print search results
function printSearchResults(query: string, verses: Verse[]): Effect.Effect<void> {
  if (verses.length === 0) {
    return Console.log(`No verses found matching "${query}".`);
  }
  const header = `Found ${verses.length} verse${verses.length === 1 ? '' : 's'} matching "${query}":\n`;
  const output = verses.map(formatVerse).join('\n\n');
  return Console.log(header + '\n' + output);
}

const verse = Command.make('verse', { query }, (args) =>
  Effect.gen(function* () {
    const data = yield* BibleData;
    const queryStr = args.query.join(' ').trim();

    if (!queryStr) {
      yield* Console.log('Usage: bible verse <reference or search query>');
      yield* Console.log('');
      yield* Console.log('Examples:');
      yield* Console.log('  bible verse john 3:16       # Single verse');
      yield* Console.log('  bible verse john 3          # Full chapter');
      yield* Console.log('  bible verse john 3:16-18    # Verse range');
      yield* Console.log('  bible verse john 3-5        # Chapter range');
      yield* Console.log('  bible verse ruth            # Full book');
      yield* Console.log('  bible verse "faith"         # Text search');
      return;
    }

    const parsed = parseVerseQuery(queryStr, data);

    if (parsed._tag === 'search') {
      // Text search
      const results = data.searchVerses(parsed.query, 10);
      const verses = results.map((r) => r.verse);
      yield* printSearchResults(parsed.query, verses);
    } else {
      // Reference-based query
      const verses = getVersesForQuery(parsed, data);
      yield* printVerses(verses);
    }
  }).pipe(Effect.provide(BibleDataLive))
);

export const bible = Command.make('bible').pipe(Command.withSubcommands([verse]));
