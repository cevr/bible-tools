import { createCliRenderer } from '@opentui/core';
import { createRoot, useKeyboard, useTerminalDimensions } from '@opentui/react';
import { useState } from 'react';

import { HomeView } from './routes/home.js';
import { MessagesView } from './routes/messages.js';
import { SabbathSchoolView } from './routes/sabbath-school.js';
import { StudiesView } from './routes/studies.js';

export type Route = 'home' | 'messages' | 'sabbath-school' | 'studies';

function App() {
  const dimensions = useTerminalDimensions();
  const [route, setRoute] = useState<Route>('home');

  useKeyboard((key) => {
    // Global navigation shortcuts
    if (key.name === 'escape') {
      if (route !== 'home') {
        setRoute('home');
      }
    }
    if (key.ctrl && key.name === 'c') {
      process.exit(0);
    }
    // Quick navigation from home
    if (route === 'home') {
      if (key.name === '1') setRoute('messages');
      if (key.name === '2') setRoute('sabbath-school');
      if (key.name === '3') setRoute('studies');
    }
  });

  return (
    <box
      width={dimensions.width}
      height={dimensions.height}
      flexDirection="column"
      backgroundColor="#0a0a0a"
    >
      {/* Header */}
      <box
        title="Bible Tools"
        border
        borderStyle="double"
        borderColor="#3b82f6"
        padding={1}
        height={5}
      >
        <text fg="#60a5fa">
          {route === 'home' && 'Welcome! Select a tool to get started.'}
          {route === 'messages' && 'Messages - Generate and manage sermon messages'}
          {route === 'sabbath-school' && 'Sabbath School - Process lesson outlines'}
          {route === 'studies' && 'Studies - Create Bible study materials'}
        </text>
      </box>

      {/* Content */}
      <box flexGrow={1} padding={1}>
        {route === 'home' && <HomeView onNavigate={setRoute} />}
        {route === 'messages' && <MessagesView onBack={() => setRoute('home')} />}
        {route === 'sabbath-school' && <SabbathSchoolView onBack={() => setRoute('home')} />}
        {route === 'studies' && <StudiesView onBack={() => setRoute('home')} />}
      </box>

      {/* Footer */}
      <box height={3} border borderColor="#374151" padding={1}>
        <text fg="#6b7280">
          {route === 'home'
            ? 'Press 1-3 to navigate | Ctrl+C to exit'
            : 'ESC to go back | Ctrl+C to exit'}
        </text>
      </box>
    </box>
  );
}

export async function tui() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
  });
  createRoot(renderer).render(<App />);
}
