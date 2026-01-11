import { createSignal, For, Show } from 'solid-js';
import { useKeyboard } from '@opentui/solid';

import { useTheme } from '../context/theme.js';
import {
  PaletteProvider,
  usePalette,
  PaletteInput,
  PaletteOptionList,
  PaletteFooter,
  PaletteFrame,
  type GroupType,
  type CommandType,
  type CommandOption,
  type CommandGroup,
} from './palette/index.js';

// Re-export types for consumers
export type { GroupType, CommandType, CommandOption, CommandGroup };

interface CommandPaletteProps {
  onClose: () => void;
  onNavigateToRoute?: (route: string) => void;
}

// Main entry point - just handles which sub-component to show
export function CommandPalette(props: CommandPaletteProps) {
  const { themeName, setTheme, availableThemes } = useTheme();

  // Simple state: either showing main search or theme picker
  const [showThemePicker, setShowThemePicker] = createSignal(false);

  const handleSelectTheme = () => {
    setShowThemePicker(true);
  };

  const handleThemeSelected = (name: string) => {
    setTheme(name);
    props.onClose();
  };

  const handleThemeBack = () => {
    setShowThemePicker(false);
  };

  return (
    <Show
      when={!showThemePicker()}
      fallback={
        <ThemePicker
          currentTheme={themeName()}
          availableThemes={availableThemes()}
          onSelect={handleThemeSelected}
          onBack={handleThemeBack}
        />
      }
    >
      <MainPalette
        onClose={props.onClose}
        onNavigateToRoute={props.onNavigateToRoute}
        onSelectTheme={handleSelectTheme}
      />
    </Show>
  );
}

// Main search palette - wraps PaletteContent with provider
interface MainPaletteProps {
  onClose: () => void;
  onNavigateToRoute?: (route: string) => void;
  onSelectTheme: () => void;
}

function MainPalette(props: MainPaletteProps) {
  return (
    <PaletteProvider
      onClose={props.onClose}
      onNavigateToRoute={props.onNavigateToRoute}
      onSelectTheme={props.onSelectTheme}
    >
      <PaletteContent onClose={props.onClose} />
    </PaletteProvider>
  );
}

// Palette UI - composed from compound components
interface PaletteContentProps {
  onClose: () => void;
}

function PaletteContent(props: PaletteContentProps) {
  const { moveSelection, selectCurrent } = usePalette();

  useKeyboard((key) => {
    if (key.name === 'escape') {
      props.onClose();
      return;
    }

    if (key.name === 'return') {
      selectCurrent();
      return;
    }

    if (key.name === 'up' || (key.ctrl && key.name === 'p')) {
      moveSelection(-1);
      return;
    }

    if (key.name === 'down' || (key.ctrl && key.name === 'n')) {
      moveSelection(1);
      return;
    }
  });

  return (
    <PaletteFrame>
      <PaletteInput />
      <PaletteOptionList maxVisible={12} />
      <PaletteFooter />
    </PaletteFrame>
  );
}

// Theme picker - completely isolated component with its own keyboard handling
interface ThemePickerProps {
  currentTheme: string;
  availableThemes: string[];
  onSelect: (name: string) => void;
  onBack: () => void;
}

function ThemePicker(props: ThemePickerProps) {
  const { theme } = useTheme();

  const initialIndex = () => {
    const idx = props.availableThemes.indexOf(props.currentTheme);
    return idx >= 0 ? idx : 0;
  };
  const [selectedIndex, setSelectedIndex] = createSignal(initialIndex());

  useKeyboard((key) => {
    if (key.name === 'escape') {
      props.onBack();
      return;
    }

    if (key.name === 'return') {
      const selected = props.availableThemes[selectedIndex()];
      if (selected) {
        props.onSelect(selected);
      }
      return;
    }

    if (key.name === 'up' || key.name === 'k') {
      setSelectedIndex((i) => Math.max(0, i - 1));
      return;
    }

    if (key.name === 'down' || key.name === 'j') {
      setSelectedIndex((i) => Math.min(props.availableThemes.length - 1, i + 1));
      return;
    }
  });

  return (
    <PaletteFrame minWidth={40} maxHeight={18}>
      {/* Header */}
      <box paddingLeft={1} marginBottom={1}>
        <text fg={theme().textHighlight}>
          <strong>Select Theme</strong>
        </text>
      </box>

      {/* Theme list */}
      <box flexDirection="column" flexGrow={1}>
        <For each={props.availableThemes}>
          {(name, index) => {
            const isSelected = () => index() === selectedIndex();
            const isCurrent = name === props.currentTheme;

            return (
              <box
                flexDirection="row"
                justifyContent="space-between"
                paddingLeft={2}
                paddingRight={1}
                backgroundColor={isSelected() ? theme().accent : undefined}
              >
                <text fg={isSelected() ? theme().background : theme().text}>
                  {name}
                </text>
                <Show when={isCurrent}>
                  <text fg={isSelected() ? theme().background : theme().textMuted}>
                    (current)
                  </text>
                </Show>
              </box>
            );
          }}
        </For>
      </box>

      {/* Footer hints */}
      <box height={1} marginTop={1}>
        <text fg={theme().textMuted}>
          <span style={{ fg: theme().accent }}>Enter</span> select
          <span>  </span>
          <span style={{ fg: theme().accent }}>↑↓</span> navigate
          <span>  </span>
          <span style={{ fg: theme().accent }}>Esc</span> back
        </text>
      </box>
    </PaletteFrame>
  );
}
