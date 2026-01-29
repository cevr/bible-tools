/* eslint-disable @typescript-eslint/no-explicit-any */
import type { LanguageModel } from 'ai';
import { generateObject as aiGenerateObject, generateText as aiGenerateText } from 'ai';
import { Context, Effect, Layer, Option, Schema } from 'effect';
import type { Schema as ZodSchema, infer as ZodInfer } from 'zod';

import { Model } from './model';

// Tagged error for AI operations
export class AIError extends Schema.TaggedError<AIError>()('AIError', {
  operation: Schema.String,
  cause: Schema.Defect,
}) {}

type Quality = 'high' | 'low';

export type ModelService = {
  high: LanguageModel;
  low: LanguageModel;
};

interface GenerateTextOptions {
  model?: Quality;
  system?: string;
  messages: Array<{ role: string; content: unknown }>;
  maxOutputTokens?: number;
}

interface GenerateObjectOptions<T extends ZodSchema> {
  model?: Quality;
  messages: Array<{ role: string; content: unknown }>;
  schema: T;
}

export interface AIService {
  readonly generateText: (options: GenerateTextOptions) => Effect.Effect<{ text: string }, AIError>;
  readonly generateObject: <T extends ZodSchema>(
    options: GenerateObjectOptions<T>,
  ) => Effect.Effect<{ object: ZodInfer<T> }, AIError>;
}

export class AI extends Context.Tag('@bible/cli/services/ai')<AI, AIService>() {
  /**
   * Live AI layer that requires Model in context.
   * Use this for TUI and other non-CLI uses.
   */
  static readonly Live = Layer.effect(
    AI,
    Effect.gen(function* () {
      const models = yield* Model;
      return AI.#createService(models);
    }),
  );

  /**
   * Create AI layer from models, deferring to existing AI if present.
   * This allows tests to provide mock AI that takes precedence.
   */
  static fromModel(models: ModelService): Layer.Layer<AI> {
    return Layer.effect(
      AI,
      Effect.gen(function* () {
        const existing = yield* Effect.serviceOption(AI);
        if (Option.isSome(existing)) return existing.value;
        return AI.#createService(models);
      }),
    );
  }

  static #createService(models: ModelService): AIService {
    const getModel = (quality: Quality = 'high'): LanguageModel =>
      quality === 'high' ? models.high : models.low;

    return {
      generateText: (options) =>
        Effect.tryPromise({
          try: async () => {
            const result = await aiGenerateText({
              model: getModel(options.model),
              system: options.system,
              messages: options.messages as any,
              maxOutputTokens: options.maxOutputTokens,
            });
            return { text: result.text };
          },
          catch: (error) =>
            new AIError({
              operation: 'generateText',
              cause: error,
            }),
        }),

      generateObject: (options) =>
        Effect.tryPromise({
          try: async () => {
            const result = await aiGenerateObject({
              model: getModel(options.model),
              messages: options.messages as any,
              schema: options.schema,
            } as any);
            return { object: result.object as ZodInfer<typeof options.schema> };
          },
          catch: (error) =>
            new AIError({
              operation: 'generateObject',
              cause: error,
            }),
        }),
    };
  }
}
