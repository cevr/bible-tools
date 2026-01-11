import { useKeyboard } from '@opentui/solid';
import { createMemo, createSignal, Match, Show, Switch } from 'solid-js';

import { StudiesViewState, getSubview } from '../types/view-state.js';

interface StudiesViewProps {
  onBack: () => void;
}

export function StudiesView(props: StudiesViewProps) {
  const [viewState, setViewState] = createSignal<StudiesViewState>(StudiesViewState.menu());
  const [status, _setStatus] = createSignal<string>('');

  // Derived accessor for current subview (null when on menu)
  const subview = createMemo(() => getSubview(viewState()));

  useKeyboard((key) => {
    const state = viewState();

    if (state._tag === 'menu') {
      if (key.name === '1') setViewState(StudiesViewState.generate());
      if (key.name === '2') setViewState(StudiesViewState.list());
    }

    if (key.name === 'escape' && state._tag === 'subview') {
      setViewState(StudiesViewState.menu());
    }
  });

  return (
    <Switch>
      <Match when={viewState()._tag === 'menu'}>
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
      </Match>

      <Match when={subview() === 'generate'}>
        <box flexDirection="column" gap={1}>
          <text fg="#f3f4f6">Generate Study</text>
          <text fg="#6b7280">Coming soon - Interactive study generation</text>
          <text fg="#6b7280" marginTop={1}>Press ESC to go back</text>
        </box>
      </Match>

      <Match when={subview() === 'list'}>
        <box flexDirection="column" gap={1}>
          <text fg="#f3f4f6">Study List</text>
          <text fg="#6b7280">Coming soon - Browse and manage studies</text>
          <text fg="#6b7280" marginTop={1}>Press ESC to go back</text>
        </box>
      </Match>
    </Switch>
  );
}
