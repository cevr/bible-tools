import { Command, Options } from '@effect/cli';
import { FileSystem, Path } from '@effect/platform';
import { generateText } from 'ai';
import { format } from 'date-fns';
import { Data, Effect, Schedule } from 'effect';

import { generate } from '~/src/lib/generate';
import { makeAppleNoteFromMarkdown } from '~/src/lib/markdown-to-notes';
import { getNoteContent } from '~/src/lib/notes-utils';
import { revise } from '~/src/lib/revise';

import { msToMinutes, spin } from '~/src/lib/general';
import { Model, model } from '~/src/services/model';
import { generateTopicPrompt } from '~/src/prompts/messages/generate-topic';

const topic = Options.text('topic').pipe(
  Options.withAlias('t'),
  Options.withDescription('Topic for the message'),
);

const generateMessage = Command.make('generate', { topic, model }, (args) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const startTime = Date.now();

    yield* Effect.log(`topic: ${args.topic}`);

    const systemPrompt = yield* fs
      .readFile(
        path.join(process.cwd(), 'core', 'messages', 'prompts', 'generate.md'),
      )
      .pipe(Effect.map((i) => new TextDecoder().decode(i)));

    const { filename, response } = yield* generate(
      systemPrompt,
      args.topic,
    ).pipe(Effect.provideService(Model, args.model));

    const messagesDir = path.join(process.cwd(), 'outputs', 'messages');

    const fileName = `${format(new Date(), 'yyyy-MM-dd')}-${filename}.md`;
    const filePath = path.join(messagesDir, fileName);

    yield* spin(
      'Ensuring messages directory exists',
      fs.makeDirectory(messagesDir).pipe(Effect.ignore),
    );

    yield* spin(
      'Writing message to file: ' + fileName,
      fs.writeFile(filePath, new TextEncoder().encode(response)),
    );

    yield* spin(
      'Adding message to notes',
      makeAppleNoteFromMarkdown(response, { folder: 'messages' }),
    );

    const totalTime = msToMinutes(Date.now() - startTime);
    yield* Effect.log(
      `Message generated successfully! (Total time: ${totalTime})`,
    );
    yield* Effect.log(`Output: ${filePath}`);
  }),
);

const file = Options.file('file').pipe(
  Options.withAlias('f'),
  Options.withDescription('Path to the message file to revise'),
);

const instructions = Options.text('instructions').pipe(
  Options.withAlias('i'),
  Options.withDescription('Revision instructions'),
);

const reviseMessage = Command.make(
  'revise',
  { model, file, instructions },
  (args) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;

      const message = yield* fs
        .readFile(args.file)
        .pipe(Effect.map((i) => new TextDecoder().decode(i)));

      const systemMessagePrompt = yield* fs
        .readFile(
          path.join(
            process.cwd(),
            'core',
            'messages',
            'prompts',
            'generate.md',
          ),
        )
        .pipe(Effect.map((i) => new TextDecoder().decode(i)));

      const revisedMessage = yield* revise({
        cycles: [
          {
            prompt: '',
            response: message,
          },
        ],
        systemPrompt: systemMessagePrompt,
        instructions: args.instructions,
      }).pipe(Effect.provideService(Model, args.model));

      yield* fs.writeFile(args.file, new TextEncoder().encode(revisedMessage));

      yield* Effect.log(`Message revised successfully!`);
      yield* Effect.log(`Output: ${args.file}`);
    }),
);

const noteId = Options.text('note-id').pipe(
  Options.withAlias('n'),
  Options.withDescription('Apple Note ID to generate from'),
);

const generateFromNoteMessage = Command.make(
  'from-note',
  { model, noteId },
  (args) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const startTime = Date.now();
      const note = yield* getNoteContent(args.noteId);

      const systemPrompt = yield* fs
        .readFile(
          path.join(
            process.cwd(),
            'core',
            'messages',
            'prompts',
            'generate.md',
          ),
        )
        .pipe(Effect.map((i) => new TextDecoder().decode(i)));

      const { filename, response } = yield* generate(systemPrompt, note).pipe(
        Effect.provideService(Model, args.model),
      );

      const messagesDir = path.join(process.cwd(), 'outputs', 'messages');

      const fileName = `${format(new Date(), 'yyyy-MM-dd')}-${filename}.md`;
      const filePath = path.join(messagesDir, fileName);

      yield* spin(
        'Writing message to file: ' + fileName,
        fs.writeFile(filePath, new TextEncoder().encode(response)),
      );

      yield* spin(
        'Adding message to notes',
        makeAppleNoteFromMarkdown(response, { folder: 'messages' }),
      );

      const totalTime = msToMinutes(Date.now() - startTime);
      yield* Effect.log(
        `Message generated successfully! (Total time: ${totalTime})`,
      );
      yield* Effect.log(`Output: ${filePath}`);
    }),
);

class GenerateTopicResponseError extends Data.TaggedError(
  'GenerateTopicResponseError',
)<{
  cause: unknown;
}> {}

const generateTopic = Command.make('generate-topic', { model }, (args) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const previousMessages = yield* fs.readDirectory(
      path.join(process.cwd(), 'outputs', 'messages'),
    );

    const systemPrompt = generateTopicPrompt(previousMessages);

    const response = yield* spin(
      'Generating...',
      Effect.tryPromise({
        try: () =>
          generateText({
            model: args.model.high,
            messages: [
              {
                role: 'system',
                content: systemPrompt,
              },
            ],
          }),
        catch: (cause: unknown) =>
          new GenerateTopicResponseError({
            cause,
          }),
      }).pipe(
        Effect.retry({
          times: 3,
          schedule: Schedule.spaced(500),
        }),
      ),
    );

    const message = response.text;
    yield* Effect.log(`topic: \n\n ${message}`);
  }),
);

const json = Options.boolean('json').pipe(
  Options.withDefault(false),
  Options.withDescription('Output as JSON'),
);

const listMessages = Command.make('list', { json }, (args) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const messagesDir = path.join(process.cwd(), 'outputs', 'messages');
    const files = yield* fs
      .readDirectory(messagesDir)
      .pipe(Effect.catchAll(() => Effect.succeed([] as string[])));

    const filePaths = files
      .filter((f) => f.endsWith('.md'))
      .map((file) => path.join(messagesDir, file))
      .sort((a, b) => b.localeCompare(a));

    if (args.json) {
      yield* Effect.log(JSON.stringify(filePaths, null, 2));
    } else {
      if (filePaths.length === 0) {
        yield* Effect.log('No messages found.');
      } else {
        yield* Effect.log('Messages:');
        for (const filePath of filePaths) {
          yield* Effect.log(`  ${path.basename(filePath)}`);
        }
      }
    }
  }),
);

export const messages = Command.make('messages').pipe(
  Command.withSubcommands([
    generateMessage,
    reviseMessage,
    generateFromNoteMessage,
    generateTopic,
    listMessages,
  ]),
);
