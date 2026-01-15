import {
  createContext,
  useContext,
  onCleanup,
  type ParentComponent,
} from 'solid-js';
import { Layer, ManagedRuntime } from 'effect';

// For now, we create an empty layer. Services will be added as we implement features.
// This will eventually include BibleData, EGWReader, etc. from @bible/core
const AppLayer = Layer.empty;

type AppRuntime = ManagedRuntime.ManagedRuntime<never, never>;

const EffectContext = createContext<AppRuntime>();

/**
 * Provides the Effect runtime to the component tree.
 * All Effect-based operations should use this runtime.
 */
export const EffectProvider: ParentComponent = (props) => {
  const runtime = ManagedRuntime.make(AppLayer);

  onCleanup(() => {
    // Dispose of the runtime when the component unmounts
    runtime.dispose();
  });

  return (
    <EffectContext.Provider value={runtime}>
      {props.children}
    </EffectContext.Provider>
  );
};

/**
 * Access the Effect runtime from any component.
 */
export function useRuntime(): AppRuntime {
  const runtime = useContext(EffectContext);
  if (!runtime) {
    throw new Error('useRuntime must be used within an EffectProvider');
  }
  return runtime;
}
