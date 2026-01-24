/**
 * Effect Provider - Reserved for future Effect-based services.
 *
 * Currently the web app uses simple fetch with caching for Bible data,
 * but this provider can be used for Effect-based services if needed.
 */
import { createContext, useContext, type ParentComponent } from 'solid-js';

interface EffectContextValue {
  // Reserved for future Effect-based services
}

const EffectContext = createContext<EffectContextValue>();

/**
 * Placeholder provider for Effect-based services.
 * Currently unused - Bible data fetching uses simple fetch with caching.
 */
export const EffectProvider: ParentComponent = (props) => {
  const value: EffectContextValue = {};

  return <EffectContext.Provider value={value}>{props.children}</EffectContext.Provider>;
};

/**
 * Access Effect-based services (when available).
 */
export function useEffect(): EffectContextValue {
  const ctx = useContext(EffectContext);
  if (!ctx) {
    throw new Error('useEffect must be used within an EffectProvider');
  }
  return ctx;
}
