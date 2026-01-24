import { useTheme } from '../../context/theme.js';
import { usePalette } from './context.js';

/**
 * Palette search input - a simple, focused input component.
 * Consumes setQuery from PaletteContext.
 */
export function PaletteInput() {
  const { theme } = useTheme();
  const { setQuery } = usePalette();

  return (
    <box height={3} border borderColor={theme().border} marginBottom={1}>
      <input placeholder="Search verses, books, or commands..." focused onInput={setQuery} />
    </box>
  );
}
