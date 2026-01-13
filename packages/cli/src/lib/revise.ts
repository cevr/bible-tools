import { generateText } from 'ai';
import { Data, Effect } from 'effect';
import type { NonEmptyArray } from 'effect/Array';

import { Model } from '~/src/services/model';

import { doneChime } from './done-chime';
import { spin } from './general';

class ReviewError extends Data.TaggedError('ReviewError')<{
  cause: unknown;
}> {}

interface ReviserContext {
  systemPrompt: string;
  cycles: NonEmptyArray<{ prompt: string; response: string }>;
  instructions: string;
}

/**
 * Single-shot revision function.
 * Takes the current content and revision instructions, returns revised content.
 * For multi-round revisions, call this function multiple times with updated cycles.
 */
export const revise = Effect.fn('revise')(function* ({
  cycles,
  systemPrompt,
  instructions,
}: ReviserContext) {
  const models = yield* Model;

  const reviseResponse = yield* spin(
    'Revising text',
    Effect.tryPromise({
      try: () =>
        generateText({
          model: models.high,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userRevisePrompt(cycles, instructions),
            },
          ],
        }),
      catch: (cause: unknown) =>
        new ReviewError({
          cause,
        }),
    }),
  );

  yield* doneChime;

  return reviseResponse.text;
});

export const userRevisePrompt = (
  cycles: {
    prompt: string;
    response: string;
  }[],
  revision: string,
) => `
Please revise the following text to be inline with the criteria below.
- IMPORTANT: Only return the revised text, nothing else.

<revision-cycles>
  ${cycles
    .map(
      (cycle) => `
    <cycle>
      <prompt>${cycle.prompt}</prompt>
      <response>${cycle.response}</response>
    </cycle>
  `,
    )
    .join('\n')}
</revision-cycles>

<revision>
  ${revision}
</revision>
`;
