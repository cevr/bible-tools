/**
 * Result ADT for async Effect state
 *
 * Represents the state of an async operation with proper loading tracking.
 * Based on gent's atom-solid pattern.
 */

import type { Cause } from 'effect';

/**
 * Initial state - operation hasn't started yet
 */
export interface Initial {
  readonly _tag: 'Initial';
  readonly waiting: boolean;
}

/**
 * Success state - operation completed with a value
 */
export interface Success<A> {
  readonly _tag: 'Success';
  readonly value: A;
  readonly waiting: boolean;
}

/**
 * Failure state - operation failed with a cause
 */
export interface Failure<E> {
  readonly _tag: 'Failure';
  readonly cause: Cause.Cause<E>;
  readonly waiting: boolean;
}

/**
 * Result union type
 */
export type Result<A, E> = Initial | Success<A> | Failure<E>;

/**
 * Result constructors
 */
export const Result = {
  initial: (waiting: boolean = false): Initial => ({
    _tag: 'Initial',
    waiting,
  }),

  success: <A>(value: A, waiting: boolean = false): Success<A> => ({
    _tag: 'Success',
    value,
    waiting,
  }),

  failure: <E>(cause: Cause.Cause<E>, waiting: boolean = false): Failure<E> => ({
    _tag: 'Failure',
    cause,
    waiting,
  }),

  /**
   * Set waiting state on any result
   */
  waiting: <A, E>(result: Result<A, E>): Result<A, E> => ({
    ...result,
    waiting: true,
  }),

  /**
   * Clear waiting state on any result
   */
  done: <A, E>(result: Result<A, E>): Result<A, E> => ({
    ...result,
    waiting: false,
  }),
} as const;

/**
 * Type guards
 */
export const isInitial = <A, E>(result: Result<A, E>): result is Initial =>
  result._tag === 'Initial';

export const isSuccess = <A, E>(result: Result<A, E>): result is Success<A> =>
  result._tag === 'Success';

export const isFailure = <A, E>(result: Result<A, E>): result is Failure<E> =>
  result._tag === 'Failure';

/**
 * Get value from result, or undefined if not success
 */
export const getValue = <A, E>(result: Result<A, E>): A | undefined =>
  isSuccess(result) ? result.value : undefined;

/**
 * Get cause from result, or undefined if not failure
 */
export const getCause = <A, E>(result: Result<A, E>): Cause.Cause<E> | undefined =>
  isFailure(result) ? result.cause : undefined;

/**
 * Check if result is in a loading state
 */
export const isLoading = <A, E>(result: Result<A, E>): boolean =>
  result.waiting || isInitial(result);

/**
 * Match on result state
 */
export const match = <A, E, R>(
  result: Result<A, E>,
  handlers: {
    onInitial: (waiting: boolean) => R;
    onSuccess: (value: A, waiting: boolean) => R;
    onFailure: (cause: Cause.Cause<E>, waiting: boolean) => R;
  },
): R => {
  switch (result._tag) {
    case 'Initial':
      return handlers.onInitial(result.waiting);
    case 'Success':
      return handlers.onSuccess(result.value, result.waiting);
    case 'Failure':
      return handlers.onFailure(result.cause, result.waiting);
  }
};
