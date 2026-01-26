import { $ } from 'bun';
import { Context, Effect, Layer } from 'effect';
import type { UnknownException } from 'effect/Cause';
import { join } from 'path';

import { getCliRoot } from '~/src/lib/paths';

/**
 * Service for playing audio chimes/notifications.
 */
export interface ChimeService {
  /**
   * Play the done/notification chime.
   */
  readonly play: Effect.Effect<void, UnknownException>;
}

export class Chime extends Context.Tag('@bible/cli/services/chime')<Chime, ChimeService>() {}

/**
 * Live implementation using Bun shell to call afplay.
 */
export const ChimeLive = Layer.succeed(Chime, {
  play: Effect.gen(function* () {
    const assetPath = join(getCliRoot(), 'assets', 'notification.mp3');

    yield* Effect.tryPromise(async () => await $`afplay ${assetPath} -v 0.15`);
  }),
});
