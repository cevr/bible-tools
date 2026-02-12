import { Outlet } from 'react-router';
import { DbProvider } from './providers/db-provider';
import { BibleProvider } from './providers/bible-provider';
import { KeyboardProvider } from './providers/keyboard-provider';
import { OverlayProvider } from './providers/overlay-provider';
import { AppShell } from './components/layout/app-shell';
import { CommandPalette } from './components/shared/command-palette';
import { GotoDialog } from './components/shared/goto-dialog';
import { SearchOverlay } from './components/shared/search-overlay';
import { BookmarksPanel } from './components/shared/bookmarks-panel';
import { HistoryPanel } from './components/shared/history-panel';

export default function App() {
  return (
    <DbProvider>
      <BibleProvider>
        <KeyboardProvider>
          <OverlayProvider>
            <AppShell>
              <Outlet />
              <CommandPalette />
              <GotoDialog />
              <SearchOverlay />
              <BookmarksPanel />
              <HistoryPanel />
            </AppShell>
          </OverlayProvider>
        </KeyboardProvider>
      </BibleProvider>
    </DbProvider>
  );
}
