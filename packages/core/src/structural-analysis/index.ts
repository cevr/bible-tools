/**
 * Structural Analysis Module
 *
 * Provides deterministic passage-level data gathering for structural analysis.
 * Orchestrates BibleDatabase methods — no AI, pure data operations.
 */

export type {
  PassageContext,
  WordFrequencyEntry,
  WordFrequencyResult,
  SymbolicNumber,
} from './types.js';

export { SYMBOLIC_NUMBERS } from './types.js';

export { StructuralAnalysis, type StructuralAnalysisShape } from './service.js';

export { StructuralAnalysisError } from './error.js';
