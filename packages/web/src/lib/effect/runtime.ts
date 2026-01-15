import { ManagedRuntime, Layer } from 'effect';
import type { Effect } from 'effect';

/**
 * Create a ManagedRuntime from a Layer.
 * This is the primary way to provide Effect services to the web app.
 */
export function createRuntime<R, E>(layer: Layer.Layer<R, E, never>) {
  return ManagedRuntime.make(layer);
}

/**
 * Type helper for extracting the context type from a runtime.
 */
export type RuntimeContext<T> = T extends ManagedRuntime.ManagedRuntime<
  infer R,
  infer _E
>
  ? R
  : never;

/**
 * Type helper for extracting the error type from a runtime.
 */
export type RuntimeError<T> = T extends ManagedRuntime.ManagedRuntime<
  infer _R,
  infer E
>
  ? E
  : never;

/**
 * Run an effect using the provided runtime.
 * Returns a Promise that resolves with the result.
 */
export async function runEffect<A, E, R>(
  runtime: ManagedRuntime.ManagedRuntime<R, never>,
  effect: Effect.Effect<A, E, R>
): Promise<A> {
  return runtime.runPromise(effect);
}

/**
 * Run an effect and return the Exit value (success or failure).
 */
export async function runEffectExit<A, E, R>(
  runtime: ManagedRuntime.ManagedRuntime<R, never>,
  effect: Effect.Effect<A, E, R>
) {
  return runtime.runPromiseExit(effect);
}
