import type { ParentProps } from 'solid-js';

import { useTheme } from '../../context/theme.js';

interface PaletteFrameProps extends ParentProps {
  minWidth?: number;
  maxHeight?: number;
}

/**
 * Container frame for the palette.
 * Provides consistent styling for palette overlays.
 */
export function PaletteFrame(props: PaletteFrameProps) {
  const { theme } = useTheme();

  return (
    <box
      flexDirection="column"
      border
      borderColor={theme().borderFocused}
      backgroundColor={theme().backgroundPanel}
      padding={1}
      minWidth={props.minWidth ?? 60}
      maxHeight={props.maxHeight ?? 22}
    >
      {props.children}
    </box>
  );
}
