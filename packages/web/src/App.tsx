import type { Component, ParentProps } from 'solid-js';
import { Suspense } from 'solid-js';
import { DbProvider } from './providers/db-provider';
import { KeyboardProvider } from './providers/keyboard-provider';
import { OverlayProvider } from './providers/overlay-provider';
import { BibleProvider } from './providers/bible-provider';
import { AppShell } from './components/layout/app-shell';
import { CommandPalette } from './components/shared/command-palette';
import { GotoDialog } from './components/shared/goto-dialog';
import { SearchOverlay } from './components/shared/search-overlay';
import { CrossRefsPopup } from './components/shared/cross-refs-popup';
import { ConcordanceSearch } from './components/study/concordance-search';
import { BookmarksPanel } from './components/shared/bookmarks-panel';
import { HistoryPanel } from './components/shared/history-panel';

/**
 * Main App component that sets up providers and renders routes.
 * DbProvider blocks render until SQLite is ready and hosts the Effect runtime.
 */
const App: Component<ParentProps> = (props) => {
  console.log('[app] render');
  return (
    <DbProvider>
      <BibleProvider>
        <KeyboardProvider>
          <OverlayProvider>
            <AppShell>
              <Suspense fallback={<FallbackScreen />}>{props.children}</Suspense>
              <CommandPalette />
              <GotoDialog />
              <SearchOverlay />
              <CrossRefsPopup />
              <ConcordanceSearch />
              <BookmarksPanel />
              <HistoryPanel />
            </AppShell>
          </OverlayProvider>
        </KeyboardProvider>
      </BibleProvider>
    </DbProvider>
  );
};

const FallbackScreen: Component = () => {
  return (
    <div class="flex h-screen w-full items-center justify-center">
      <div class="text-[--color-ink-muted] animate-pulse">Loading...</div>
    </div>
  );
};

export default App;
