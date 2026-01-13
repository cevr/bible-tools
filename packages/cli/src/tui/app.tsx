import { isRoute, Route } from '@bible/core/app';
import type { EGWReference } from '@bible/core/app';
import {
  render,
  useKeyboard,
  useRenderer,
  useTerminalDimensions,
} from '@opentui/solid';
import { createSignal, Match, Show, Switch } from 'solid-js';

import type { Reference } from '../data/bible/types.js';
import { ToolsPalette } from './components/shared/tools-palette.js';
import { BibleProvider } from './context/bible.js';
import { DisplayProvider } from './context/display.js';
import { EGWNavigationProvider } from './context/egw-navigation.js';
import { EGWProvider } from './context/egw.js';
import { ExitProvider } from './context/exit.js';
import { ModelProvider, type ModelService } from './context/model.js';
import { NavigationProvider } from './context/navigation.js';
import { OverlayProvider } from './context/overlay.js';
import { RouterProvider, useRouter } from './context/router.js';
import { SearchProvider } from './context/search.js';
import { StudyDataProvider } from './context/study-data.js';
import { ThemeProvider, useTheme } from './context/theme.js';
import { WordModeProvider } from './context/word-mode.js';
import { BibleView } from './routes/bible.js';
import { EGWView } from './routes/egw.js';
import { MessagesView } from './routes/messages.js';
import { SabbathSchoolView } from './routes/sabbath-school.js';
import { StudiesView } from './routes/studies.js';

// Re-export useExit for components that need it
export { useExit } from './context/exit.js';
// Re-export router hooks
export { useRouter, useRoute } from './context/router.js';

interface AppProps {
  initialRef?: Reference;
  /** EGW reference. Pass empty object {} to open EGW reader without specific ref */
  initialEgwRef?: Partial<EGWReference>;
  model?: ModelService | null;
}

function AppContent(props: AppProps) {
  const { theme } = useTheme();
  const dimensions = useTerminalDimensions();
  const renderer = useRenderer();
  const {
    route,
    back,
    canGoBack,
    navigateToBible,
    navigateToMessages,
    navigateToSabbathSchool,
    navigateToStudies,
    navigateToEgw,
  } = useRouter();

  // Global tools palette state
  const [isToolsPaletteOpen, setIsToolsPaletteOpen] = createSignal(false);

  const handleExit = () => {
    renderer.destroy();
    process.exit(0);
  };

  useKeyboard((key) => {
    // Skip global handlers if tools palette is open
    if (isToolsPaletteOpen()) return;

    // Global: ESC to go back or stay at Bible if no history
    if (key.name === 'escape') {
      if (canGoBack()) {
        back();
      }
      return;
    }
    // Global: Ctrl+C to exit
    if (key.ctrl && key.name === 'c') {
      handleExit();
    }
    // Global: Ctrl+T to open tools palette
    if (key.ctrl && key.name === 't') {
      setIsToolsPaletteOpen(true);
    }
  });

  const handleNavigateToRoute = (routeName: string) => {
    switch (routeName) {
      case 'bible':
        navigateToBible();
        break;
      case 'messages':
        navigateToMessages();
        break;
      case 'sabbath-school':
        navigateToSabbathSchool();
        break;
      case 'studies':
        navigateToStudies();
        break;
      case 'egw':
        navigateToEgw();
        break;
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
                    <Switch>
                      <Match when={isRoute.bible(route())}>
                        <BibleView onNavigateToRoute={handleNavigateToRoute} />
                      </Match>
                      <Match when={isRoute.messages(route())}>
                        <MessagesView
                          onBack={() => back() || navigateToBible()}
                        />
                      </Match>
                      <Match when={isRoute.sabbathSchool(route())}>
                        <SabbathSchoolView
                          onBack={() => back() || navigateToBible()}
                        />
                      </Match>
                      <Match when={isRoute.studies(route())}>
                        <StudiesView
                          onBack={() => back() || navigateToBible()}
                        />
                      </Match>
                      <Match when={isRoute.egw(route())}>
                        <EGWProvider>
                          <EGWNavigationProvider
                            initialRef={
                              isRoute.egw(route())
                                ? (
                                    route() as {
                                      _tag: 'egw';
                                      ref?: EGWReference;
                                    }
                                  ).ref
                                : undefined
                            }
                          >
                            <EGWView
                              onBack={() => back() || navigateToBible()}
                            />
                          </EGWNavigationProvider>
                        </EGWProvider>
                      </Match>
                    </Switch>

                    {/* Global Tools Palette */}
                    <Show when={isToolsPaletteOpen()}>
                      <box
                        position="absolute"
                        top={Math.floor(dimensions().height / 6)}
                        left={Math.floor((dimensions().width - 50) / 2)}
                      >
                        <ToolsPalette
                          onClose={() => setIsToolsPaletteOpen(false)}
                          onNavigateToRoute={handleNavigateToRoute}
                        />
                      </box>
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
        <AppContent {...props} />
      </ModelProvider>
    </ThemeProvider>
  );
}

function App(props: AppProps) {
  // Determine initial route based on props
  // initialEgwRef can be {} to indicate "go to EGW" without a specific reference
  const initialRoute = props.initialEgwRef
    ? Route.egw(
        props.initialEgwRef.bookCode
          ? (props.initialEgwRef as EGWReference)
          : undefined,
      )
    : props.initialRef
      ? Route.bible({
          book: props.initialRef.book,
          chapter: props.initialRef.chapter,
          verse: props.initialRef.verse,
        })
      : Route.bible();

  return (
    <BibleProvider>
      <RouterProvider initialRoute={initialRoute}>
        <AppWithTheme {...props} />
      </RouterProvider>
    </BibleProvider>
  );
}

export interface TuiOptions {
  initialRef?: Reference;
  /** EGW reference. Pass empty object {} to open EGW reader without specific ref */
  initialEgwRef?: Partial<EGWReference>;
  model?: ModelService | null;
}

export async function tui(options?: TuiOptions) {
  await render(
    () => (
      <App
        initialRef={options?.initialRef}
        initialEgwRef={options?.initialEgwRef}
        model={options?.model}
      />
    ),
    {
      exitOnCtrlC: false,
    },
  );
}
