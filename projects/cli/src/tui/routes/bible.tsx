import { createSignal, Show } from 'solid-js';
import { useKeyboard, useTerminalDimensions } from '@opentui/solid';

import { useNavigation } from '../context/navigation.js';
import { useDisplay } from '../context/display.js';
import { useTheme } from '../context/theme.js';
import { Topbar } from '../components/topbar.js';
import { Footer } from '../components/footer.js';
import { ChapterView } from '../components/chapter-view.js';
import { CommandPalette } from '../components/command-palette.js';

interface BibleViewProps {
  onNavigateToRoute?: (route: string) => void;
}

export function BibleView(props: BibleViewProps) {
  const dimensions = useTerminalDimensions();
  const { theme } = useTheme();
  const { nextChapter, prevChapter, nextVerse, prevVerse } = useNavigation();
  const { toggleMode } = useDisplay();
  const [showPalette, setShowPalette] = createSignal(false);
  const [showToolsPalette, setShowToolsPalette] = createSignal(false);

  useKeyboard((key) => {
    // Skip if palette is open
    if (showPalette() || showToolsPalette()) return;

    // Verse navigation: j/k or up/down
    if (key.name === 'j' || key.name === 'down') {
      nextVerse();
      return;
    }
    if (key.name === 'k' || key.name === 'up') {
      prevVerse();
      return;
    }

    // Chapter navigation: h/l or left/right
    if (key.name === 'h' || key.name === 'left') {
      prevChapter();
      return;
    }
    if (key.name === 'l' || key.name === 'right') {
      nextChapter();
      return;
    }

    // Display mode toggle: v
    if (key.name === 'v') {
      toggleMode();
      return;
    }

    // Command palette: Ctrl+P
    if (key.ctrl && key.name === 'p') {
      setShowPalette(true);
      return;
    }

    // Tools palette: Ctrl+T
    if (key.ctrl && key.name === 't') {
      setShowToolsPalette(true);
      return;
    }
    // Note: Ctrl+C exit is handled globally in AppContent
  });

  const closePalette = () => {
    setShowPalette(false);
    setShowToolsPalette(false);
  };

  return (
    <box
      width={dimensions().width}
      height={dimensions().height}
      flexDirection="column"
      backgroundColor={theme().background}
    >
      <Topbar />

      <ChapterView />

      <Footer />

      {/* Command Palette Overlay */}
      <Show when={showPalette()}>
        <box
          position="absolute"
          top={Math.floor(dimensions().height / 6)}
          left={Math.floor((dimensions().width - 70) / 2)}
          width={70}
        >
          <CommandPalette onClose={closePalette} onNavigateToRoute={props.onNavigateToRoute} />
        </box>
      </Show>

      {/* Tools Palette Overlay */}
      <Show when={showToolsPalette()}>
        <box
          position="absolute"
          top={Math.floor(dimensions().height / 6)}
          left={Math.floor((dimensions().width - 50) / 2)}
          width={50}
        >
          <ToolsPalette onClose={closePalette} onNavigateToRoute={props.onNavigateToRoute} />
        </box>
      </Show>
    </box>
  );
}

interface ToolsPaletteProps {
  onClose: () => void;
  onNavigateToRoute?: (route: string) => void;
}

function ToolsPalette(props: ToolsPaletteProps) {
  const { theme, themeName, cycleTheme } = useTheme();
  const [selectedIndex, setSelectedIndex] = createSignal(0);

  const tools = () => [
    { label: 'Messages', description: 'Generate sermon messages', route: 'messages' },
    { label: 'Sabbath School', description: 'Process lesson outlines', route: 'sabbath-school' },
    { label: 'Studies', description: 'Create Bible studies', route: 'studies' },
    { label: 'Cycle Theme', description: `Current: ${themeName()}`, action: () => cycleTheme() },
  ];

  useKeyboard((key) => {
    if (key.name === 'escape') {
      props.onClose();
      return;
    }

    if (key.name === 'return') {
      const tool = tools()[selectedIndex()];
      if (tool) {
        if (tool.route) {
          props.onNavigateToRoute?.(tool.route);
          props.onClose();
        } else if (tool.action) {
          tool.action();
        }
      }
      return;
    }

    if (key.name === 'up' || key.name === 'k') {
      setSelectedIndex((i) => Math.max(0, i - 1));
      return;
    }

    if (key.name === 'down' || key.name === 'j') {
      setSelectedIndex((i) => Math.min(tools().length - 1, i + 1));
      return;
    }

    // Number keys for quick select
    const num = parseInt(key.name, 10);
    if (num >= 1 && num <= tools().length) {
      const tool = tools()[num - 1];
      if (tool) {
        if (tool.route) {
          props.onNavigateToRoute?.(tool.route);
          props.onClose();
        } else if (tool.action) {
          tool.action();
        }
      }
    }
  });

  return (
    <box
      flexDirection="column"
      border
      borderColor={theme().borderFocused}
      backgroundColor={theme().backgroundPanel}
      padding={1}
    >
      <text fg={theme().textHighlight} marginBottom={1}>
        <strong>Tools</strong>
      </text>

      {tools().map((tool, index) => (
        <box
          flexDirection="row"
          justifyContent="space-between"
          paddingLeft={1}
          paddingRight={1}
          backgroundColor={index === selectedIndex() ? theme().accent : undefined}
        >
          <text fg={index === selectedIndex() ? theme().background : theme().text}>
            <span style={{ fg: index === selectedIndex() ? theme().background : theme().textMuted }}>{index + 1}. </span>
            {tool.label}
          </text>
          <text fg={index === selectedIndex() ? theme().background : theme().textMuted}>
            {tool.description}
          </text>
        </box>
      ))}

      <box height={1} marginTop={1}>
        <text fg={theme().textMuted}>
          <span style={{ fg: theme().accent }}>1-{tools().length}</span> select
          {'  '}
          <span style={{ fg: theme().accent }}>Esc</span> close
        </text>
      </box>
    </box>
  );
}
