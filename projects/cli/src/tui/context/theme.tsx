import { createContext, useContext, createSignal, createMemo, type ParentProps } from 'solid-js';

import { type Theme, themes, getTheme, getThemeNames } from '../themes/index.js';
import { useBibleState } from './bible.js';

interface ThemeContextValue {
  theme: () => Theme;
  themeName: () => string;
  setTheme: (name: string) => void;
  availableThemes: () => string[];
  cycleTheme: (direction?: 1 | -1) => void;
}

const ThemeContext = createContext<ThemeContextValue>();

interface ThemeProviderProps {
  initialTheme?: string;
}

export function ThemeProvider(props: ParentProps<ThemeProviderProps>) {
  const state = useBibleState();
  const prefs = state.getPreferences();
  const [themeName, setThemeNameState] = createSignal(props.initialTheme ?? prefs.theme);

  const theme = createMemo(() => getTheme(themeName()));
  const availableThemes = createMemo(() => getThemeNames());

  const setTheme = (name: string) => {
    if (themes[name] || name === 'system') {
      setThemeNameState(name);
      state.setPreferences({ theme: name });
    }
  };

  const cycleTheme = (direction: 1 | -1 = 1) => {
    const names = availableThemes();
    const currentIndex = names.indexOf(themeName());
    const nextIndex = (currentIndex + direction + names.length) % names.length;
    const nextName = names[nextIndex];
    if (nextName) {
      setTheme(nextName);
    }
  };

  const value: ThemeContextValue = {
    theme,
    themeName,
    setTheme,
    availableThemes,
    cycleTheme,
  };

  return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
