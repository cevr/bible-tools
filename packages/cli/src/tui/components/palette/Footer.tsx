import { Show } from 'solid-js';

import { useModel } from '../../context/model.js';
import { useTheme } from '../../context/theme.js';

/**
 * Palette footer with keyboard hints.
 */
export function PaletteFooter() {
  const { theme } = useTheme();
  const model = useModel();

  return (
    <box height={1} marginTop={1}>
      <text fg={theme().textMuted}>
        <span style={{ fg: theme().accent }}>Enter</span> select
        <span> </span>
        <span style={{ fg: theme().accent }}>↑↓</span> navigate
        <span> </span>
        <Show when={model}>
          <span style={{ fg: theme().accent }}>?</span> AI search
          <span> </span>
        </Show>
        <span style={{ fg: theme().accent }}>Esc</span> close
      </text>
    </box>
  );
}
