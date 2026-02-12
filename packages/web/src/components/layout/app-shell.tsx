import type { ReactNode } from 'react';
import { useKeyboardAction } from '@/providers/keyboard-provider';
import { useOverlay } from '@/providers/overlay-provider';

export function AppShell({ children }: { children: ReactNode }) {
  const { openOverlay, closeOverlay, overlay } = useOverlay();

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

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-[--spacing-gutter] py-8">{children}</main>
    </div>
  );
}
