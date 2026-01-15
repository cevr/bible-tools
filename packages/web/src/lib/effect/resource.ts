import { createResource, createSignal, type Accessor } from 'solid-js';
import type { Effect, ManagedRuntime } from 'effect';
import { Exit, Cause } from 'effect';

/**
 * Result type for async Effect operations.
 * Mirrors effect-atom's Result pattern for consistent state handling.
 */
export type EffectResult<A, E> =
  | { readonly _tag: 'Initial' }
  | { readonly _tag: 'Loading' }
  | { readonly _tag: 'Success'; readonly value: A }
  | { readonly _tag: 'Failure'; readonly error: E };

/**
 * Create a SolidJS resource that runs an Effect.
 * This is a simple wrapper that converts Effect to Promise.
 *
 * @param runtime - The ManagedRuntime to use for running the effect
 * @param source - Source signal that triggers re-fetching
 * @param effect - Function that takes the source and returns an Effect
 */
export function createEffectResource<A, E, R, S>(
  runtime: ManagedRuntime.ManagedRuntime<R, never>,
  source: Accessor<S>,
  effect: (source: S) => Effect.Effect<A, E, R>
) {
  return createResource(source, async (s) => {
    const eff = effect(s);
    const exit = await runtime.runPromiseExit(eff);

    if (Exit.isSuccess(exit)) {
      return exit.value;
    }

    // Extract the error from the cause
    const error = Cause.squash(exit.cause);
    throw error;
  });
}

/**
 * Create a resource that returns EffectResult for more granular state handling.
 * This is useful when you need to distinguish between initial, loading, success, and failure states.
 */
export function createEffectResultResource<A, E, R, S>(
  runtime: ManagedRuntime.ManagedRuntime<R, never>,
  source: Accessor<S>,
  effect: (source: S) => Effect.Effect<A, E, R>
): {
  result: Accessor<EffectResult<A, E>>;
  refetch: () => void;
} {
  const [resource, { refetch }] = createResource(source, async (s) => {
    const eff = effect(s);
    const exit = await runtime.runPromiseExit(eff);

    if (Exit.isSuccess(exit)) {
      return { _tag: 'Success' as const, value: exit.value };
    }

    return { _tag: 'Failure' as const, error: Cause.squash(exit.cause) as E };
  });

  const result = (): EffectResult<A, E> => {
    const r = resource();

    if (resource.loading) {
      return { _tag: 'Loading' };
    }

    if (r === undefined) {
      return { _tag: 'Initial' };
    }

    return r;
  };

  return { result, refetch };
}

/**
 * Run an Effect once and return a signal with the result.
 * Useful for one-time data fetching on mount.
 */
export function createEffectOnce<A, E, R>(
  runtime: ManagedRuntime.ManagedRuntime<R, never>,
  effect: Effect.Effect<A, E, R>
): {
  result: Accessor<EffectResult<A, E>>;
  refetch: () => void;
} {
  const [trigger, setTrigger] = createSignal(0);
  return createEffectResultResource(runtime, trigger, () => effect);
}
