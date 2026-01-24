import type { ExportOptions } from '@bible/core/adapters';
import { ExportAdapter, ExportError } from '@bible/core/adapters';
import Bun from 'bun';
import { Effect, Layer, Option, pipe, Schema } from 'effect';
import { marked } from 'marked';

import {
  escapeAppleScriptString,
  extractTitleFromMarkdown,
  prepareMarkdownForAppleNotes,
  wrapWithAppleNotesStyle,
} from '~/src/lib/apple-notes-utils.js';

class MarkdownParseError extends Schema.TaggedError<MarkdownParseError>()('MarkdownParseError', {
  message: Schema.String,
  cause: Schema.Defect,
  content: Schema.String,
}) {}

const execCommand = Effect.fn('execCommand')(function* (command: string[]) {
  const result = yield* Effect.try(() => {
    const child = Bun.spawn(command);
    return child;
  });

  return yield* Effect.tryPromise(async () => {
    const text = await new Response(result.stdout).text();
    return text;
  });
});

const parseMarkdown = Effect.fn('parseMarkdown')(function* (content: string) {
  const result = yield* Effect.try({
    try: () => marked.parse(content),
    catch: (cause: unknown) =>
      new MarkdownParseError({
        message: 'Markdown parsing failed',
        cause,
        content,
      }),
  }).pipe(Effect.flatMap(Schema.decodeUnknown(Schema.String)));

  return result;
});

/**
 * Apple Notes export implementation of ExportAdapter.
 * Converts Markdown to HTML and creates a note via AppleScript.
 */
export const AppleNotesExportLayer = Layer.succeed(
  ExportAdapter,
  ExportAdapter.of({
    export: Effect.fn('AppleNotesExport.export')(function* (
      content: string,
      title: string,
      options?: ExportOptions,
    ) {
      yield* Effect.log('Converting Markdown to HTML...');

      // Use provided title or extract from content
      const finalNoteTitle = pipe(
        Option.some(title).pipe(Option.filter((t) => t.length > 0)),
        Option.orElse(() => extractTitleFromMarkdown(content)),
        Option.getOrElse(() => 'Untitled Note'),
      );

      yield* Effect.log(`Using note title: "${finalNoteTitle}"`);
      if (options?.folder) {
        yield* Effect.log(`Target folder: "${options.folder}"`);
      }

      // Prepare markdown content (removes H1 if using as title, adds section breaks)
      const contentWithBreaks = prepareMarkdownForAppleNotes(content, false);

      const htmlContent = yield* parseMarkdown(contentWithBreaks).pipe(
        Effect.mapError(
          (cause) =>
            new ExportError({
              title: finalNoteTitle,
              cause,
            }),
        ),
      );

      // Prepare HTML for AppleScript (basic structure and styling)
      const styledHtmlContent = wrapWithAppleNotesStyle(htmlContent);

      // Escape content for AppleScript
      const escapedHtmlBody = escapeAppleScriptString(styledHtmlContent);
      const escapedNoteTitle = escapeAppleScriptString(finalNoteTitle);

      // Construct AppleScript command - with or without folder
      yield* Effect.log('Constructing AppleScript command...');

      const appleScriptCommand = options?.folder
        ? `
        tell application "Notes"
          set targetFolder to missing value
          repeat with f in folders
            if name of f is "${escapeAppleScriptString(options.folder)}" then
              set targetFolder to f
              exit repeat
            end if
          end repeat
          if targetFolder is missing value then
            make new folder with properties {name:"${escapeAppleScriptString(options.folder)}"}
            set targetFolder to folder "${escapeAppleScriptString(options.folder)}"
          end if
          make new note at targetFolder with properties {name:"${escapedNoteTitle}", body:"${escapedHtmlBody.trim()}"}
        end tell
      `
        : `
        tell application "Notes"
          make new note with properties {name:"${escapedNoteTitle}", body:"${escapedHtmlBody.trim()}"}
        end tell
      `;

      // Execute AppleScript
      yield* Effect.log('Executing AppleScript to create note...');

      yield* execCommand(['osascript', '-e', appleScriptCommand]).pipe(
        Effect.mapError(
          (cause) =>
            new ExportError({
              title: finalNoteTitle,
              cause,
            }),
        ),
      );

      const folderInfo = options?.folder ? ` in folder "${options.folder}"` : '';
      yield* Effect.log(`Success! Note "${finalNoteTitle}" created in Apple Notes${folderInfo}.`);
    }),
  }),
);
