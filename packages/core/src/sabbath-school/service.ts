import { HttpClient } from '@effect/platform';
import { generateObject, generateText } from 'ai';
import * as cheerio from 'cheerio';
import { Context, Effect, Layer, Option } from 'effect';
import { z } from 'zod';

import { AiService } from '../ai/service.js';
import {
  DownloadError,
  MissingPdfError,
  OutlineError,
  ParseError,
  ReviewError,
  ReviseError,
} from './errors.js';
import {
  outlineSystemPrompt,
  outlineUserPrompt,
  reviewCheckSystemPrompt,
  reviewCheckUserPrompt,
  reviseSystemPrompt,
  reviseUserPrompt,
} from './prompts.js';
import { LessonContext, WeekUrls } from './schemas.js';

/**
 * SabbathSchool service for scraping, generating, and revising lesson outlines.
 */
export class SabbathSchool extends Context.Tag('@bible/sabbath-school/Service')<
  SabbathSchool,
  {
    /**
     * Find all week URLs for a given quarter.
     */
    readonly findQuarterUrls: (
      year: number,
      quarter: number,
    ) => Effect.Effect<
      readonly WeekUrls[],
      DownloadError | ParseError | MissingPdfError
    >;

    /**
     * Download a PDF file from a URL.
     */
    readonly downloadPdf: (
      url: string,
    ) => Effect.Effect<ArrayBuffer, DownloadError>;

    /**
     * Generate an outline from lesson and EGW PDFs.
     */
    readonly generateOutline: (
      context: LessonContext,
      lessonPdf: ArrayBuffer,
      egwPdf: ArrayBuffer,
    ) => Effect.Effect<string, OutlineError>;

    /**
     * Review and optionally revise an outline.
     * Returns Some(revisedOutline) if revision was needed, None otherwise.
     */
    readonly reviseOutline: (
      context: LessonContext,
      outline: string,
    ) => Effect.Effect<Option.Option<string>, ReviewError | ReviseError>;
  }
>() {
  /**
   * Default layer implementation using HttpClient and AiService.
   */
  static readonly layer = Layer.effect(
    SabbathSchool,
    Effect.gen(function* () {
      const http = yield* HttpClient.HttpClient;
      const ai = yield* AiService;

      const findQuarterUrls = (
        year: number,
        quarter: number,
      ): Effect.Effect<
        readonly WeekUrls[],
        DownloadError | ParseError | MissingPdfError
      > =>
        Effect.gen(function* () {
          const baseUrl = `https://www.sabbath.school/LessonBook?year=${year}&quarter=${quarter}`;

          const response = yield* http.get(baseUrl).pipe(
            Effect.flatMap((res) => res.text),
            Effect.mapError(
              (cause) =>
                new DownloadError({
                  url: baseUrl,
                  cause,
                }),
            ),
          );

          const $ = yield* Effect.try({
            try: () => cheerio.load(response),
            catch: (cause: unknown) =>
              new ParseError({
                url: baseUrl,
                cause,
              }),
          });

          const weekUrls: WeekUrls[] = [];
          let currentWeek = 1;
          let currentFiles: { lessonPdf?: string; egwPdf?: string } = {};

          $('a.btn-u.btn-u-sm').each((_, element) => {
            const text = $(element).text().trim();
            const href = $(element).attr('href');

            if (!href) return;

            if (text === 'Teachers PDF') {
              currentFiles.lessonPdf = href;
            } else if (text === 'EGW Notes PDF') {
              currentFiles.egwPdf = href;
            }

            if (currentFiles.lessonPdf && currentFiles.egwPdf) {
              weekUrls.push(
                new WeekUrls({
                  weekNumber: currentWeek,
                  files: {
                    lessonPdf: currentFiles.lessonPdf,
                    egwPdf: currentFiles.egwPdf,
                  },
                }),
              );
              currentWeek++;
              currentFiles = {};
            }
          });

          if (weekUrls.length === 0) {
            return yield* new MissingPdfError({ year, quarter });
          }

          return weekUrls as readonly WeekUrls[];
        }).pipe(Effect.withSpan('SabbathSchool.findQuarterUrls'));

      const downloadPdf = (
        url: string,
      ): Effect.Effect<ArrayBuffer, DownloadError> =>
        Effect.tryPromise({
          try: () =>
            fetch(url).then((res) => {
              if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
              }
              return res.arrayBuffer();
            }),
          catch: (cause: unknown) =>
            new DownloadError({
              url,
              cause,
            }),
        }).pipe(Effect.withSpan('SabbathSchool.downloadPdf'));

      const generateOutline = (
        context: LessonContext,
        lessonPdf: ArrayBuffer,
        egwPdf: ArrayBuffer,
      ): Effect.Effect<string, OutlineError> =>
        Effect.gen(function* () {
          const response = yield* Effect.tryPromise({
            try: () =>
              generateText({
                model: ai.high,
                messages: [
                  { role: 'system', content: outlineSystemPrompt },
                  {
                    role: 'user',
                    content: [
                      {
                        type: 'text',
                        text: outlineUserPrompt(context),
                      },
                      {
                        type: 'file',
                        mediaType: 'application/pdf',
                        data: lessonPdf,
                      },
                      {
                        type: 'file',
                        mediaType: 'application/pdf',
                        data: egwPdf,
                      },
                    ],
                  },
                ],
              }),
            catch: (cause: unknown) =>
              new OutlineError({
                context,
                cause,
              }),
          });

          return response.text;
        }).pipe(Effect.withSpan('SabbathSchool.generateOutline'));

      const reviseOutline = Effect.fn('SabbathSchool.reviseOutline')(function* (
        context: LessonContext,
        outline: string,
      ) {
        yield* Effect.log('Checking if revision is needed...');

        const reviewResponse = yield* Effect.tryPromise({
          try: () =>
            generateObject({
              model: ai.high,
              messages: [
                { role: 'system', content: reviewCheckSystemPrompt },
                { role: 'user', content: reviewCheckUserPrompt(outline) },
              ],
              schema: z.object({
                needsRevision: z
                  .boolean()
                  .describe('Whether the outline needs revision'),
                revisionPoints: z
                  .array(z.string())
                  .describe(
                    'Specific points where the outline FAILS to meet the prompt requirements',
                  ),
                comments: z
                  .string()
                  .describe(
                    'Brief overall comment on the adherence or specific strengths/weaknesses, keep it concise. Use empty string if no comments.',
                  ),
              }),
            }),
          catch: (cause: unknown) =>
            new ReviewError({
              context,
              cause,
            }),
        });

        const needsRevision = reviewResponse.object.needsRevision;

        yield* Effect.log(`Revision needed: ${needsRevision}`);
        if (!needsRevision) {
          return Option.none<string>();
        }

        yield* Effect.log('Revising outline...');

        const revisedOutline = yield* Effect.tryPromise({
          try: () =>
            generateText({
              model: ai.high,
              messages: [
                { role: 'system', content: outlineSystemPrompt },
                { role: 'system', content: reviseSystemPrompt },
                {
                  role: 'user',
                  content: reviseUserPrompt(reviewResponse.object, outline),
                },
              ],
            }),
          catch: (cause: unknown) =>
            new ReviseError({
              context,
              cause,
            }),
        });

        return Option.some(revisedOutline.text);
      });

      return SabbathSchool.of({
        findQuarterUrls,
        downloadPdf,
        generateOutline,
        reviseOutline,
      });
    }),
  );
}
