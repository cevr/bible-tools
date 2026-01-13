import { vi } from 'vitest';

// Set up mock environment variables before any tests run
// This is needed because the model extraction reads from env
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

// Mock the 'ai' package for generateText/generateObject
// The actual mock implementations are provided by test layers
vi.mock('ai', () => ({
  generateText: vi.fn(),
  generateObject: vi.fn(),
}));

// Mock the AI SDK providers to return our mock models
vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: () => (modelId: string) => ({
    specificationVersion: 'v1',
    provider: 'google',
    modelId,
    defaultObjectGenerationMode: 'json',
  }),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: () => (modelId: string) => ({
    specificationVersion: 'v1',
    provider: 'openai',
    modelId,
    defaultObjectGenerationMode: 'json',
  }),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: () => (modelId: string) => ({
    specificationVersion: 'v1',
    provider: 'anthropic',
    modelId,
    defaultObjectGenerationMode: 'json',
  }),
}));
