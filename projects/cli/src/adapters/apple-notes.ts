import Bun from 'bun';
import { Effect, Layer, Option, pipe, Schema } from 'effect';
import { marked } from 'marked';

import type { ExportOptions } from '@bible/core/adapters';
import { ExportAdapter, ExportError } from '@bible/core/adapters';

/**
 * Escape string for AppleScript.
 */
function escapeAppleScriptString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Extract title from Markdown content (first H1 heading).
 */
function extractTitleFromMarkdown(
  markdownContent: string,
): Option.Option<string> {
  const h1Match = markdownContent.match(/^\s*#\s+(.*?)(\s+#*)?$/m);
  return Option.fromNullable(h1Match?.[1]?.trim());
}

class MarkdownParseError extends Schema.TaggedError<MarkdownParseError>()(
  'MarkdownParseError',
  {
    message: Schema.String,
    cause: Schema.Defect,
    content: Schema.String,
  },
) {}

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

      // Remove the H1 heading from content if we're using it as the title
      const contentToParse = content.replace(/^\s*#\s+.*?(\s+#*)?$/m, '').trim();

      // Add extra line breaks between sections
      const contentWithBreaks = contentToParse
        .replace(/(?=#{2,4}\s)/g, '\n\n\n')
        .replace(/(?<=#{2,4}.*\n)/g, '\n\n');

      const htmlContent = yield* parseMarkdown(contentWithBreaks).pipe(
        Effect.mapError(
          (cause) =>
            new ExportError({
              title: finalNoteTitle,
              cause,
            }),
        ),
      );

      // Prepare HTML for AppleScript
      const styledHtmlContent = `
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, sans-serif;
              font-size: 24px;
              line-height: 1.6;
              max-width: 800px;
              margin: 0 auto;
              padding: 40px;
            }
            h1 { font-size: 36px; margin-bottom: 48px; padding-bottom: 20px; border-bottom: 2px solid #e9ecef; }
            h2 { font-size: 32px; margin-top: 64px; margin-bottom: 40px; padding-bottom: 16px; border-bottom: 1px solid #e9ecef; }
            h3 { font-size: 30px; margin-top: 56px; margin-bottom: 32px; }
            h4 { font-size: 28px; margin-top: 48px; margin-bottom: 28px; }
            p { font-size: 24px; margin-bottom: 32px; line-height: 1.7; }
            pre { background-color: #f8f9fa; padding: 28px; border-radius: 8px; overflow-x: auto; font-family: Menlo, Monaco, Consolas, monospace; font-size: 22px; line-height: 1.6; margin: 40px 0; border: 1px solid #e9ecef; }
            code { font-family: Menlo, Monaco, Consolas, monospace; font-size: 22px; background-color: #f8f9fa; padding: 4px 8px; border-radius: 4px; border: 1px solid #e9ecef; }
            ul, ol { font-size: 24px; margin: 40px 0; padding-left: 40px; }
            li { margin-bottom: 24px; line-height: 1.7; }
            blockquote { font-size: 24px; border-left: 4px solid #e9ecef; margin: 48px 0; padding: 24px 32px; background-color: #f8f9fa; border-radius: 0 8px 8px 0; }
            hr { border: none; border-top: 2px solid #e9ecef; margin: 64px 0; }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
        </html>
      `;

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
      yield* Effect.log(
        `Success! Note "${finalNoteTitle}" created in Apple Notes${folderInfo}.`,
      );
    }),
  }),
);
