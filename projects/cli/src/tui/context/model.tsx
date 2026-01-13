import type { LanguageModel } from 'ai';
import { createContext, useContext, type ParentProps } from 'solid-js';

// Model service interface for TUI
export interface ModelService {
  models: {
    high: LanguageModel;
    low: LanguageModel;
  };
}

const ModelContext = createContext<ModelService | null>();

interface ModelProviderProps {
  model: ModelService | null;
}

export function ModelProvider(props: ParentProps<ModelProviderProps>) {
  return (
    <ModelContext.Provider value={props.model}>
      {props.children}
    </ModelContext.Provider>
  );
}

export function useModel(): ModelService | null {
  return useContext(ModelContext) ?? null;
}

export function useModelAvailable(): boolean {
  const ctx = useContext(ModelContext);
  return ctx !== undefined && ctx !== null;
}
