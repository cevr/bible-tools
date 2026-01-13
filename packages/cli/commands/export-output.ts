import { Command, Options } from '@effect/cli';
import { FileSystem } from '@effect/platform';
import { Effect } from 'effect';

import { makeAppleNoteFromMarkdown } from '~/lib/markdown-to-notes';

const files = Options.file('files').pipe(
  Options.withAlias('f'),
  Options.repeated,
  Options.withDescription('Files to export to Apple Notes'),
);

export const exportOutput = Command.make('export', { files }, (args) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;

    if (args.files.length === 0) {
      yield* Effect.logError(
        'No files specified. Use --files or -f to specify files to export.',
      );
      return;
    }

    yield* Effect.log(
      `Exporting ${args.files.length} file(s) to Apple Notes...`,
    );

    const contents = yield* Effect.forEach(args.files, (filePath) =>
      fileSystem.readFile(filePath),
    );

    yield* Effect.forEach(contents, (content, index) =>
      Effect.gen(function* () {
        yield* makeAppleNoteFromMarkdown(new TextDecoder().decode(content));
        yield* Effect.log(`  Exported: ${args.files[index]}`);
      }),
    );

    yield* Effect.log(
      `Successfully exported ${args.files.length} file(s) to Apple Notes.`,
    );
  }),
);
