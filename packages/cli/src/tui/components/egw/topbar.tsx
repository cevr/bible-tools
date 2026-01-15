/**
 * EGW Topbar
 *
 * Displays the current book title and chapter name centered.
 */

import { Show } from 'solid-js';

import { useEGWNavigation } from '../../context/egw-navigation.js';
import { useTheme } from '../../context/theme.js';

export function EGWTopbar() {
  const { theme } = useTheme();
  const { currentBook, currentChapter } = useEGWNavigation();

  return (
    <box
      height={2}
      paddingLeft={2}
      paddingRight={2}
      backgroundColor={theme().backgroundPanel}
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
    >
      <Show
        when={currentBook()}
        fallback={
          <text fg={theme().accent}>
            <strong>EGW Library</strong>
          </text>
        }
      >
        <text fg={theme().textMuted}>{currentBook()?.title}</text>
        <Show when={currentChapter()}>
          <text fg={theme().textHighlight}>
            <strong>{currentChapter()?.title}</strong>
          </text>
        </Show>
      </Show>
    </box>
  );
}
