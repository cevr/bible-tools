import { useKeyboard } from '@opentui/solid';
import { createMemo, createSignal, Match, Show, Switch } from 'solid-js';

import { getSubview, MessagesViewState } from '../types/view-state.js';

interface MessagesViewProps {
  onBack: () => void;
}

export function MessagesView(_props: MessagesViewProps) {
  const [viewState, setViewState] = createSignal<MessagesViewState>(MessagesViewState.menu());
  const [status, _setStatus] = createSignal<string>('');

  // Derived accessor for current subview (null when on menu)
  const subview = createMemo(() => getSubview(viewState()));

  useKeyboard((key) => {
    const state = viewState();

    if (state._tag === 'menu') {
      if (key.name === '1') setViewState(MessagesViewState.generate());
      if (key.name === '2') setViewState(MessagesViewState.list());
    }

    if (key.name === 'escape' && state._tag === 'subview') {
      setViewState(MessagesViewState.menu());
    }
  });

  return (
    <Switch>
      <Match when={viewState()._tag === 'menu'}>
        <box flexDirection="column" gap={1}>
          <text fg="#f3f4f6">Messages Menu:</text>
          <box flexDirection="column" gap={1} marginTop={1}>
            <box flexDirection="row" gap={2}>
              <text fg="#3b82f6">[1]</text>
              <text fg="#f3f4f6">Generate</text>
              <text fg="#6b7280">- Create a new message</text>
            </box>
            <box flexDirection="row" gap={2}>
              <text fg="#3b82f6">[2]</text>
              <text fg="#f3f4f6">List</text>
              <text fg="#6b7280">- Browse existing messages</text>
            </box>
          </box>
          <Show when={status()}>
            <text fg="#fbbf24" marginTop={1}>
              {status()}
            </text>
          </Show>
        </box>
      </Match>

      <Match when={subview() === 'generate'}>
        <box flexDirection="column" gap={1}>
          <text fg="#f3f4f6">Generate Message</text>
          <text fg="#6b7280">Coming soon - Interactive message generation</text>
          <text fg="#6b7280" marginTop={1}>
            Press ESC to go back
          </text>
        </box>
      </Match>

      <Match when={subview() === 'list'}>
        <box flexDirection="column" gap={1}>
          <text fg="#f3f4f6">Message List</text>
          <text fg="#6b7280">Coming soon - Browse and manage messages</text>
          <text fg="#6b7280" marginTop={1}>
            Press ESC to go back
          </text>
        </box>
      </Match>
    </Switch>
  );
}
