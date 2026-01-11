/**
 * Bun shim for vitest.
 * This provides a mock implementation of the Bun module for testing.
 *
 * IMPORTANT: All functions delegate to globalThis.Bun so that test-layer.ts
 * can override them with mocks that record calls.
 */

// Spawn that delegates to globalThis.Bun.spawn (set by test-layer.ts)
const spawn = (command: string[], options?: Record<string, unknown>) => {
  // Delegate to globalThis.Bun.spawn if available (set by test mock)
  if (globalThis.Bun?.spawn) {
    return (globalThis.Bun as { spawn: typeof spawn }).spawn(command, options);
  }

  // Fallback default implementation
  return {
    stdout: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(''));
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
    pid: 12345,
    kill: () => {},
    ref: () => {},
    unref: () => {},
  };
};

// Shell mock for template literals like $`command`
// Delegates to globalThis.Bun.$ if available
const shell = (
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<{ stdout: Buffer; stderr: Buffer; exitCode: number }> => {
  // Delegate to globalThis.Bun.$ if available (set by test mock)
  if (globalThis.Bun?.$) {
    return (globalThis.Bun as { $: typeof shell }).$(strings, ...values);
  }

  // Fallback default implementation
  return Promise.resolve({
    stdout: Buffer.from(''),
    stderr: Buffer.from(''),
    exitCode: 0,
  });
};

// Default export matching Bun's API
// Uses getters so that accessing properties delegates to globalThis.Bun
const Bun = {
  get spawn() {
    return spawn;
  },
  get $() {
    return shell;
  },
  file: (path: string) => ({
    text: () => Promise.resolve(''),
    exists: () => Promise.resolve(false),
  }),
  write: (path: string, _data: unknown) => Promise.resolve(0),
  env: process.env,
  version: 'mock',
};

export default Bun;
export { spawn, shell as $ };
