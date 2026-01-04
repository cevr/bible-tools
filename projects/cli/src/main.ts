import { BunContext, BunRuntime } from '@effect/platform-bun';
import { Command } from '@effect/cli';
import { Effect } from 'effect';

import { exportOutput } from '../core/export-output.js';
import { messages } from '../core/messages/messages.js';
import { readings } from '../core/readings/readings.js';
import { sabbathSchool } from '../core/sabbath-school/sabbath-school.js';
import { studies } from '../core/studies/studies.js';

// Check if any CLI subcommand is specified
const cliSubcommands = ['messages', 'sabbath-school', 'studies', 'readings', 'export'];
const hasSubcommand = process.argv.slice(2).some((arg) =>
  cliSubcommands.includes(arg),
);

async function main() {
  if (hasSubcommand) {
    // CLI mode - run the Effect CLI commands
    const command = Command.make('bible-tools').pipe(
      Command.withSubcommands([
        messages,
        sabbathSchool,
        studies,
        readings,
        exportOutput,
      ]),
    );

    const cli = Command.run(command, {
      name: 'Bible Tools',
      version: 'v1.0.0',
    });

    cli(process.argv).pipe(Effect.provide(BunContext.layer), BunRuntime.runMain);
  } else {
    // TUI mode - launch the interactive terminal UI
    const { tui } = await import('./tui/app.js');
    await tui();
  }
}

main().catch(console.error);
