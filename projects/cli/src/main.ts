import { BunContext, BunRuntime } from '@effect/platform-bun';
import { Command } from '@effect/cli';
import { Effect, Layer } from 'effect';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

import { AppleScriptLive } from '../core/apple-script.js';
import { ChimeLive } from '../core/chime.js';
import { exportOutput } from '../core/export-output.js';
import { messages } from '../core/messages/messages.js';
import { readings } from '../core/readings/readings.js';
import { sabbathSchool } from '../core/sabbath-school/sabbath-school.js';
import { studies } from '../core/studies/studies.js';
import { tui } from './tui/app.js';
import { BibleDataLive, BibleData } from './bible/data.js';
import type { Reference } from './bible/types.js';
import type { ModelService } from './tui/context/model.js';
import { detectSystemThemeAsync } from './tui/themes/index.js';

// Try to create model service from environment variables
function tryCreateModelService(): ModelService | null {
  // Try Gemini first
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const provider = createGoogleGenerativeAI({ apiKey: geminiKey });
    return {
      models: {
        high: provider('gemini-3-pro-preview'),
        low: provider('gemini-2.5-flash-lite'),
      },
    };
  }

  // Try OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    const provider = createOpenAI({ apiKey: openaiKey });
    return {
      models: {
        high: provider('gpt-5.2'),
        low: provider('gpt-4.1-nano'),
      },
    };
  }

  // Try Anthropic
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    const provider = createAnthropic({ apiKey: anthropicKey });
    return {
      models: {
        high: provider('claude-opus-4-5'),
        low: provider('claude-haiku-4-5'),
      },
    };
  }

  return null;
}

// Parse a verse reference from the command line
function parseReferenceFromArgs(args: string[]): Reference | undefined {
  if (args.length === 0) return undefined;

  // Join all args to handle "john 3:16" or "1 cor 13:1"
  const refString = args.join(' ');

  // Use the BibleData service to parse
  const result = Effect.runSync(
    Effect.provide(BibleData, BibleDataLive)
  ).parseReference(refString);

  return result;
}

// Check if any CLI subcommand is specified
const cliSubcommands = ['messages', 'sabbath-school', 'studies', 'readings', 'export'];
const args = process.argv.slice(2);
const hasSubcommand = args.some((arg) => cliSubcommands.includes(arg));

// Check for 'open' command
const isOpenCommand = args[0] === 'open';

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

    const ServicesLayer = Layer.mergeAll(AppleScriptLive, ChimeLive, BunContext.layer);

    cli(process.argv).pipe(
      Effect.provide(ServicesLayer),
      BunRuntime.runMain,
    );
  } else if (isOpenCommand) {
    // bible open <reference> - open Bible at specific verse
    const refArgs = args.slice(1); // Remove 'open' from args
    const ref = parseReferenceFromArgs(refArgs);

    if (refArgs.length > 0 && !ref) {
      console.error(`Could not parse reference: "${refArgs.join(' ')}"`);
      console.error('Examples: john 3:16, gen 1:1, 1 cor 13, psalms');
      process.exit(1);
    }

    // Detect system theme before launching TUI (warms cache)
    await detectSystemThemeAsync();
    const model = tryCreateModelService();
    await tui({ initialRef: ref, model });
  } else {
    // Default TUI mode - open at last position or Genesis 1
    // Detect system theme before launching TUI (warms cache)
    await detectSystemThemeAsync();
    const model = tryCreateModelService();
    await tui({ model });
  }
}

main().catch(console.error);
