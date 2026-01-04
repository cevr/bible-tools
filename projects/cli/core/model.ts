import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { HelpDoc, Options, ValidationError } from '@effect/cli';
import { type LanguageModel } from 'ai';
import { Context, Effect, Option, Schema } from 'effect';

import { matchEnum } from '../lib/general';

export enum Provider {
  Gemini = 'gemini',
  OpenAI = 'openai',
  Anthropic = 'anthropic',
}

const extractModel = Effect.fn('extractModel')(
  function* (modelOption: Option.Option<string>) {
    const google = yield* Schema.Config(
      'GEMINI_API_KEY',
      Schema.NonEmptyString,
    ).pipe(
      Effect.option,
      Effect.map((googleKey) =>
        googleKey.pipe(
          Option.map((googleKey) => {
            const modelProvider = createGoogleGenerativeAI({
              apiKey: googleKey,
            });
            return {
              models: {
                high: modelProvider('gemini-3-pro-preview'),
                low: modelProvider('gemini-2.5-flash-lite'),
              },
              provider: Provider.Gemini,
            };
          }),
        ),
      ),
    );
    const openai = yield* Schema.Config(
      'OPENAI_API_KEY',
      Schema.NonEmptyString,
    ).pipe(
      Effect.option,
      Effect.map((openaiKey) =>
        openaiKey.pipe(
          Option.map((openaiKey) => {
            const modelProvider = createOpenAI({ apiKey: openaiKey });
            return {
              models: {
                high: modelProvider('gpt-5.2'),
                low: modelProvider('gpt-4.1-nano'),
              },
              provider: Provider.OpenAI,
            };
          }),
        ),
      ),
    );
    const anthropic = yield* Schema.Config(
      'ANTHROPIC_API_KEY',
      Schema.NonEmptyString,
    ).pipe(
      Effect.option,
      Effect.map((anthropicKey) =>
        anthropicKey.pipe(
          Option.map((anthropicKey) => {
            const modelProvider = createAnthropic({ apiKey: anthropicKey });
            return {
              models: {
                high: modelProvider('claude-opus-4-5'),
                low: modelProvider('claude-haiku-4-5'),
              },
              provider: Provider.Anthropic,
            };
          }),
        ),
      ),
    );
    const models = Option.reduceCompact(
      [google, openai, anthropic],
      [] as {
        models: { high: LanguageModel; low: LanguageModel };
        provider: Provider;
      }[],
      (acc, model) => [...acc, model],
    );

    if (models.length === 0) {
      return yield* Effect.dieMessage('No model provider found');
    }

    const model = modelOption.pipe(
      Option.flatMap((model) => matchEnum(Provider, model)),
      Option.flatMap((model) =>
        Option.fromNullable(models.find((m) => m.provider === model)?.models),
      ),
    );

    return yield* Option.match(model, {
      onNone: () =>
        Effect.fail(
          ValidationError.invalidValue(
            HelpDoc.p(
              `--model is required. Available: ${models.map((m) => m.provider).join(', ')}`,
            ),
          ),
        ),
      onSome: Effect.succeed,
    });
  },
  Effect.mapError(() =>
    ValidationError.invalidArgument({
      _tag: 'Empty',
    }),
  ),
);

export const model = Options.text('model').pipe(
  Options.withAlias('m'),
  Options.optional,
  Options.mapEffect(extractModel),
);
export class Model extends Context.Tag('Model')<
  Model,
  Effect.Effect.Success<ReturnType<typeof extractModel>>
>() {}
