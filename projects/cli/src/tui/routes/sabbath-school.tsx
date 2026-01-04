import { useKeyboard } from '@opentui/react';
import { useState } from 'react';

interface SabbathSchoolViewProps {
  onBack: () => void;
}

type View = 'menu' | 'process' | 'list';

export function SabbathSchoolView({ onBack }: SabbathSchoolViewProps) {
  const [view, setView] = useState<View>('menu');
  const [status, _setStatus] = useState<string>('');

  useKeyboard((key) => {
    if (view === 'menu') {
      if (key.name === '1') setView('process');
      if (key.name === '2') setView('list');
    }
    if (key.name === 'escape' && view !== 'menu') {
      setView('menu');
    }
  });

  if (view === 'process') {
    return (
      <box flexDirection="column" gap={1}>
        <text fg="#f3f4f6">Process Sabbath School Lesson</text>
        <text fg="#6b7280">Coming soon - Interactive lesson processing</text>
        <text fg="#6b7280" marginTop={1}>Press ESC to go back</text>
      </box>
    );
  }

  if (view === 'list') {
    return (
      <box flexDirection="column" gap={1}>
        <text fg="#f3f4f6">Sabbath School Outlines</text>
        <text fg="#6b7280">Coming soon - Browse and manage outlines</text>
        <text fg="#6b7280" marginTop={1}>Press ESC to go back</text>
      </box>
    );
  }

  return (
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
      {status && <text fg="#fbbf24" marginTop={1}>{status}</text>}
    </box>
  );
}
