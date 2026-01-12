import { createContext, useContext, createSignal, type ParentProps } from 'solid-js';

import { useBibleState } from './bible.js';

export type DisplayMode = 'verse' | 'paragraph';
export type MarginMode = 'off' | 'inline' | 'footer';

interface DisplayContextValue {
  mode: () => DisplayMode;
  setMode: (mode: DisplayMode) => void;
  toggleMode: () => void;
  marginMode: () => MarginMode;
  setMarginMode: (mode: MarginMode) => void;
  cycleMarginMode: () => void;
}

const DisplayContext = createContext<DisplayContextValue>();

interface DisplayProviderProps {
  initialMode?: DisplayMode;
}

export function DisplayProvider(props: ParentProps<DisplayProviderProps>) {
  const state = useBibleState();
  const prefs = state.getPreferences();
  const [mode, setModeState] = createSignal<DisplayMode>(props.initialMode ?? prefs.displayMode);
  const [marginMode, setMarginModeState] = createSignal<MarginMode>('off');

  const setMode = (newMode: DisplayMode) => {
    setModeState(newMode);
    state.setPreferences({ displayMode: newMode });
  };

  const toggleMode = () => {
    setMode(mode() === 'verse' ? 'paragraph' : 'verse');
  };

  const setMarginMode = (newMode: MarginMode) => {
    setMarginModeState(newMode);
  };

  const cycleMarginMode = () => {
    const current = marginMode();
    const nextMode: MarginMode = current === 'off' ? 'inline' : current === 'inline' ? 'footer' : 'off';
    setMarginMode(nextMode);
  };

  const value: DisplayContextValue = {
    mode,
    setMode,
    toggleMode,
    marginMode,
    setMarginMode,
    cycleMarginMode,
  };

  return <DisplayContext.Provider value={value}>{props.children}</DisplayContext.Provider>;
}

export function useDisplay(): DisplayContextValue {
  const ctx = useContext(DisplayContext);
  if (!ctx) {
    throw new Error('useDisplay must be used within a DisplayProvider');
  }
  return ctx;
}
