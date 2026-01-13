/**
 * EGW Topbar
 *
 * Displays the current book title centered.
 */

import { Show } from 'solid-js';

import { useEGWNavigation } from '../context/egw-navigation.js';
import { useTheme } from '../context/theme.js';

export function EGWTopbar() {
  const { theme } = useTheme();
  const { currentBook } = useEGWNavigation();

  return (
    <box
      height={1}
      paddingLeft={2}
      paddingRight={2}
      backgroundColor={theme().backgroundPanel}
      flexDirection="row"
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
        <text fg={theme().textHighlight}>
          <strong>{currentBook()!.title}</strong>
        </text>
      </Show>
    </box>
  );
}
