import { mock } from 'bun:test';

// Set up mock environment variables before any tests run
// This is needed because the model extraction reads from env
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

// Mock the 'ai' package for generateText/generateObject
// The actual mock implementations are provided by test layers
mock.module('ai', () => ({
  generateText: mock(),
  generateObject: mock(),
}));

// Mock the AI SDK providers to return our mock models
mock.module('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: () => (modelId: string) => ({
    specificationVersion: 'v1',
    provider: 'google',
    modelId,
    defaultObjectGenerationMode: 'json',
  }),
}));

mock.module('@ai-sdk/openai', () => ({
  createOpenAI: () => (modelId: string) => ({
    specificationVersion: 'v1',
    provider: 'openai',
    modelId,
    defaultObjectGenerationMode: 'json',
  }),
}));

mock.module('@ai-sdk/anthropic', () => ({
  createAnthropic: () => (modelId: string) => ({
    specificationVersion: 'v1',
    provider: 'anthropic',
    modelId,
    defaultObjectGenerationMode: 'json',
  }),
}));
