import type { LanguageModel } from 'ai';
import { generateObject, generateText } from 'ai';
import { Layer } from 'effect';
import { vi } from 'vitest';

import { Model } from '../../commands/model.js';
import type { ServiceCall } from './sequence-recorder.js';

/**
 * Configuration for mock model responses.
 */
export interface MockModelConfig {
  /** Queued responses for each model quality level */
  responses: {
    high: Array<string | object>;
    low: Array<string | object>;
  };
}

/**
 * State for tracking response indices and calls.
 */
export interface MockModelState {
  highIndex: number;
  lowIndex: number;
  calls: ServiceCall[];
}

/**
 * Create a mock Model layer that records all AI calls.
 *
 * Since the CLI uses the `ai` package's generateText/generateObject functions
 * with the Model service providing LanguageModel instances, we need to:
 * 1. Mock the generateText/generateObject functions via vi.mock
 * 2. Provide a mock Model layer that provides mock LanguageModel instances
 * 3. Record calls to track what was invoked (via shared state, not Effect context)
 */
export const createMockModelLayer = (config: MockModelConfig) => {
  const state: MockModelState = {
    highIndex: 0,
    lowIndex: 0,
    calls: [],
  };

  // Create mock language models that identify themselves
  const createMockLanguageModel = (quality: 'high' | 'low'): LanguageModel =>
    ({
      specificationVersion: 'v1' as const,
      provider: 'mock',
      modelId: `mock-${quality}`,
      defaultObjectGenerationMode: 'json' as const,
      // These won't be called directly - generateText/generateObject are mocked
    }) as unknown as LanguageModel;

  // High-quality model IDs from production code (core/model.ts)
  const highQualityModels = [
    'gemini-3-pro-preview', // Google high
    'gpt-5.2', // OpenAI high
    'claude-opus-4-5', // Anthropic high
    'mock-high', // Test mock
  ];

  // Determine quality from model ID
  const getQuality = (modelId: string): 'high' | 'low' => {
    return highQualityModels.includes(modelId) ? 'high' : 'low';
  };

  // Configure the mocked generateText function
  vi.mocked(generateText).mockImplementation(async (options) => {
    const model = options.model as Record<string, unknown>;

    // Try multiple ways to get the modelId
    let modelId = 'unknown';
    if (typeof model === 'object' && model !== null) {
      if ('modelId' in model) {
        modelId = model.modelId as string;
      }
    }

    const quality = getQuality(modelId);
    const responses = config.responses[quality];
    const index = quality === 'high' ? state.highIndex++ : state.lowIndex++;
    const response = responses[index] ?? `mock ${quality} response ${index}`;

    // Extract prompt from messages for recording
    const prompt =
      options.messages
        ?.filter((m) => m.role === 'user')
        .map((m) => (typeof m.content === 'string' ? m.content : '[complex]'))
        .join(' ') ?? '';

    // Record the call to shared state (not Effect context)
    state.calls.push({
      _tag: 'Model.generateText',
      model: quality,
      prompt: prompt.slice(0, 100),
    });

    return {
      text: typeof response === 'string' ? response : JSON.stringify(response),
      finishReason: 'stop' as const,
      usage: { promptTokens: 0, completionTokens: 0 },
      rawCall: { rawPrompt: null, rawSettings: {} },
      response: {
        id: 'mock-response',
        timestamp: new Date(),
        modelId,
      },
      warnings: [],
      request: {},
      experimental_providerMetadata: {},
      providerMetadata: {},
      toJsonResponse: () => new Response(),
      logprobs: undefined,
      reasoning: undefined,
      reasoningDetails: undefined,
      sources: undefined,
      steps: [],
      files: undefined,
    };
  });

  // Configure the mocked generateObject function
  vi.mocked(generateObject).mockImplementation(async (options) => {
    const model = options.model as Record<string, unknown>;

    let modelId = 'unknown';
    if (typeof model === 'object' && model !== null) {
      if ('modelId' in model) {
        modelId = model.modelId as string;
      }
    }

    const quality = getQuality(modelId);
    const responses = config.responses[quality];
    const index = quality === 'high' ? state.highIndex++ : state.lowIndex++;
    const response = responses[index] ?? { result: `mock ${quality} object` };

    // Extract prompt from messages for recording
    const prompt =
      options.messages
        ?.filter((m) => m.role === 'user')
        .map((m) => (typeof m.content === 'string' ? m.content : '[complex]'))
        .join(' ') ?? '';

    // Record the call to shared state
    state.calls.push({
      _tag: 'Model.generateObject',
      model: quality,
      prompt: prompt.slice(0, 100),
    });

    return {
      object: typeof response === 'object' ? response : JSON.parse(response),
      finishReason: 'stop' as const,
      usage: { promptTokens: 0, completionTokens: 0 },
      rawCall: { rawPrompt: null, rawSettings: {} },
      response: {
        id: 'mock-response',
        timestamp: new Date(),
        modelId,
      },
      warnings: [],
      request: {},
      experimental_providerMetadata: {},
      providerMetadata: {},
      toJsonResponse: () => new Response(),
      logprobs: undefined,
    };
  });

  return {
    layer: Layer.succeed(Model, {
      high: createMockLanguageModel('high'),
      low: createMockLanguageModel('low'),
    }),
    state,
  };
};

/**
 * Reset all mock implementations.
 * Call this in beforeEach to ensure clean state.
 */
export const resetModelMocks = () => {
  vi.mocked(generateText).mockReset();
  vi.mocked(generateObject).mockReset();
};
