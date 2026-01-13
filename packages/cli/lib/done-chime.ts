import { Effect } from 'effect';

import { Chime } from '~/commands/chime';

/**
 * Play the done/notification chime.
 * Uses the Chime service for proper dependency injection.
 */
export const doneChime = Effect.gen(function* () {
  const chime = yield* Chime;
  yield* chime.play;
});
