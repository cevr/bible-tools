import path from 'path';

import { Path } from '@effect/platform';
import { Layer } from 'effect';

import {
  createMockAppleScriptLayer,
  type MockAppleScriptConfig,
  type MockAppleScriptState,
} from './mock-apple-script.js';
import {
  createMockBunShell,
  createMockBunSpawn,
  type MockBunConfig,
} from './mock-bun.js';
import { createMockChimeLayer, type MockChimeState } from './mock-chime.js';
import {
  createMockFileSystemLayer,
  type MockFileSystemConfig,
} from './mock-filesystem.js';
import {
  installMockFetch,
  type MockHttpConfig,
  type MockHttpState,
} from './mock-http.js';
import { createMockModelLayer, type MockModelConfig } from './mock-model.js';
import { CallSequenceLayer, type ServiceCall } from './sequence-recorder.js';

/**
 * Configuration for creating a test layer.
 */
export interface TestLayerConfig {
  /** Mock file system state */
  files?: MockFileSystemConfig;
  /** Mock model responses */
  model?: MockModelConfig;
  /** Mock HTTP responses */
  http?: MockHttpConfig;
  /** Mock Bun configuration (legacy - prefer appleScript for new tests) */
  bun?: MockBunConfig;
  /** Mock AppleScript configuration */
  appleScript?: MockAppleScriptConfig;
}

/**
 * State returned from creating a test layer.
 * Includes cleanup functions and mutable state for assertions.
 */
export interface TestLayerState {
  /** Call the cleanup function when done with the test */
  cleanup: () => void;
  /** The composed layer to provide to the CLI */
  layer: Layer.Layer<
    | import('@effect/platform').FileSystem.FileSystem
    | import('@effect/platform').Path.Path
    | import('../../core/model.js').Model
    | import('../../core/apple-script.js').AppleScript
    | import('../../core/chime.js').Chime
    | import('./sequence-recorder.js').CallSequence,
    never,
    never
  >;
  /** Get all calls recorded (from services and external) */
  getAllCalls: () => ServiceCall[];
}

/**
 * Create a composite test layer with all mocked services.
 *
 * This follows the Effect testing pattern of providing mock layers
 * for all external dependencies while running actual command logic.
 */
export const createTestLayer = (
  config: TestLayerConfig = {},
): TestLayerState => {
  const cleanupFns: Array<() => void> = [];

  // Shared state for service calls
  const appleScriptState: MockAppleScriptState = { calls: [] };
  const chimeState: MockChimeState = { calls: [] };
  let httpState: MockHttpState | null = null;

  // Create mock file system
  const mockFs = createMockFileSystemLayer(
    config.files ?? { files: {}, directories: [] },
  );

  // Create mock model
  const mockModel = createMockModelLayer(
    config.model ?? { responses: { high: [], low: [] } },
  );

  // Create mock AppleScript service
  const mockAppleScript = createMockAppleScriptLayer(
    config.appleScript ?? {},
    appleScriptState,
  );

  // Create mock Chime service
  const mockChime = createMockChimeLayer(chimeState);

  // Install mock fetch
  if (config.http) {
    const fetchResult = installMockFetch(config.http);
    httpState = fetchResult.state;
    cleanupFns.push(fetchResult.cleanup);
  }

  // Legacy: Install mock Bun globals for any code still using Bun directly
  // This can be removed once all code uses the service layers
  const bunConfig = config.bun ?? config.appleScript ?? {};
  const legacyBunState = { calls: [] as ServiceCall[] };
  const mockSpawn = createMockBunSpawn(bunConfig, legacyBunState);
  const mockShell = createMockBunShell(bunConfig, legacyBunState);

  const originalBun = globalThis.Bun;
  (globalThis as Record<string, unknown>).Bun = {
    ...((globalThis.Bun as object) ?? {}),
    spawn: mockSpawn,
    $: mockShell,
  };
  cleanupFns.push(() => {
    (globalThis as Record<string, unknown>).Bun = originalBun;
  });

  // Create a mock Path layer (use real path implementation since it's pure computation)
  const mockPath = Layer.succeed(Path.Path, {
    ...path,
    fromFileUrl: (url: URL | string) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      return urlStr.replace('file://', '');
    },
    toFileUrl: (p: string) => new URL(`file://${p}`),
  } as Path.Path);

  // Compose all layers
  const composedLayer = Layer.mergeAll(
    CallSequenceLayer,
    mockFs.layer,
    mockModel.layer,
    mockAppleScript,
    mockChime,
    mockPath,
  );

  return {
    layer: composedLayer,
    cleanup: () => {
      for (const fn of cleanupFns) {
        fn();
      }
    },
    getAllCalls: () => [
      // Service layer calls (recorded via Effect context)
      ...appleScriptState.calls,
      ...chimeState.calls,
      // External calls (recorded outside Effect context)
      ...mockModel.state.calls,
      ...(httpState?.calls ?? []),
      ...legacyBunState.calls,
    ],
  };
};
