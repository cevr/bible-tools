import { Command, Options } from '@effect/cli';
import { FileSystem } from '@effect/platform';
import { generateText } from 'ai';
import { format } from 'date-fns';
import { Data, Effect, Option, Schedule, Schema } from 'effect';
import { join } from 'path';

import {
  type MessageFrontmatter,
  parseFrontmatter,
  stringifyFrontmatter,
  updateFrontmatter,
} from '~/src/lib/frontmatter';
import { msToMinutes, spin } from '~/src/lib/general';
import { generate } from '~/src/lib/generate';
import {
  makeAppleNoteFromMarkdown,
  updateAppleNoteFromMarkdown,
} from '~/src/lib/markdown-to-notes';
import { findNoteByTitle, getNoteContent } from '~/src/lib/notes-utils';
import { extractTitleFromMarkdown } from '~/src/lib/apple-notes-utils';
import { getOutputsPath, getPromptPath } from '~/src/lib/paths';
import { revise } from '~/src/lib/revise';
import { generateTopicPrompt } from '~/src/prompts/messages/generate-topic';
import { Model, model } from '~/src/services/model';

const topic = Options.text('topic').pipe(
  Options.withAlias('t'),
  Options.withDescription('Topic for the message'),
);

const generateMessage = Command.make('generate', { topic, model }, (args) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const startTime = Date.now();

    yield* Effect.logDebug(`topic: ${args.topic}`);

    const systemPrompt = yield* fs
      .readFile(getPromptPath('messages', 'generate.md'))
      .pipe(Effect.map((i) => new TextDecoder().decode(i)));

    const { filename, response } = yield* generate(systemPrompt, args.topic).pipe(
      Effect.provideService(Model, args.model),
    );

    const messagesDir = getOutputsPath('messages');

    const fileName = `${format(new Date(), 'yyyy-MM-dd')}-${filename}.md`;
    const filePath = join(messagesDir, fileName);

    // Create frontmatter
    const frontmatter: MessageFrontmatter = {
      created_at: new Date().toISOString(),
      topic: args.topic,
    };

    yield* spin(
      'Ensuring messages directory exists',
      fs.makeDirectory(messagesDir).pipe(Effect.ignore),
    );

    // Write initial file with frontmatter (without apple_note_id yet)
    const contentWithFrontmatter = stringifyFrontmatter(frontmatter, response);
    yield* spin(
      'Writing message to file: ' + fileName,
      fs.writeFile(filePath, new TextEncoder().encode(contentWithFrontmatter)),
    );

    // Export to Apple Notes and get the note ID
    const { noteId } = yield* spin(
      'Adding message to notes',
      makeAppleNoteFromMarkdown(response, { folder: 'messages' }),
    );

    // Update file with apple_note_id in frontmatter
    const finalContent = updateFrontmatter(contentWithFrontmatter, {
      apple_note_id: noteId,
    });
    yield* fs.writeFile(filePath, new TextEncoder().encode(finalContent));

    const totalTime = msToMinutes(Date.now() - startTime);
    yield* Effect.log(`Message generated successfully! (Total time: ${totalTime})`);
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

const reviseMessage = Command.make('revise', { model, file, instructions }, (args) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    const rawContent = yield* fs
      .readFile(args.file)
      .pipe(Effect.map((i) => new TextDecoder().decode(i)));

    // Parse frontmatter to preserve it and check for apple_note_id
    const { frontmatter, content: message } = parseFrontmatter<MessageFrontmatter>(rawContent);

    const systemMessagePrompt = yield* fs
      .readFile(getPromptPath('messages', 'generate.md'))
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

    // Preserve frontmatter with revised content
    const finalContent = stringifyFrontmatter(frontmatter, revisedMessage);
    yield* fs.writeFile(args.file, new TextEncoder().encode(finalContent));

    // If we have an apple_note_id, update the existing note
    const appleNoteId = frontmatter.apple_note_id;
    if (typeof appleNoteId === 'string') {
      yield* spin('Updating Apple Note', updateAppleNoteFromMarkdown(appleNoteId, revisedMessage));
    }

    yield* Effect.log(`Message revised successfully!`);
    yield* Effect.log(`Output: ${args.file}`);
  }),
);

const noteId = Options.text('note-id').pipe(
  Options.withAlias('n'),
  Options.withDescription('Apple Note ID to generate from'),
);

const generateFromNoteMessage = Command.make('from-note', { model, noteId }, (args) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const startTime = Date.now();
    const note = yield* getNoteContent(args.noteId);

    const systemPrompt = yield* fs
      .readFile(getPromptPath('messages', 'generate.md'))
      .pipe(Effect.map((i) => new TextDecoder().decode(i)));

    const { filename, response } = yield* generate(systemPrompt, note).pipe(
      Effect.provideService(Model, args.model),
    );

    const messagesDir = getOutputsPath('messages');

    const fileName = `${format(new Date(), 'yyyy-MM-dd')}-${filename}.md`;
    const filePath = join(messagesDir, fileName);

    // Create frontmatter
    const frontmatter: MessageFrontmatter = {
      created_at: new Date().toISOString(),
      topic: `from-note:${args.noteId}`,
    };

    yield* spin(
      'Ensuring messages directory exists',
      fs.makeDirectory(messagesDir).pipe(Effect.ignore),
    );

    // Write initial file with frontmatter
    const contentWithFrontmatter = stringifyFrontmatter(frontmatter, response);
    yield* spin(
      'Writing message to file: ' + fileName,
      fs.writeFile(filePath, new TextEncoder().encode(contentWithFrontmatter)),
    );

    // Export to Apple Notes and get the note ID
    const { noteId: appleNoteId } = yield* spin(
      'Adding message to notes',
      makeAppleNoteFromMarkdown(response, { folder: 'messages' }),
    );

    // Update file with apple_note_id in frontmatter
    const finalContent = updateFrontmatter(contentWithFrontmatter, {
      apple_note_id: appleNoteId,
    });
    yield* fs.writeFile(filePath, new TextEncoder().encode(finalContent));

    const totalTime = msToMinutes(Date.now() - startTime);
    yield* Effect.log(`Message generated successfully! (Total time: ${totalTime})`);
    yield* Effect.log(`Output: ${filePath}`);
  }),
);

class GenerateTopicResponseError extends Data.TaggedError('GenerateTopicResponseError')<{
  cause: unknown;
}> {}

const generateTopic = Command.make('generate-topic', { model }, (args) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    const previousMessages = yield* fs.readDirectory(getOutputsPath('messages'));

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
    const encodeJson = Schema.encode(Schema.parseJson({ space: 2 }));

    const messagesDir = getOutputsPath('messages');
    const files = yield* fs
      .readDirectory(messagesDir)
      .pipe(Effect.catchAll(() => Effect.succeed([] as string[])));

    const filePaths = files
      .filter((f) => f.endsWith('.md'))
      .map((file) => join(messagesDir, file))
      .sort((a, b) => b.localeCompare(a));

    if (args.json) {
      const jsonOutput = yield* encodeJson(filePaths);
      yield* Effect.log(jsonOutput);
    } else {
      if (filePaths.length === 0) {
        yield* Effect.log('No messages found.');
      } else {
        yield* Effect.log('Messages:');
        for (const filePath of filePaths) {
          const basename = filePath.split('/').pop() ?? filePath;
          yield* Effect.log(`  ${basename}`);
        }
      }
    }
  }),
);

const dryRun = Options.boolean('dry-run').pipe(
  Options.withDefault(false),
  Options.withDescription('Show what would be synced without making changes'),
);

const syncMessages = Command.make('sync', { dryRun }, (args) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    const messagesDir = getOutputsPath('messages');
    const files = yield* fs
      .readDirectory(messagesDir)
      .pipe(Effect.catchAll(() => Effect.succeed([] as string[])));

    const mdFiles = files.filter((f) => f.endsWith('.md')).map((file) => join(messagesDir, file));

    if (mdFiles.length === 0) {
      yield* Effect.log('No messages found to sync.');
      return;
    }

    yield* Effect.log(`Found ${mdFiles.length} message files to check...`);

    let synced = 0;
    let skipped = 0;
    let notFound = 0;

    for (const filePath of mdFiles) {
      const rawContent = yield* fs
        .readFile(filePath)
        .pipe(Effect.map((i) => new TextDecoder().decode(i)));

      const { frontmatter, content } = parseFrontmatter<MessageFrontmatter>(rawContent);

      // Skip if already has apple_note_id
      if (frontmatter.apple_note_id) {
        skipped++;
        continue;
      }

      // Extract title from markdown content
      const titleOption = extractTitleFromMarkdown(content);
      if (Option.isNone(titleOption)) {
        yield* Effect.log(`⚠️  No title found in ${filePath.split('/').pop()}`);
        notFound++;
        continue;
      }

      const title = titleOption.value;

      // Search for matching note in Apple Notes
      const noteIdOption = yield* findNoteByTitle(title, 'messages');

      if (Option.isNone(noteIdOption)) {
        yield* Effect.log(`📭 No matching note for: ${title}`);
        notFound++;
        continue;
      }

      const noteId = noteIdOption.value;

      if (args.dryRun) {
        yield* Effect.log(`🔗 Would sync: ${title} → ${noteId}`);
        synced++;
        continue;
      }

      // Update frontmatter with the found note ID
      const updatedContent = updateFrontmatter(rawContent, {
        apple_note_id: noteId,
      });
      yield* fs.writeFile(filePath, new TextEncoder().encode(updatedContent));
      yield* Effect.log(`✅ Synced: ${title} → ${noteId}`);
      synced++;
    }

    yield* Effect.log('');
    yield* Effect.log('Sync complete:');
    yield* Effect.log(`  ✅ Synced: ${synced}`);
    yield* Effect.log(`  ⏭️  Skipped (already synced): ${skipped}`);
    yield* Effect.log(`  📭 Not found in Notes: ${notFound}`);
  }),
);

export const messages = Command.make('messages').pipe(
  Command.withSubcommands([
    generateMessage,
    reviseMessage,
    generateFromNoteMessage,
    generateTopic,
    listMessages,
    syncMessages,
  ]),
);
