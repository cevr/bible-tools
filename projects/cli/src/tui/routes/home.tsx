import { For } from 'solid-js';

import type { Route } from '../app.js';

interface HomeViewProps {
  onNavigate: (route: Route) => void;
}

export function HomeView(props: HomeViewProps) {
  const menuItems = [
    { key: '1', label: 'Messages', description: 'Generate and manage sermon messages', route: 'messages' as Route },
    { key: '2', label: 'Sabbath School', description: 'Process lesson outlines', route: 'sabbath-school' as Route },
    { key: '3', label: 'Studies', description: 'Create Bible study materials', route: 'studies' as Route },
  ];

  return (
    <box flexDirection="column" gap={1}>
      <text fg="#f3f4f6">Select a tool:</text>
      <box flexDirection="column" gap={1} marginTop={1}>
        <For each={menuItems}>
          {(item) => (
            <box flexDirection="row" gap={2}>
              <text fg="#3b82f6">[{item.key}]</text>
              <text fg="#f3f4f6">{item.label}</text>
              <text fg="#6b7280">- {item.description}</text>
            </box>
          )}
        </For>
      </box>
    </box>
  );
}
