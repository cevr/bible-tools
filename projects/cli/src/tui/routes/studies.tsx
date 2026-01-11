import { useKeyboard } from '@opentui/solid';
import { createSignal, Show } from 'solid-js';

interface StudiesViewProps {
  onBack: () => void;
}

type View = 'menu' | 'generate' | 'list';

export function StudiesView(props: StudiesViewProps) {
  const [view, setView] = createSignal<View>('menu');
  const [status, _setStatus] = createSignal<string>('');

  useKeyboard((key) => {
    if (view() === 'menu') {
      if (key.name === '1') setView('generate');
      if (key.name === '2') setView('list');
    }
    if (key.name === 'escape' && view() !== 'menu') {
      setView('menu');
    }
  });

  return (
    <Show
      when={view() === 'menu'}
      fallback={
        <Show
          when={view() === 'generate'}
          fallback={
            <box flexDirection="column" gap={1}>
              <text fg="#f3f4f6">Study List</text>
              <text fg="#6b7280">Coming soon - Browse and manage studies</text>
              <text fg="#6b7280" marginTop={1}>Press ESC to go back</text>
            </box>
          }
        >
          <box flexDirection="column" gap={1}>
            <text fg="#f3f4f6">Generate Study</text>
            <text fg="#6b7280">Coming soon - Interactive study generation</text>
            <text fg="#6b7280" marginTop={1}>Press ESC to go back</text>
          </box>
        </Show>
      }
    >
      <box flexDirection="column" gap={1}>
        <text fg="#f3f4f6">Studies Menu:</text>
        <box flexDirection="column" gap={1} marginTop={1}>
          <box flexDirection="row" gap={2}>
            <text fg="#3b82f6">[1]</text>
            <text fg="#f3f4f6">Generate</text>
            <text fg="#6b7280">- Create a new Bible study</text>
          </box>
          <box flexDirection="row" gap={2}>
            <text fg="#3b82f6">[2]</text>
            <text fg="#f3f4f6">List</text>
            <text fg="#6b7280">- Browse existing studies</text>
          </box>
        </box>
        <Show when={status()}>
          <text fg="#fbbf24" marginTop={1}>{status()}</text>
        </Show>
      </box>
    </Show>
  );
}
