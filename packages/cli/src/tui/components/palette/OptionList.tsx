import { createMemo, For, Show } from 'solid-js';

import { useTheme } from '../../context/theme.js';
import { is } from '@bible/core/utils';
import { usePalette, type CommandOption } from './context.js';
import { PaletteGroupHeader, PaletteOption } from './Option.js';

type RenderItem =
  | { _tag: 'header'; label: string; isFirst: boolean }
  | { _tag: 'option'; option: CommandOption; flatIndex: number };

interface PaletteOptionListProps {
  maxVisible?: number;
}

export function PaletteOptionList(props: PaletteOptionListProps) {
  const { theme } = useTheme();
  const { groups, selectedIndex } = usePalette();
  const maxVisible = () => props.maxVisible ?? 12;

  const renderItems = createMemo((): RenderItem[] => {
    const items: RenderItem[] = [];
    let flatIndex = 0;
    let isFirst = true;

    for (const group of groups()) {
      items.push({ _tag: 'header', label: group.label, isFirst });
      isFirst = false;

      for (const option of group.options) {
        items.push({ _tag: 'option', option, flatIndex });
        flatIndex++;
      }
    }

    return items;
  });

  const visibleItems = () => renderItems().slice(0, maxVisible());

  return (
    <box flexDirection="column" flexGrow={1}>
      <Show
        when={visibleItems().length > 0}
        fallback={
          <text fg={theme().textMuted} style={{ padding: 1 }}>
            No results found
          </text>
        }
      >
        <For each={visibleItems()}>
          {(item) => {
            if (is(item, 'header')) {
              return <PaletteGroupHeader label={item.label} isFirst={item.isFirst} />;
            }
            return (
              <PaletteOption option={item.option} isSelected={item.flatIndex === selectedIndex()} />
            );
          }}
        </For>
      </Show>
    </box>
  );
}
