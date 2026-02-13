import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { useKeyboardAction } from '@/providers/keyboard-provider';
import { useOverlay } from '@/providers/overlay-provider';

// ---------------------------------------------------------------------------
// Wide layout context — lets child routes widen the shell (e.g. split pane)
// ---------------------------------------------------------------------------

const WideLayoutContext = createContext<(wide: boolean) => void>(() => {});

/** Call from a route to toggle the shell to wide mode. */
export function useSetWideLayout(wide: boolean) {
  const setWide = useContext(WideLayoutContext);
  useEffect(() => {
    setWide(wide);
    return () => setWide(false);
  }, [wide, setWide]);
}

export function AppShell({ children }: { children: ReactNode }) {
  const { openOverlay, closeOverlay, overlay } = useOverlay();
  const [wide, setWide] = useState(false);

  useKeyboardAction((action) => {
    switch (action) {
      case 'openCommandPalette':
        openOverlay('command-palette');
        break;
      case 'openGotoDialog':
        openOverlay('goto-dialog');
        break;
      case 'closeOverlay':
        if (overlay !== 'none') {
          closeOverlay();
        }
        break;
    }
  });

  const { pathname } = useLocation();

  return (
    <WideLayoutContext value={setWide}>
      <div className="min-h-screen bg-background">
        <nav className="border-b border-border">
          <div
            className={`mx-auto flex items-center gap-6 px-[--spacing-gutter] py-2 transition-[max-width] duration-200 ${wide ? 'max-w-[90rem]' : 'max-w-4xl'}`}
          >
            <Link
              to="/bible"
              className={
                pathname.startsWith('/bible')
                  ? 'text-sm font-medium text-foreground'
                  : 'text-sm text-muted-foreground hover:text-foreground transition-colors'
              }
            >
              Bible
            </Link>
            <Link
              to="/egw"
              className={
                pathname.startsWith('/egw')
                  ? 'text-sm font-medium text-foreground'
                  : 'text-sm text-muted-foreground hover:text-foreground transition-colors'
              }
            >
              EGW Writings
            </Link>
          </div>
        </nav>
        <main
          className={`mx-auto px-[--spacing-gutter] py-8 transition-[max-width] duration-200 ${wide ? 'max-w-[90rem]' : 'max-w-4xl'}`}
        >
          {children}
        </main>
      </div>
    </WideLayoutContext>
  );
}
