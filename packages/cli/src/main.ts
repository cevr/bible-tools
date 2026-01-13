/**
 * Bible Tools CLI Entry Point
 *
 * Supports two modes:
 * - CLI mode: Fast, lightweight commands (concordance, verse, egw, etc.)
 * - TUI mode: Interactive terminal UI (default)
 *
 * CLI mode lazy-loads TUI and AI dependencies for faster startup.
 */

import type { EGWReference } from '@bible/core/app';
import { isSearchQuery, parseEGWRef } from '@bible/core/egw';
import { Command } from '@effect/cli';
// Core imports needed for both CLI and TUI
import { BunContext, BunRuntime } from '@effect/platform-bun';
import { Effect, Layer } from 'effect';

// Lightweight CLI command imports (no TUI dependencies)
import { AppleScriptLive } from './services/apple-script.js';
import { concordance, verse } from './commands/bible.js';
import { ChimeLive } from './services/chime.js';
import { egwWithSubcommands } from './commands/egw.js';
import { exportOutput } from './commands/export.js';
import { messages } from './commands/messages.js';
import { readings } from './commands/readings.js';
import { sabbathSchool } from './commands/sabbath-school.js';
import { studies } from './commands/studies.js';
// Types only (no runtime cost)
import type { Reference } from './data/bible/types.js';
import {
  printSummary,
  trace,
  traceAsync,
  traceSync,
} from './instrumentation/trace.js';
import type { ModelService } from './tui/context/model.js';

trace('process start');

trace('core imports complete');

trace('CLI command imports complete');

// Check if any CLI subcommand is specified
const cliSubcommands = [
  'concordance',
  'verse',
  'egw',
  'messages',
  'sabbath-school',
  'studies',
  'readings',
  'export',
];
const args = process.argv.slice(2);
const hasSubcommand = args.some((arg) => cliSubcommands.includes(arg));
const isOpenCommand = args[0] === 'open';
const isEgwOpenCommand = args[0] === 'egw' && args[1] === 'open';
const isTuiMode =
  (!hasSubcommand && !isOpenCommand) || isOpenCommand || isEgwOpenCommand;

trace('arg parsing complete', {
  mode: hasSubcommand ? 'cli' : isTuiMode ? 'tui' : 'unknown',
});

// Lazy imports for TUI mode only
async function loadTuiDependencies() {
  trace('loading TUI dependencies');

  const [
    { tui },
    { BibleDataLive, BibleData },
    { detectSystemThemeAsync },
    aiSdk,
  ] = await Promise.all([
    traceAsync('import tui', () => import('./tui/app.js')),
    traceAsync('import bible/data', () => import('./data/bible/data.js')),
    traceAsync('import themes', () => import('./tui/themes/index.js')),
    traceAsync('import AI SDKs', () => loadAiSdks()),
  ]);

  trace('TUI dependencies loaded');

  return { tui, BibleDataLive, BibleData, detectSystemThemeAsync, ...aiSdk };
}

// Lazy load AI SDKs
async function loadAiSdks() {
  const [{ createGoogleGenerativeAI }, { createOpenAI }, { createAnthropic }] =
    await Promise.all([
      import('@ai-sdk/google'),
      import('@ai-sdk/openai'),
      import('@ai-sdk/anthropic'),
    ]);

  return { createGoogleGenerativeAI, createOpenAI, createAnthropic };
}

// Create model service from environment variables
function tryCreateModelService(
  aiSdk: Awaited<ReturnType<typeof loadAiSdks>>,
): ModelService | null {
  const { createGoogleGenerativeAI, createOpenAI, createAnthropic } = aiSdk;

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

// Parse a verse reference from the command line (lazy loads BibleData)
async function parseReferenceFromArgs(
  args: string[],
): Promise<Reference | undefined> {
  if (args.length === 0) return undefined;

  const refString = args.join(' ');

  const { BibleDataLive, BibleData } = await traceAsync(
    'import bible/data for parsing',
    () => import('./data/bible/data.js'),
  );

  const result = traceSync('parseReference', () =>
    Effect.runSync(Effect.provide(BibleData, BibleDataLive)).parseReference(
      refString,
    ),
  );

  return result;
}

// Parse an EGW reference from the command line
function parseEgwReferenceFromArgs(args: string[]): EGWReference | undefined {
  if (args.length === 0) return undefined;

  const refString = args.join(' ');
  const parsed = parseEGWRef(refString);

  if (isSearchQuery(parsed)) {
    return undefined;
  }

  // Convert parsed reference to EGWReference for router
  return {
    bookCode: parsed.bookCode,
    page:
      'page' in parsed
        ? parsed.page
        : 'pageStart' in parsed
          ? parsed.pageStart
          : undefined,
    paragraph:
      'paragraph' in parsed
        ? parsed.paragraph
        : 'paragraphStart' in parsed
          ? parsed.paragraphStart
          : undefined,
  };
}

async function main() {
  trace('main() start');

  // Handle egw open command - launches TUI at EGW location
  if (isEgwOpenCommand) {
    trace('TUI mode (egw open command)');

    const refArgs = args.slice(2); // Skip "egw" and "open"
    const egwRef = parseEgwReferenceFromArgs(refArgs);

    if (refArgs.length > 0 && !egwRef) {
      console.error(`Could not parse EGW reference: "${refArgs.join(' ')}"`);
      console.error('Examples: PP 351.1, DA 1, GC 100');
      process.exit(1);
    }

    const deps = await loadTuiDependencies();

    await traceAsync('detectSystemTheme', deps.detectSystemThemeAsync);
    const model = traceSync('createModelService', () =>
      tryCreateModelService(deps),
    );

    // Pass empty object to signal "go to EGW route" even without a specific reference
    // The EGW navigation context will load from saved state if no ref is provided
    await traceAsync('tui', () =>
      deps.tui({ initialEgwRef: egwRef ?? {}, model }),
    );
    printSummary();
    return;
  }

  if (hasSubcommand) {
    // CLI mode - fast path, no TUI/AI dependencies
    trace('CLI mode');

    const command = traceSync('Command.make', () =>
      Command.make('bible').pipe(
        Command.withSubcommands([
          concordance,
          verse,
          egwWithSubcommands,
          messages,
          sabbathSchool,
          studies,
          readings,
          exportOutput,
        ]),
      ),
    );

    const cli = traceSync('Command.run', () =>
      Command.run(command, {
        name: 'Bible Tools',
        version: 'v1.0.0',
      }),
    );

    const ServicesLayer = Layer.mergeAll(
      AppleScriptLive,
      ChimeLive,
      BunContext.layer,
    );

    trace('starting Effect execution');

    cli(process.argv).pipe(
      Effect.tap(() => Effect.sync(() => trace('Effect execution complete'))),
      Effect.provide(ServicesLayer),
      Effect.ensuring(Effect.sync(() => printSummary())),
      BunRuntime.runMain,
    );
  } else if (isOpenCommand) {
    // TUI mode with specific Bible reference
    trace('TUI mode (open command)');

    const refArgs = args.slice(1);
    const ref = await parseReferenceFromArgs(refArgs);

    if (refArgs.length > 0 && !ref) {
      console.error(`Could not parse reference: "${refArgs.join(' ')}"`);
      console.error('Examples: john 3:16, gen 1:1, 1 cor 13, psalms');
      process.exit(1);
    }

    const deps = await loadTuiDependencies();

    await traceAsync('detectSystemTheme', deps.detectSystemThemeAsync);
    const model = traceSync('createModelService', () =>
      tryCreateModelService(deps),
    );

    await traceAsync('tui', () => deps.tui({ initialRef: ref, model }));
    printSummary();
  } else {
    // Default TUI mode
    trace('TUI mode (default)');

    const deps = await loadTuiDependencies();

    await traceAsync('detectSystemTheme', deps.detectSystemThemeAsync);
    const model = traceSync('createModelService', () =>
      tryCreateModelService(deps),
    );

    await traceAsync('tui', () => deps.tui({ model }));
    printSummary();
  }
}

main().catch(console.error);
