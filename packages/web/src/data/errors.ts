import { Schema } from 'effect';

export class WorkerError extends Schema.TaggedError<WorkerError>()('WorkerError', {
  cause: Schema.Unknown,
  message: Schema.String,
  operation: Schema.String,
}) {}

export class SyncError extends Schema.TaggedError<SyncError>()('SyncError', {
  cause: Schema.Unknown,
  message: Schema.String,
  statusCode: Schema.optional(Schema.Number),
}) {}

export class DatabaseQueryError extends Schema.TaggedError<DatabaseQueryError>()(
  'DatabaseQueryError',
  {
    cause: Schema.Unknown,
    operation: Schema.String,
  },
) {}

export class RecordNotFoundError extends Schema.TaggedError<RecordNotFoundError>()(
  'RecordNotFoundError',
  {
    entity: Schema.String,
    id: Schema.String,
  },
) {}
