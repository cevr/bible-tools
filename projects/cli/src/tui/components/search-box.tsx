import { useKeyboard } from '@opentui/solid';
import { createSignal, onMount, Show } from 'solid-js';

import { useSearch } from '../context/search.js';
import { useTheme } from '../context/theme.js';

interface SearchBoxProps {
  onClose: () => void;
}

export function SearchBox(props: SearchBoxProps) {
  const { theme } = useTheme();
  const {
    query,
    setQuery,
    matches,
    currentMatchIndex,
    totalMatches,
    nextMatch,
    prevMatch,
  } = useSearch();

  // Delay rendering the input until after the triggering keystroke is processed
  const [ready, setReady] = createSignal(false);
  onMount(() => {
    setTimeout(() => setReady(true), 16); // ~1 frame
  });

  useKeyboard((key) => {
    // Escape - close search
    if (key.name === 'escape') {
      props.onClose();
      return;
    }

    // Enter or down - next match
    if (key.name === 'return' || key.name === 'down') {
      nextMatch();
      return;
    }

    // Up - previous match
    if (key.name === 'up') {
      prevMatch();
      return;
    }

    // Ctrl+N - next match
    if (key.ctrl && key.name === 'n') {
      nextMatch();
      return;
    }

    // Ctrl+P - previous match (in search context)
    if (key.ctrl && key.name === 'p') {
      prevMatch();
      return;
    }
  });

  // Status text
  const statusText = () => {
    const total = totalMatches();
    if (query().length < 2) return 'Type to search...';
    if (total === 0) return 'No matches';
    const matchCount = matches().length;
    const idx = currentMatchIndex();
    return `${idx + 1}/${matchCount} verses (${total} matches)`;
  };

  return (
    <box
      flexDirection="row"
      border
      borderColor={theme().borderFocused}
      backgroundColor={theme().backgroundPanel}
      paddingLeft={1}
      paddingRight={1}
      height={3}
      minWidth={30}
      gap={1}
    >
      {/* Search icon/label */}
      <text fg={theme().accent}>/</text>

      {/* Input - delayed render to skip trigger keystroke */}
      <box
        flexGrow={1}
        height={1}
      >
        <Show
          when={ready()}
          fallback={<text fg={theme().textMuted}>Search...</text>}
        >
          <input
            placeholder="Search..."
            focused
            onInput={setQuery}
          />
        </Show>
      </box>

      {/* Status */}
      <text fg={theme().textMuted}>{statusText()}</text>
    </box>
  );
}
