import { Context, Effect, Schema } from 'effect';

/**
 * Error thrown when an export operation fails.
 */
export class ExportError extends Schema.TaggedError<ExportError>()(
  'ExportError',
  {
    title: Schema.String,
    cause: Schema.Defect,
  },
) {}

/**
 * Adapter for exporting content to various destinations.
 * CLI implements this with Apple Notes export.
 * Web could implement with download or cloud storage.
 */
export class ExportAdapter extends Context.Tag('@bible/ExportAdapter')<
  ExportAdapter,
  {
    /**
     * Export content with the given title.
     * @param content - The content to export (typically markdown or HTML)
     * @param title - The title for the exported content
     */
    readonly export: (
      content: string,
      title: string,
    ) => Effect.Effect<void, ExportError>;
  }
>() {}
