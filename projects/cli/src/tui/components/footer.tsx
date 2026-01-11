import { For } from 'solid-js';

import { useTheme } from '../context/theme.js';

interface FooterProps {
  hints?: Array<{ key: string; action: string }>;
}

const DEFAULT_HINTS = [
  { key: 'j/k', action: 'scroll' },
  { key: 'h/l', action: 'chapter' },
  { key: 'Ctrl+P', action: 'search' },
  { key: 'Ctrl+T', action: 'tools' },
  { key: 'Ctrl+C', action: 'exit' },
];

export function Footer(props: FooterProps) {
  const { theme } = useTheme();
  const hints = () => props.hints ?? DEFAULT_HINTS;

  return (
    <box
      height={3}
      borderColor={theme().border}
      border={['top']}
      paddingLeft={2}
      paddingRight={2}
      flexDirection="row"
      alignItems="center"
      gap={3}
      backgroundColor={theme().backgroundPanel}
    >
      <For each={hints()}>
        {(hint) => (
          <text fg={theme().textMuted}>
            <span style={{ fg: theme().accent }}>{hint.key}</span>
            <span> {hint.action}</span>
          </text>
        )}
      </For>
    </box>
  );
}
