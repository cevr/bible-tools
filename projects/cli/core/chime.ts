import { Path } from '@effect/platform';
import { $ } from 'bun';
import { Context, Effect, Layer } from 'effect';
import type { UnknownException } from 'effect/Cause';

/**
 * Service for playing audio chimes/notifications.
 */
export interface ChimeService {
  /**
   * Play the done/notification chime.
   */
  readonly play: Effect.Effect<void, UnknownException, Path.Path>;
}

export class Chime extends Context.Tag('Chime')<Chime, ChimeService>() {}

/**
 * Live implementation using Bun shell to call afplay.
 */
export const ChimeLive = Layer.succeed(Chime, {
  play: Effect.gen(function* () {
    const path = yield* Path.Path;
    const assetPath = path.join(process.cwd(), 'assets', 'notification.mp3');

    yield* Effect.tryPromise(async () => await $`afplay ${assetPath} -v 0.15`);
  }),
});
