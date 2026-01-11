import { Command } from '@effect/cli';
import { BunContext, BunRuntime } from '@effect/platform-bun';
import { Effect, Layer } from 'effect';

import { AppleScriptLive } from './apple-script';
import { bible } from './bible/bible';
import { ChimeLive } from './chime';
import { exportOutput } from './export-output';
import { messages } from './messages/messages';
import { notes } from './notes/notes';
import { readings } from './readings/readings';
import { sabbathSchool } from './sabbath-school/sabbath-school';
import { studies } from './studies/studies';

const command = Command.make('church-tools').pipe(
  Command.withSubcommands([
    bible,
    messages,
    notes,
    sabbathSchool,
    studies,
    readings,
    exportOutput,
  ]),
);
const cli = Command.run(command, {
  name: 'Church Tools',
  version: 'v1.0.0',
});

const ServicesLayer = Layer.mergeAll(AppleScriptLive, ChimeLive, BunContext.layer);

cli(process.argv).pipe(
  Effect.provide(ServicesLayer),
  BunRuntime.runMain,
);
