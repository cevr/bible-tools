import { Options, ValidationError } from '@effect/cli';
import { select } from '@effect/cli/Prompt';
import { Context, Effect, Option } from 'effect';
import { matchSorter } from 'match-sorter';

import {
  AiService,
  discoverProviders,
  getProviderName,
  type ModelConfig,
  Provider,
} from '@bible/core/ai';

/**
 * Match a string value against an enum.
 */
function matchEnum<T extends Record<string, string | number>>(
  enumToParse: T,
  value: string,
) {
  const entries = Object.entries(enumToParse).map(([k, v]) => ({
    value: v as T[keyof T],
    labels: [enumToParse[k as keyof T], enumToParse[v as keyof T]],
  }));
  const matched = matchSorter(entries, value.toString(), {
    keys: ['labels'],
  })[0]?.value;
  return Option.fromNullable(matched);
}

/**
 * Extract model configuration from command line option.
 * If no model specified, prompts user to select from available providers.
 */
const extractModel = (modelOption: Option.Option<string>) =>
  Effect.gen(function* () {
    const providers = yield* discoverProviders();

    if (providers.length === 0) {
      return yield* Effect.dieMessage(
        'No model provider found. Please set one of: GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or GROQ_API_KEY',
      );
    }

    // Try to match specified provider
    const model = modelOption.pipe(
      Option.flatMap((m) => matchEnum(Provider, m)),
      Option.flatMap((provider) =>
        Option.fromNullable(
          providers.find((p) => p.provider === provider)?.models,
        ),
      ),
    );

    // If no match, prompt user to select
    return yield* Option.match(model, {
      onNone: () =>
        select({
          message: 'Select a model',
          choices: providers.map((p) => ({
            value: p.models,
            title: getProviderName(p.provider),
          })),
        }),
      onSome: Effect.succeed,
    });
  }).pipe(
    Effect.withSpan('extractModel'),
    Effect.mapError(() =>
      ValidationError.invalidArgument({
        _tag: 'Empty',
      }),
    ),
  );

/**
 * CLI option for selecting AI model provider.
 */
export const model = Options.text('model').pipe(
  Options.withAlias('m'),
  Options.optional,
  Options.mapEffect(extractModel),
);

/**
 * Context tag for the selected model configuration.
 * Use this to provide the selected model to services that need it.
 */
export class Model extends Context.Tag('Model')<
  Model,
  Effect.Effect.Success<ReturnType<typeof extractModel>>
>() {}

/**
 * Create an AiService layer from the selected model configuration.
 */
export const makeAiServiceLayer = (config: ModelConfig) =>
  AiService.of(config);
