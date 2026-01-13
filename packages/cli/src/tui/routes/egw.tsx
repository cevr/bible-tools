/**
 * EGW Reader Route
 *
 * Main view for the EGW Library reader.
 * Similar to BibleView but adapted for EGW paragraph structure.
 */

import { useKeyboard, useTerminalDimensions } from '@opentui/solid';
import { createSignal, Show } from 'solid-js';

import { EGWBibleRefsPopup } from '../components/egw/bible-refs-popup.js';
import { EGWChapterView } from '../components/egw/chapter-view.js';
import { EGWCommandPalette } from '../components/egw/command-palette.js';
import { EGWFooter } from '../components/egw/footer.js';
import { EGWTopbar } from '../components/egw/topbar.js';
import { useEGWNavigation } from '../context/egw-navigation.js';
import { useRouter } from '../context/router.js';
import { useTheme } from '../context/theme.js';
import {
  GotoModeState,
  gotoModeTransition,
  keyToGotoEvent,
  type GotoModeAction,
} from '../types/goto-mode.js';
import { match } from '../utils/match.js';

type KeyEvent = { name?: string; sequence?: string; ctrl?: boolean };

/** Handle goto mode state machine. Returns true if key was handled. */
function handleGotoModeKeys(
  key: KeyEvent,
  gotoMode: GotoModeState,
  setGotoMode: (state: GotoModeState) => void,
  executeAction: (action: GotoModeAction) => void,
): boolean {
  const event = keyToGotoEvent(key);

  if (gotoMode._tag === 'awaiting') {
    const { state: newState, action } = gotoModeTransition(gotoMode, event);
    setGotoMode(newState);
    if (action) executeAction(action);
    if (newState._tag !== gotoMode._tag || action) return true;
  }

  if (gotoMode._tag === 'normal') {
    if (event._tag === 'pressG') {
      const { state: newState } = gotoModeTransition(gotoMode, event);
      setGotoMode(newState);
      return true;
    }
    if (event._tag === 'pressShiftG') {
      const { action } = gotoModeTransition(gotoMode, event);
      if (action) executeAction(action);
      return true;
    }
  }

  return false;
}

interface EGWViewProps {
  onBack?: () => void;
}

export function EGWView(props: EGWViewProps) {
  const dimensions = useTerminalDimensions();
  const { theme } = useTheme();
  const { navigateToBible } = useRouter();
  const {
    nextParagraph,
    prevParagraph,
    goToFirstParagraph,
    goToLastParagraph,
    goToParagraphIndex,
    nextPage,
    prevPage,
    nextChapter,
    prevChapter,
    currentParagraph,
  } = useEGWNavigation();

  // Overlay state
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = createSignal(false);
  const [isBibleRefsOpen, setIsBibleRefsOpen] = createSignal(false);

  // Vim-style goto mode
  const [gotoMode, setGotoMode] = createSignal<GotoModeState>(
    GotoModeState.normal(),
  );

  // Execute actions from goto mode transitions
  const executeGotoAction = (action: GotoModeAction) => {
    match(action, {
      goToFirst: () => goToFirstParagraph(),
      goToLast: () => goToLastParagraph(),
      goToVerse: ({ verse }) => goToParagraphIndex(verse - 1), // Convert 1-based to 0-based
    });
  };

  useKeyboard((key) => {
    // Skip if overlay is open
    if (isCommandPaletteOpen() || isBibleRefsOpen()) return;

    // ESC to go back
    if (key.name === 'escape') {
      props.onBack?.();
      return;
    }

    // Space to open Bible refs popup
    if (key.name === 'space') {
      const para = currentParagraph();
      if (para) {
        setIsBibleRefsOpen(true);
      }
      return;
    }

    // Ctrl+P to open command palette
    if (key.ctrl && key.name === 'p') {
      setIsCommandPaletteOpen(true);
      return;
    }

    // Goto mode (g, gg, G, g{number})
    if (handleGotoModeKeys(key, gotoMode(), setGotoMode, executeGotoAction)) {
      return;
    }

    // Shift+j/down for next page, Shift+k/up for previous page
    if (key.shift && (key.name === 'j' || key.name === 'down')) {
      nextPage();
      return;
    }
    if (key.shift && (key.name === 'k' || key.name === 'up')) {
      prevPage();
      return;
    }

    // Navigation: j/k or up/down for paragraph
    if (key.name === 'j' || key.name === 'down') {
      nextParagraph();
      return;
    }
    if (key.name === 'k' || key.name === 'up') {
      prevParagraph();
      return;
    }

    // Chapter navigation: h/l or left/right for chapter
    if (key.name === 'l' || key.name === 'right') {
      nextChapter();
      return;
    }
    if (key.name === 'h' || key.name === 'left') {
      prevChapter();
      return;
    }
  });

  return (
    <box
      width={dimensions().width}
      height={dimensions().height}
      flexDirection="column"
      backgroundColor={theme().background}
    >
      <EGWTopbar />

      <EGWChapterView />

      <EGWFooter gotoMode={gotoMode()} />

      {/* Command Palette Overlay */}
      <Show when={isCommandPaletteOpen()}>
        <box
          position="absolute"
          top={Math.floor(dimensions().height / 6)}
          left={Math.floor((dimensions().width - 70) / 2)}
        >
          <EGWCommandPalette onClose={() => setIsCommandPaletteOpen(false)} />
        </box>
      </Show>

      {/* Bible References Popup */}
      <Show when={isBibleRefsOpen() && currentParagraph()}>
        <box
          position="absolute"
          top={Math.floor(dimensions().height / 6)}
          left={Math.floor((dimensions().width - 70) / 2)}
        >
          <EGWBibleRefsPopup
            paragraph={currentParagraph()!}
            onClose={() => setIsBibleRefsOpen(false)}
            onNavigate={(ref) => {
              setIsBibleRefsOpen(false);
              navigateToBible(ref);
            }}
          />
        </box>
      </Show>
    </box>
  );
}
