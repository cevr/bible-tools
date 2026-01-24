import type { ServiceCall } from './sequence-recorder.js';

/**
 * Configuration for mock Bun.spawn/$ responses.
 */
export interface MockBunConfig {
  /** Whether AppleScript commands should succeed */
  appleScriptSuccess?: boolean;
  /** Response text from AppleScript */
  appleScriptResponse?: string;
}

/**
 * State for tracking Bun calls.
 */
export interface MockBunState {
  calls: ServiceCall[];
}

/**
 * Create mock Bun.spawn that records calls and returns mock responses.
 * Used for mocking osascript (AppleScript) and afplay (chime) commands.
 */
export const createMockBunSpawn = (config: MockBunConfig = {}, state: MockBunState) => {
  return (command: string[], _options?: Record<string, unknown>) => {
    const [cmd, ...args] = command;

    // Handle osascript (AppleScript)
    if (cmd === 'osascript') {
      const script = args.find((a, i) => args[i - 1] === '-e') ?? '';

      // Record the call to shared state
      state.calls.push({ _tag: 'AppleScript.exec', script: String(script) });

      const response = config.appleScriptResponse ?? 'Success';
      const success = config.appleScriptSuccess ?? true;

      return {
        stdout: new ReadableStream({
          start(controller) {
            if (success) {
              controller.enqueue(new TextEncoder().encode(response));
            }
            controller.close();
          },
        }),
        stderr: new ReadableStream({
          start(controller) {
            if (!success) {
              controller.enqueue(new TextEncoder().encode('Error'));
            }
            controller.close();
          },
        }),
        exitCode: success ? 0 : 1,
        exited: Promise.resolve(success ? 0 : 1),
        pid: 12345,
        kill: () => {},
        ref: () => {},
        unref: () => {},
      };
    }

    // Handle afplay (done chime) - just mock success
    if (cmd === 'afplay') {
      state.calls.push({ _tag: 'Chime.play' });

      return {
        stdout: new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
        stderr: new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
        exitCode: 0,
        exited: Promise.resolve(0),
        pid: 12346,
        kill: () => {},
        ref: () => {},
        unref: () => {},
      };
    }

    // Unknown command - return failure
    console.warn(`Mock Bun.spawn: Unknown command: ${cmd}`);
    return {
      stdout: new ReadableStream(),
      stderr: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Unknown command'));
          controller.close();
        },
      }),
      exitCode: 1,
      exited: Promise.resolve(1),
      pid: 0,
      kill: () => {},
      ref: () => {},
      unref: () => {},
    };
  };
};

/**
 * Create mock Bun.$ tagged template function.
 * Used for shell commands like `$\`afplay ${path}\``.
 */
export const createMockBunShell = (_config: MockBunConfig = {}, state: MockBunState) => {
  return (strings: TemplateStringsArray, ...values: unknown[]) => {
    // Reconstruct the command string
    let command = strings[0];
    for (let i = 0; i < values.length; i++) {
      command += String(values[i]) + strings[i + 1];
    }

    // Handle afplay
    if (command.startsWith('afplay')) {
      state.calls.push({ _tag: 'Chime.play' });
      return Promise.resolve({
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
        exitCode: 0,
      });
    }

    console.warn(`Mock Bun.$: Unknown command: ${command}`);
    return Promise.resolve({
      stdout: Buffer.from(''),
      stderr: Buffer.from('Unknown command'),
      exitCode: 1,
    });
  };
};
