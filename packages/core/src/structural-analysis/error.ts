import { Schema } from 'effect';

export class StructuralAnalysisError extends Schema.TaggedError<StructuralAnalysisError>()(
  'StructuralAnalysisError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}
