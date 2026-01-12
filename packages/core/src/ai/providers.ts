import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import { type LanguageModel } from 'ai';
import { Effect, Option, Schema } from 'effect';

/**
 * Supported AI providers.
 */
export enum Provider {
  Gemini = 'gemini',
  OpenAI = 'openai',
  Anthropic = 'anthropic',
  Kimi = 'kimi',
}

/**
 * Model configuration with high and low quality options.
 */
export interface ModelConfig {
  readonly high: LanguageModel;
  readonly low: LanguageModel;
}

/**
 * Provider configuration with models and provider identifier.
 */
export interface ProviderConfig {
  readonly models: ModelConfig;
  readonly provider: Provider;
}

/**
 * Discovers available AI providers from environment configuration.
 * Returns all providers that have valid API keys configured.
 */
export const discoverProviders = Effect.fn('discoverProviders')(function* () {
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
          } satisfies ProviderConfig;
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
          } satisfies ProviderConfig;
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
          } satisfies ProviderConfig;
        }),
      ),
    ),
  );

  const kimi = yield* Schema.Config('GROQ_API_KEY', Schema.NonEmptyString).pipe(
    Effect.option,
    Effect.map((groqKey) =>
      groqKey.pipe(
        Option.map((groqKey) => {
          const modelProvider = createGroq({ apiKey: groqKey });
          return {
            models: {
              high: modelProvider('moonshotai/kimi-k2-instruct'),
              low: modelProvider('moonshotai/kimi-k2-instruct'),
            },
            provider: Provider.Kimi,
          } satisfies ProviderConfig;
        }),
      ),
    ),
  );

  const providers: Option.Option<ProviderConfig>[] = [
    google,
    openai,
    anthropic,
    kimi,
  ];

  return Option.reduceCompact(
    providers,
    [] as ProviderConfig[],
    (acc, model) => [...acc, model],
  );
});

/**
 * Gets the display name for a provider.
 */
export const getProviderName = (provider: Provider): string => {
  switch (provider) {
    case Provider.Gemini:
      return 'Gemini';
    case Provider.OpenAI:
      return 'OpenAI';
    case Provider.Anthropic:
      return 'Anthropic';
    case Provider.Kimi:
      return 'Kimi';
  }
};
