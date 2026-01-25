import { Options } from '@effect/cli';

export const topic = Options.text('topic').pipe(
  Options.withAlias('t'),
  Options.withDescription('Topic for generation'),
);

export const file = Options.file('file').pipe(
  Options.withAlias('f'),
  Options.withDescription('Path to file'),
);

export const files = Options.file('files').pipe(
  Options.withAlias('f'),
  Options.repeated,
  Options.withDescription('Files to process'),
);

export const instructions = Options.text('instructions').pipe(
  Options.withAlias('i'),
  Options.withDescription('Revision instructions'),
);

export const json = Options.boolean('json').pipe(
  Options.withDefault(false),
  Options.withDescription('Output as JSON'),
);

export const noteId = Options.text('note-id').pipe(
  Options.withAlias('n'),
  Options.withDescription('Apple Note ID'),
);

export const dryRun = Options.boolean('dry-run').pipe(
  Options.withDefault(false),
  Options.withDescription('Preview without making changes'),
);

export const folder = Options.text('folder').pipe(
  Options.withDescription('Target folder in Apple Notes'),
  Options.optional,
);
