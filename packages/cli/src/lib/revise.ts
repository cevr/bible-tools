import { Data, Effect } from 'effect';
import type { NonEmptyArray } from 'effect/Array';

import { AI } from '~/src/services/ai';

import { doneChime } from './done-chime';
import { spin } from './general';

export class ReviewError extends Data.TaggedError('@bible/cli/lib/revise/ReviewError')<{
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
  const ai = yield* AI;

  const reviseResponse = yield* spin(
    'Revising text',
    ai
      .generateText({
        model: 'high',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userRevisePrompt(cycles, instructions) },
        ],
      })
      .pipe(
        Effect.mapError(
          (cause) =>
            new ReviewError({
              cause,
            }),
        ),
      ),
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
