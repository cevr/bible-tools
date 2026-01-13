import { useKeyboard } from '@opentui/solid';

import {
  PaletteFooter,
  PaletteFrame,
  PaletteInput,
  PaletteOptionList,
  PaletteProvider,
  usePalette,
  type CommandGroup,
  type CommandOption,
  type CommandType,
  type GroupType,
} from '../palette/index.js';

// Re-export types for consumers
export type { GroupType, CommandType, CommandOption, CommandGroup };

interface CommandPaletteProps {
  onClose: () => void;
}

// Main entry point
export function CommandPalette(props: CommandPaletteProps) {
  return (
    <PaletteProvider onClose={props.onClose}>
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
