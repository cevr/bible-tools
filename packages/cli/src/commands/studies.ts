import { Command, Options } from '@effect/cli';
import { FileSystem } from '@effect/platform';
import { format } from 'date-fns';
import { Effect } from 'effect';
import { join } from 'path';

import { msToMinutes, spin } from '~/src/lib/general';
import { generate } from '~/src/lib/generate';
import { makeAppleNoteFromMarkdown } from '~/src/lib/markdown-to-notes';
import { getNoteContent } from '~/src/lib/notes-utils';
import { getOutputsPath, getPromptPath } from '~/src/lib/paths';
import { revise } from '~/src/lib/revise';
import { Model, model } from '~/src/services/model';

const topic = Options.text('topic').pipe(
  Options.withAlias('t'),
  Options.withDescription('Topic for the study'),
);

const generateStudy = Command.make('generate', { topic, model }, (args) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const startTime = Date.now();

    yield* Effect.log(`topic: ${args.topic}`);

    const systemPrompt = yield* fs
      .readFile(getPromptPath('studies', 'generate.md'))
      .pipe(Effect.map((i) => new TextDecoder().decode(i)));

    const { filename, response } = yield* generate(systemPrompt, args.topic).pipe(
      Effect.provideService(Model, args.model),
    );

    const studiesDir = getOutputsPath('studies');

    const fileName = `${format(new Date(), 'yyyy-MM-dd')}-${filename}.md`;
    const filePath = join(studiesDir, fileName);

    yield* spin(
      'Ensuring studies directory exists',
      fs.makeDirectory(studiesDir).pipe(Effect.ignore),
    );

    yield* spin(
      'Writing study to file: ' + fileName,
      fs.writeFile(filePath, new TextEncoder().encode(response)),
    );

    yield* spin(
      'Adding study to notes',
      makeAppleNoteFromMarkdown(response, { folder: 'studies' }),
    );

    const totalTime = msToMinutes(Date.now() - startTime);
    yield* Effect.log(`Study generated successfully! (Total time: ${totalTime})`);
    yield* Effect.log(`Output: ${filePath}`);
  }),
);

const file = Options.file('file').pipe(
  Options.withAlias('f'),
  Options.withDescription('Path to the study file to revise'),
);

const instructions = Options.text('instructions').pipe(
  Options.withAlias('i'),
  Options.withDescription('Revision instructions'),
);

const reviseStudy = Command.make('revise', { model, file, instructions }, (args) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    const study = yield* fs
      .readFile(args.file)
      .pipe(Effect.map((i) => new TextDecoder().decode(i)));

    const systemMessagePrompt = yield* fs
      .readFile(getPromptPath('studies', 'generate.md'))
      .pipe(Effect.map((i) => new TextDecoder().decode(i)));

    const revisedStudy = yield* revise({
      cycles: [
        {
          prompt: '',
          response: study,
        },
      ],
      systemPrompt: systemMessagePrompt,
      instructions: args.instructions,
    }).pipe(Effect.provideService(Model, args.model));

    yield* fs.writeFile(args.file, new TextEncoder().encode(revisedStudy));

    yield* Effect.log(`Study revised successfully!`);
    yield* Effect.log(`Output: ${args.file}`);
  }),
);

const noteId = Options.text('note-id').pipe(
  Options.withAlias('n'),
  Options.withDescription('Apple Note ID to generate from'),
);

const generateFromNoteStudy = Command.make('from-note', { model, noteId }, (args) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    const startTime = Date.now();

    const note = yield* getNoteContent(args.noteId);

    const systemPrompt = yield* fs
      .readFile(getPromptPath('studies', 'generate.md'))
      .pipe(Effect.map((i) => new TextDecoder().decode(i)));

    const { filename, response } = yield* generate(systemPrompt, note).pipe(
      Effect.provideService(Model, args.model),
    );

    const studiesDir = getOutputsPath('studies');

    const fileName = `${format(new Date(), 'yyyy-MM-dd')}-${filename}.md`;
    const filePath = join(studiesDir, fileName);

    yield* spin(
      'Writing study to file: ' + fileName,
      fs.writeFile(filePath, new TextEncoder().encode(response)),
    );

    yield* spin(
      'Adding study to notes',
      makeAppleNoteFromMarkdown(response, { folder: 'studies' }),
    );

    const totalTime = msToMinutes(Date.now() - startTime);
    yield* Effect.log(`Study generated successfully! (Total time: ${totalTime})`);
    yield* Effect.log(`Output: ${filePath}`);
  }),
);

const json = Options.boolean('json').pipe(
  Options.withDefault(false),
  Options.withDescription('Output as JSON'),
);

const listStudies = Command.make('list', { json }, (args) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    const studiesDir = getOutputsPath('studies');
    const files = yield* fs
      .readDirectory(studiesDir)
      .pipe(Effect.catchAll(() => Effect.succeed([] as string[])));

    const filePaths = files
      .filter((f) => f.endsWith('.md'))
      .map((file) => join(studiesDir, file))
      .sort((a, b) => b.localeCompare(a));

    if (args.json) {
      yield* Effect.log(JSON.stringify(filePaths, null, 2));
    } else {
      if (filePaths.length === 0) {
        yield* Effect.log('No studies found.');
      } else {
        yield* Effect.log('Studies:');
        for (const filePath of filePaths) {
          const basename = filePath.split('/').pop() ?? filePath;
          yield* Effect.log(`  ${basename}`);
        }
      }
    }
  }),
);

export const studies = Command.make('studies').pipe(
  Command.withSubcommands([generateStudy, reviseStudy, generateFromNoteStudy, listStudies]),
);
