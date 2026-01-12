import { render, useKeyboard, useTerminalDimensions, useRenderer } from '@opentui/solid';
import { createSignal, Show } from 'solid-js';

import type { Reference } from '../bible/types.js';
import { BibleProvider } from './context/bible.js';
import { StudyDataProvider } from './context/study-data.js';
import { ThemeProvider, useTheme } from './context/theme.js';
import { NavigationProvider } from './context/navigation.js';
import { DisplayProvider } from './context/display.js';
import { SearchProvider } from './context/search.js';
import { ModelProvider, type ModelService } from './context/model.js';
import { ExitProvider } from './context/exit.js';
import { OverlayProvider } from './context/overlay.js';
import { WordModeProvider } from './context/word-mode.js';
import { BibleView } from './routes/bible.js';
import { MessagesView } from './routes/messages.js';
import { SabbathSchoolView } from './routes/sabbath-school.js';
import { StudiesView } from './routes/studies.js';

export type Route = 'bible' | 'messages' | 'sabbath-school' | 'studies';

// Re-export useExit for components that need it
export { useExit } from './context/exit.js';

interface AppProps {
  initialRef?: Reference;
  model?: ModelService | null;
}

function AppContent(props: AppProps) {
  const { theme } = useTheme();
  const dimensions = useTerminalDimensions();
  const renderer = useRenderer();
  const [route, setRoute] = createSignal<Route>('bible');

  const handleExit = () => {
    renderer.destroy();
    process.exit(0);
  };

  useKeyboard((key) => {
    // Global: ESC to return to Bible view
    if (key.name === 'escape' && route() !== 'bible') {
      setRoute('bible');
      return;
    }
    // Global: Ctrl+C to exit
    if (key.ctrl && key.name === 'c') {
      handleExit();
    }
  });

  const handleNavigateToRoute = (routeName: string) => {
    if (routeName === 'messages' || routeName === 'sabbath-school' || routeName === 'studies') {
      setRoute(routeName as Route);
    }
  };

  return (
    <NavigationProvider initialRef={props.initialRef}>
      <SearchProvider>
        <DisplayProvider>
          <OverlayProvider>
            <StudyDataProvider>
            <WordModeProvider>
            <ExitProvider onExit={handleExit}>
              <box
              width={dimensions().width}
              height={dimensions().height}
              flexDirection="column"
              backgroundColor={theme().background}
            >
              <Show when={route() === 'bible'}>
                <BibleView onNavigateToRoute={handleNavigateToRoute} />
              </Show>
              <Show when={route() === 'messages'}>
                <MessagesView onBack={() => setRoute('bible')} />
              </Show>
              <Show when={route() === 'sabbath-school'}>
                <SabbathSchoolView onBack={() => setRoute('bible')} />
              </Show>
              <Show when={route() === 'studies'}>
                <StudiesView onBack={() => setRoute('bible')} />
              </Show>
              </box>
            </ExitProvider>
            </WordModeProvider>
            </StudyDataProvider>
          </OverlayProvider>
        </DisplayProvider>
      </SearchProvider>
    </NavigationProvider>
  );
}

// Wrapper that provides ThemeProvider with renderer access
function AppWithTheme(props: AppProps) {
  const renderer = useRenderer();

  return (
    <ThemeProvider renderer={renderer}>
      <ModelProvider model={props.model ?? null}>
        <AppContent initialRef={props.initialRef} model={props.model} />
      </ModelProvider>
    </ThemeProvider>
  );
}

function App(props: AppProps) {
  return (
    <BibleProvider>
      <AppWithTheme initialRef={props.initialRef} model={props.model} />
    </BibleProvider>
  );
}

export interface TuiOptions {
  initialRef?: Reference;
  model?: ModelService | null;
}

export async function tui(options?: TuiOptions) {
  await render(
    () => <App initialRef={options?.initialRef} model={options?.model} />,
    {
      exitOnCtrlC: false,
    }
  );
}
