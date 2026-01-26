import Bun from 'bun';
import { Context, Effect, Layer } from 'effect';
import type { UnknownException } from 'effect/Cause';

/**
 * Service for executing AppleScript commands.
 */
export interface AppleScriptService {
  /**
   * Execute an AppleScript command.
   * @param script The AppleScript code to execute
   * @returns The stdout output from the script
   */
  readonly exec: (script: string) => Effect.Effect<string, UnknownException>;
}

export class AppleScript extends Context.Tag('@bible/cli/services/apple-script/AppleScript')<
  AppleScript,
  AppleScriptService
>() {}

/**
 * Live implementation using Bun.spawn to call osascript.
 */
export const AppleScriptLive = Layer.succeed(AppleScript, {
  exec: (script: string) =>
    Effect.gen(function* () {
      const result = yield* Effect.try(() => {
        const child = Bun.spawn(['osascript', '-e', script]);
        return child;
      });

      const text = yield* Effect.tryPromise(async () => {
        return await new Response(result.stdout).text();
      });

      return text;
    }),
});
