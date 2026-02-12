import type { ParentComponent } from 'solid-js';
import { useKeyboardAction } from '@/providers/keyboard-provider';
import { useOverlay } from '@/providers/overlay-provider';

/**
 * Main application shell.
 * Handles global keyboard shortcuts and layout.
 */
export const AppShell: ParentComponent = (props) => {
  const { openOverlay, closeOverlay, overlay } = useOverlay();

  // Handle global keyboard actions (except navigation and cross-refs)
  // Note: openCrossRefs is handled by bible route which passes verse context
  useKeyboardAction((action) => {
    switch (action) {
      case 'openCommandPalette':
        openOverlay('command-palette');
        break;
      // openSearch handled by bible route (passes query context)
      case 'openGotoDialog':
        openOverlay('goto-dialog');
        break;
      case 'openConcordance':
        openOverlay('concordance');
        break;
      // openBookmarks handled by bible route (passes verse context)
      case 'closeOverlay':
        if (overlay() !== 'none') {
          closeOverlay();
        }
        break;
    }
  });

  return (
    <div class="min-h-screen bg-[--color-paper] dark:bg-[--color-paper-dark]">
      <main class="mx-auto max-w-4xl px-[--spacing-gutter] py-8">{props.children}</main>
    </div>
  );
};
