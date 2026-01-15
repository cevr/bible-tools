import type { Component, ParentProps } from 'solid-js';
import { Suspense } from 'solid-js';
import { EffectProvider } from './providers/effect-provider';
import { KeyboardProvider } from './providers/keyboard-provider';
import { OverlayProvider } from './providers/overlay-provider';
import { BibleProvider } from './providers/bible-provider';
import { AppShell } from './components/layout/app-shell';
import { CommandPalette } from './components/shared/command-palette';
import { GotoDialog } from './components/shared/goto-dialog';
import { SearchOverlay } from './components/shared/search-overlay';
import { CrossRefsPopup } from './components/shared/cross-refs-popup';

/**
 * Main App component that sets up providers and renders routes.
 * Routes are defined using the Router in index.tsx.
 */
const App: Component<ParentProps> = (props) => {
  return (
    <EffectProvider>
      <BibleProvider>
        <KeyboardProvider>
          <OverlayProvider>
            <AppShell>
              <Suspense fallback={<LoadingScreen />}>{props.children}</Suspense>
              <CommandPalette />
              <GotoDialog />
              <SearchOverlay />
              <CrossRefsPopup />
            </AppShell>
          </OverlayProvider>
        </KeyboardProvider>
      </BibleProvider>
    </EffectProvider>
  );
};

const LoadingScreen: Component = () => {
  return (
    <div class="flex h-screen w-full items-center justify-center">
      <div class="text-[--color-ink-muted] animate-pulse">Loading...</div>
    </div>
  );
};

export default App;
