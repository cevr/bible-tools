/**
 * RuntimeProvider - Solid.js context for Effect Runtime
 *
 * Provides a managed Effect runtime to the component tree.
 * Based on gent's atom-solid pattern.
 */

import type { Runtime } from 'effect';
import { createContext, useContext } from 'solid-js';
import type { JSX } from 'solid-js';

/**
 * Runtime context - holds the Effect runtime
 */
const RuntimeContext = createContext<Runtime.Runtime<unknown>>();

/**
 * Props for RuntimeProvider
 */
export interface RuntimeProviderProps<R> {
  /**
   * The Effect runtime to provide to children
   */
  runtime: Runtime.Runtime<R>;
  /**
   * Child components
   */
  children: JSX.Element;
}

/**
 * Provides an Effect runtime to the component tree
 *
 * @example
 * ```tsx
 * // At app entry point
 * const appRuntime = await Effect.runPromise(
 *   ManagedRuntime.make(AppLayer).runtimeEffect
 * )
 *
 * function App() {
 *   return (
 *     <RuntimeProvider runtime={appRuntime}>
 *       <Router />
 *     </RuntimeProvider>
 *   )
 * }
 * ```
 */
export function RuntimeProvider<R>(props: RuntimeProviderProps<R>): JSX.Element {
  return (
    <RuntimeContext.Provider value={props.runtime as Runtime.Runtime<unknown>}>
      {props.children}
    </RuntimeContext.Provider>
  );
}

/**
 * Hook to access the Effect runtime from context
 *
 * @throws Error if used outside of RuntimeProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const runtime = useAppRuntime<BibleService | EGWService>()
 *   const { call, cast } = useRuntime(runtime)
 *   // ...
 * }
 * ```
 */
export function useAppRuntime<R = unknown>(): Runtime.Runtime<R> {
  const runtime = useContext(RuntimeContext);
  if (!runtime) {
    throw new Error('useAppRuntime must be used within a RuntimeProvider');
  }
  return runtime as Runtime.Runtime<R>;
}

/**
 * Hook to optionally access the Effect runtime from context
 *
 * Returns undefined if not within a RuntimeProvider.
 * Useful for components that can work with or without Effect.
 */
export function useMaybeRuntime<R = unknown>(): Runtime.Runtime<R> | undefined {
  const runtime = useContext(RuntimeContext);
  return runtime as Runtime.Runtime<R> | undefined;
}
