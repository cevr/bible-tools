// @effect-diagnostics strictBooleanExpressions:off
/**
 * useRuntime hook for Effect integration with Solid.js
 *
 * Provides call/cast helpers for running Effects within components.
 * Based on gent's atom-solid pattern.
 */

import type { Effect } from 'effect';
import { Cause, Exit, Fiber, Runtime } from 'effect';
import { createSignal, onCleanup } from 'solid-js';
import type { Accessor } from 'solid-js';

import { Result } from './result.js';
import type { Result as ResultType } from './result.js';

/**
 * Hook for running Effects with a given Runtime
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const runtime = useAppRuntime()
 *   const { call, cast } = useRuntime(runtime)
 *
 *   // Tracked execution - returns [result accessor, cancel]
 *   const [data, cancel] = call(
 *     Effect.gen(function* () {
 *       const service = yield* MyService
 *       return yield* service.getData()
 *     })
 *   )
 *
 *   // Fire-and-forget
 *   cast(Effect.log("Something happened"))
 *
 *   return (
 *     <Show when={isSuccess(data())} fallback={<Loading />}>
 *       {data().value}
 *     </Show>
 *   )
 * }
 * ```
 */
export function useRuntime<R>(runtime: Runtime.Runtime<R>) {
  /**
   * Tracked execution - returns [result accessor, cancel function]
   *
   * The result accessor is reactive and will update when the effect completes.
   * Call cancel() to interrupt the fiber.
   */
  const call = <A, E>(
    effect: Effect.Effect<A, E, R>,
  ): readonly [Accessor<ResultType<A, E>>, () => void] => {
    const [result, setResult] = createSignal<ResultType<A, E>>(Result.initial(true));

    const fiber = Runtime.runFork(runtime)(effect);

    fiber.addObserver((exit) => {
      if (Exit.isSuccess(exit)) {
        setResult(Result.success(exit.value));
      } else {
        setResult(Result.failure(exit.cause));
      }
    });

    const cancel = () => {
      Runtime.runFork(runtime)(Fiber.interruptFork(fiber));
    };

    // Auto-cleanup on component unmount
    onCleanup(cancel);

    return [result, cancel] as const;
  };

  /**
   * Fire-and-forget execution - no tracking
   *
   * Use this for side effects that don't need to be displayed in the UI.
   */
  const cast = <A, E>(effect: Effect.Effect<A, E, R>): void => {
    Runtime.runFork(runtime)(effect);
  };

  /**
   * Run effect and return promise
   *
   * Useful for event handlers that need to await completion.
   */
  const run = <A, E>(effect: Effect.Effect<A, E, R>): Promise<A> => {
    return Runtime.runPromise(runtime)(effect);
  };

  /**
   * Run effect and return exit promise
   *
   * Useful when you need to handle both success and failure.
   */
  const runExit = <A, E>(effect: Effect.Effect<A, E, R>): Promise<Exit.Exit<A, E>> => {
    return Runtime.runPromiseExit(runtime)(effect);
  };

  return { call, cast, run, runExit };
}

/**
 * Create a reactive effect runner for a specific effect
 *
 * Returns a function that when called, runs the effect and updates the result.
 * Useful for effects that need to be re-run (e.g., on user action).
 *
 * @example
 * ```tsx
 * function SearchComponent() {
 *   const runtime = useAppRuntime()
 *   const [query, setQuery] = createSignal("")
 *
 *   const [results, search] = useEffectRunner(runtime, (q: string) =>
 *     Effect.gen(function* () {
 *       const service = yield* SearchService
 *       return yield* service.search(q)
 *     })
 *   )
 *
 *   createEffect(() => {
 *     search(query())
 *   })
 *
 *   return <ResultsList results={results()} />
 * }
 * ```
 */
export function useEffectRunner<R, Args extends unknown[], A, E>(
  runtime: Runtime.Runtime<R>,
  effectFn: (...args: Args) => Effect.Effect<A, E, R>,
): readonly [Accessor<ResultType<A, E>>, (...args: Args) => void] {
  const [result, setResult] = createSignal<ResultType<A, E>>(Result.initial());
  let currentFiber: Fiber.RuntimeFiber<A, E> | null = null;

  const run = (...args: Args) => {
    // Cancel previous run if still in progress
    if (currentFiber) {
      Runtime.runFork(runtime)(Fiber.interruptFork(currentFiber));
    }

    // Mark as waiting
    setResult((prev) => Result.waiting(prev));

    const effect = effectFn(...args);
    currentFiber = Runtime.runFork(runtime)(effect);

    currentFiber.addObserver((exit) => {
      currentFiber = null;
      if (Exit.isSuccess(exit)) {
        setResult(Result.success(exit.value));
      } else {
        // Only set failure if not interrupted
        if (!Cause.isInterruptedOnly(exit.cause)) {
          setResult(Result.failure(exit.cause));
        }
      }
    });
  };

  // Cleanup on unmount
  onCleanup(() => {
    if (currentFiber) {
      Runtime.runFork(runtime)(Fiber.interruptFork(currentFiber));
    }
  });

  return [result, run] as const;
}
