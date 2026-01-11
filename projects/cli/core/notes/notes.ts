import { Command, Options } from '@effect/cli';
import { FileSystem } from '@effect/platform';
import { Console, Effect } from 'effect';

import { listNotes } from '~/lib/notes-utils';
import { makeAppleNoteFromMarkdown, updateAppleNoteFromMarkdown } from '~/lib/markdown-to-notes';

// List subcommand
const jsonFlag = Options.boolean('json').pipe(
  Options.withDescription('Output as JSON'),
  Options.withDefault(false),
);

const list = Command.make('list', { json: jsonFlag }, (args) =>
  Effect.gen(function* () {
    const notes = yield* listNotes();

    if (args.json) {
      yield* Console.log(JSON.stringify(notes, null, 2));
    } else {
      if (notes.length === 0) {
        yield* Console.log('No notes found.');
        return;
      }

      yield* Console.log('Recent Apple Notes:\n');
      yield* Console.log('ID                                                              | Name                                     | Modified');
      yield* Console.log('----------------------------------------------------------------|------------------------------------------|--------------------');

      for (const note of notes) {
        const id = note.id.length > 64 ? note.id.slice(0, 61) + '...' : note.id.padEnd(64);
        const name = note.name.length > 40 ? note.name.slice(0, 37) + '...' : note.name.padEnd(40);
        const modified = note.modificationDate.slice(0, 20);
        yield* Console.log(`${id}| ${name}| ${modified}`);
      }

      yield* Console.log(`\nTotal: ${notes.length} notes (showing most recent 20)`);
    }
  }),
);

// Export subcommand - export markdown file to Apple Notes (create or update)
const files = Options.file('file').pipe(
  Options.withAlias('f'),
  Options.withDescription('Markdown file to export'),
);

const noteId = Options.text('note-id').pipe(
  Options.withAlias('n'),
  Options.withDescription('Note ID to update (if not provided, creates new note)'),
  Options.optional,
);

const folder = Options.text('folder').pipe(
  Options.withDescription('Target folder in Apple Notes (for new notes)'),
  Options.optional,
);

const exportNote = Command.make('export', { file: files, noteId, folder }, (args) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;

    yield* Effect.log(`Reading file: ${args.file}`);
    const content = yield* fileSystem.readFile(args.file);
    const markdownContent = new TextDecoder().decode(content);

    if (args.noteId._tag === 'Some') {
      // Update existing note
      yield* Effect.log(`Updating existing note: ${args.noteId.value}`);
      const title = yield* updateAppleNoteFromMarkdown(args.noteId.value, markdownContent);
      yield* Console.log(`Updated note: "${title}"`);
    } else {
      // Create new note
      const folderName = args.folder._tag === 'Some' ? args.folder.value : undefined;
      yield* Effect.log(`Creating new note${folderName ? ` in folder "${folderName}"` : ''}...`);
      const title = yield* makeAppleNoteFromMarkdown(markdownContent, { folder: folderName });
      yield* Console.log(`Created note: "${title}"`);
    }
  }),
);

// Main notes command
export const notes = Command.make('notes').pipe(
  Command.withSubcommands([list, exportNote]),
);
