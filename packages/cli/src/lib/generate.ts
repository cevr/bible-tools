import type { ToolSet } from 'ai';
import { Data, Effect, Schedule } from 'effect';

import { AI } from '~/src/services/ai';

import { doneChime } from './done-chime';
import { spin } from './general';

class GenerateResponseError extends Data.TaggedError(
  '@bible/cli/lib/generate/GenerateResponseError',
)<{
  cause: unknown;
}> {}

class GenerateFilenameError extends Data.TaggedError(
  '@bible/cli/lib/generate/GenerateFilenameError',
)<{
  cause: unknown;
}> {}

/**
 * Generate content using AI.
 * Returns the generated content and a filename suggestion.
 * Note: This function no longer handles revisions - use the revise function separately if needed.
 */
export const generate = Effect.fn('generate')(function* (
  systemPrompt: string,
  prompt: string,
  options?: { skipChime?: boolean; tools?: ToolSet; maxSteps?: number },
) {
  const ai = yield* AI;

  const generateEffect =
    options?.tools !== undefined
      ? ai.generateTextWithTools({
          model: 'high',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          tools: options.tools,
          maxSteps: options.maxSteps,
        })
      : ai.generateText({
          model: 'high',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
        });

  const response = yield* spin(
    'Generating...',
    generateEffect.pipe(
      Effect.mapError(
        (cause) =>
          new GenerateResponseError({
            cause,
          }),
      ),
      Effect.retry({
        times: 3,
        schedule: Schedule.spaced(500),
      }),
    ),
  );

  const message = response.text;

  yield* Effect.logDebug(`response: \n\n ${message}`);

  const filename = yield* ai
    .generateText({
      model: 'low',
      messages: [
        {
          role: 'system',
          content:
            'Generate a filename for the following SDA bible study message. Kebab case. No extension. IMPORTANT: Only the filename, no other text. eg: christ-in-me-the-hope-of-glory',
        },
        { role: 'user', content: message },
      ],
    })
    .pipe(
      Effect.mapError(
        (cause) =>
          new GenerateFilenameError({
            cause,
          }),
      ),
    );

  if (options?.skipChime !== true) {
    yield* doneChime;
  }

  return {
    filename: filename.text,
    response: response.text,
  };
});
