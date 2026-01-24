import { useKeyboard } from '@opentui/solid';
import { createMemo, createSignal, Match, Show, Switch } from 'solid-js';

import { getSubview, SabbathSchoolViewState } from '../types/view-state.js';

interface SabbathSchoolViewProps {
  onBack: () => void;
}

export function SabbathSchoolView(props: SabbathSchoolViewProps) {
  const [viewState, setViewState] = createSignal<SabbathSchoolViewState>(
    SabbathSchoolViewState.menu(),
  );
  const [status, _setStatus] = createSignal<string>('');

  // Derived accessor for current subview (null when on menu)
  const subview = createMemo(() => getSubview(viewState()));

  useKeyboard((key) => {
    const state = viewState();

    if (state._tag === 'menu') {
      if (key.name === '1') setViewState(SabbathSchoolViewState.process());
      if (key.name === '2') setViewState(SabbathSchoolViewState.list());
      if (key.name === 'escape') props.onBack();
    }

    if (key.name === 'escape' && state._tag === 'subview') {
      setViewState(SabbathSchoolViewState.menu());
    }
  });

  return (
    <Switch>
      <Match when={viewState()._tag === 'menu'}>
        <box flexDirection="column" gap={1}>
          <text fg="#f3f4f6">Sabbath School Menu:</text>
          <box flexDirection="column" gap={1} marginTop={1}>
            <box flexDirection="row" gap={2}>
              <text fg="#3b82f6">[1]</text>
              <text fg="#f3f4f6">Process</text>
              <text fg="#6b7280">- Download and generate outline for current week</text>
            </box>
            <box flexDirection="row" gap={2}>
              <text fg="#3b82f6">[2]</text>
              <text fg="#f3f4f6">List</text>
              <text fg="#6b7280">- Browse existing outlines</text>
            </box>
          </box>
          <Show when={status()}>
            <text fg="#fbbf24" marginTop={1}>
              {status()}
            </text>
          </Show>
        </box>
      </Match>

      <Match when={subview() === 'process'}>
        <box flexDirection="column" gap={1}>
          <text fg="#f3f4f6">Process Sabbath School Lesson</text>
          <text fg="#6b7280">Coming soon - Interactive lesson processing</text>
          <text fg="#6b7280" marginTop={1}>
            Press ESC to go back
          </text>
        </box>
      </Match>

      <Match when={subview() === 'list'}>
        <box flexDirection="column" gap={1}>
          <text fg="#f3f4f6">Sabbath School Outlines</text>
          <text fg="#6b7280">Coming soon - Browse and manage outlines</text>
          <text fg="#6b7280" marginTop={1}>
            Press ESC to go back
          </text>
        </box>
      </Match>
    </Switch>
  );
}
