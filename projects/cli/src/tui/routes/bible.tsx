import { createSignal, Show } from 'solid-js';
import { useKeyboard, useTerminalDimensions } from '@opentui/solid';

import { useNavigation } from '../context/navigation.js';
import { useDisplay } from '../context/display.js';
import { useTheme } from '../context/theme.js';
import { useSearch } from '../context/search.js';
import { useOverlay } from '../context/overlay.js';
import { Topbar } from '../components/topbar.js';
import { Footer } from '../components/footer.js';
import { ChapterView } from '../components/chapter-view.js';
import { CommandPalette } from '../components/command-palette.js';
import { SearchBox } from '../components/search-box.js';
import {
  GotoModeState,
  gotoModeTransition,
  keyToGotoEvent,
  type GotoModeAction,
} from '../types/goto-mode.js';
import { match } from '../utils/match.js';

interface BibleViewProps {
  onNavigateToRoute?: (route: string) => void;
}

export function BibleView(props: BibleViewProps) {
  const dimensions = useTerminalDimensions();
  const { theme } = useTheme();
  const { nextChapter, prevChapter, nextVerse, prevVerse, goToVerse, goToFirstVerse, goToLastVerse } = useNavigation();
  const { toggleMode } = useDisplay();
  const { isActive: isSearchActive, setActive: setSearchActive, nextMatch, prevMatch } = useSearch();
  const { isOpen: isOverlayOpen, isOverlayOpen: isSpecificOverlayOpen, open: openOverlay, close: closeOverlay } = useOverlay();

  // Vim-style goto mode using state machine
  const [gotoMode, setGotoMode] = createSignal<GotoModeState>(GotoModeState.normal());

  // Execute actions from goto mode transitions
  const executeGotoAction = (action: GotoModeAction) => {
    match(action, {
      goToFirst: () => goToFirstVerse(),
      goToLast: () => goToLastVerse(),
      goToVerse: ({ verse }) => goToVerse(verse),
    });
  };

  useKeyboard((key) => {
    // Skip if any overlay is open
    if (isOverlayOpen()) return;

    // Skip if search is active (SearchBox handles its own input)
    if (isSearchActive()) return;

    // Handle goto mode state machine
    const currentGotoMode = gotoMode();
    if (currentGotoMode._tag === 'awaiting') {
      const event = keyToGotoEvent(key);
      const { state: newState, action } = gotoModeTransition(currentGotoMode, event);
      setGotoMode(newState);
      if (action) executeGotoAction(action);
      // If we handled a goto event (state changed or action fired), don't process further
      if (newState._tag !== currentGotoMode._tag || action) return;
    }

    // Handle 'g' to enter goto mode (only when in normal mode)
    if (currentGotoMode._tag === 'normal') {
      const event = keyToGotoEvent(key);
      if (event._tag === 'pressG') {
        const { state: newState } = gotoModeTransition(currentGotoMode, event);
        setGotoMode(newState);
        return;
      }
      if (event._tag === 'pressShiftG') {
        const { action } = gotoModeTransition(currentGotoMode, event);
        if (action) executeGotoAction(action);
        return;
      }
    }

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
      openOverlay('command-palette');
      return;
    }

    // Tools palette: Ctrl+T
    if (key.ctrl && key.name === 't') {
      openOverlay('tools-palette');
      return;
    }

    // Search: Ctrl+F or /
    if ((key.ctrl && key.name === 'f') || key.name === '/') {
      setSearchActive(true);
      return;
    }

    // n - next search match (vim style)
    if (key.name === 'n' && !key.ctrl) {
      nextMatch();
      return;
    }

    // N - previous search match (vim style)
    if (key.sequence === 'N') {
      prevMatch();
      return;
    }
    // Note: Ctrl+C exit is handled globally in AppContent
  });

  const closeSearch = () => {
    setSearchActive(false);
    // Keep the query so highlights remain visible and n/N still work
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

      <Footer gotoMode={gotoMode()} />

      {/* Command Palette Overlay */}
      <Show when={isSpecificOverlayOpen('command-palette')}>
        <box
          position="absolute"
          top={Math.floor(dimensions().height / 6)}
          left={Math.floor((dimensions().width - 70) / 2)}
          width={70}
        >
          <CommandPalette onClose={closeOverlay} onNavigateToRoute={props.onNavigateToRoute} />
        </box>
      </Show>

      {/* Tools Palette Overlay */}
      <Show when={isSpecificOverlayOpen('tools-palette')}>
        <box
          position="absolute"
          top={Math.floor(dimensions().height / 6)}
          left={Math.floor((dimensions().width - 50) / 2)}
          width={50}
        >
          <ToolsPalette onClose={closeOverlay} onNavigateToRoute={props.onNavigateToRoute} />
        </box>
      </Show>

      {/* Search Box - top right */}
      <Show when={isSearchActive()}>
        <box
          position="absolute"
          top={1}
          right={2}
          width={40}
        >
          <SearchBox onClose={closeSearch} />
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
