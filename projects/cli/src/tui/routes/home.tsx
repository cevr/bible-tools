import { For } from 'solid-js';

type RouteName = 'messages' | 'sabbath-school' | 'studies' | 'egw';

interface HomeViewProps {
  onNavigate: (route: RouteName) => void;
}

export function HomeView(props: HomeViewProps) {
  const menuItems: Array<{
    key: string;
    label: string;
    description: string;
    route: RouteName;
  }> = [
    {
      key: '1',
      label: 'Messages',
      description: 'Generate and manage sermon messages',
      route: 'messages',
    },
    {
      key: '2',
      label: 'Sabbath School',
      description: 'Process lesson outlines',
      route: 'sabbath-school',
    },
    {
      key: '3',
      label: 'Studies',
      description: 'Create Bible study materials',
      route: 'studies',
    },
    {
      key: '4',
      label: 'EGW Library',
      description: 'Browse Ellen G. White writings',
      route: 'egw',
    },
  ];

  return (
    <box
      flexDirection="column"
      gap={1}
    >
      <text fg="#f3f4f6">Select a tool:</text>
      <box
        flexDirection="column"
        gap={1}
        marginTop={1}
      >
        <For each={menuItems}>
          {(item) => (
            <box
              flexDirection="row"
              gap={2}
            >
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
