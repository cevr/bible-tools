import {
  createContext,
  useContext,
  createSignal,
  onMount,
  onCleanup,
  type ParentComponent,
  type Accessor,
} from 'solid-js';

/**
 * Keyboard shortcut actions available in the app.
 */
export type KeyboardAction =
  | 'nextVerse'
  | 'prevVerse'
  | 'nextChapter'
  | 'prevChapter'
  | 'openCommandPalette'
  | 'openSearch'
  | 'openGotoDialog'
  | 'openCrossRefs'
  | 'openConcordance'
  | 'toggleDisplayMode'
  | 'closeOverlay';

type KeyboardHandler = (action: KeyboardAction, event: KeyboardEvent) => void;

interface KeyboardContextValue {
  /**
   * Register a handler for keyboard actions.
   * Returns a cleanup function to unregister.
   */
  registerHandler: (handler: KeyboardHandler) => () => void;

  /**
   * Whether keyboard shortcuts are currently enabled.
   * Disabled when focused on input elements.
   */
  enabled: Accessor<boolean>;

  /**
   * Temporarily disable keyboard shortcuts (e.g., when overlay is open).
   */
  setEnabled: (enabled: boolean) => void;
}

const KeyboardContext = createContext<KeyboardContextValue>();

/**
 * Parses keyboard events into actions based on web-native shortcuts.
 */
function parseKeyboardEvent(event: KeyboardEvent): KeyboardAction | null {
  const { key, metaKey, ctrlKey, shiftKey } = event;
  const mod = metaKey || ctrlKey;

  // Check if we're in an input element
  const target = event.target as HTMLElement;
  if (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  ) {
    // Only allow Escape in inputs
    if (key === 'Escape') return 'closeOverlay';
    return null;
  }

  // Command palette: Cmd+K / Ctrl+K
  if (mod && key === 'k') return 'openCommandPalette';

  // Search: Cmd+F / Ctrl+F or /
  if (mod && key === 'f') return 'openSearch';
  if (key === '/' && !mod && !shiftKey) return 'openSearch';

  // Go to: Cmd+G / Ctrl+G
  if (mod && key === 'g' && !shiftKey) return 'openGotoDialog';

  // Cross-references: Cmd+I / Ctrl+I
  if (mod && key === 'i') return 'openCrossRefs';

  // Concordance: Cmd+Shift+S / Ctrl+Shift+S
  if (mod && shiftKey && key === 's') return 'openConcordance';

  // Display mode: Cmd+D / Ctrl+D
  if (mod && key === 'd') return 'toggleDisplayMode';

  // Navigation (no modifiers)
  if (!mod && !shiftKey) {
    switch (key) {
      case 'ArrowDown':
        return 'nextVerse';
      case 'ArrowUp':
        return 'prevVerse';
      case 'ArrowRight':
        return 'nextChapter';
      case 'ArrowLeft':
        return 'prevChapter';
      case 'Enter':
        return 'openCrossRefs';
      case 'Escape':
        return 'closeOverlay';
    }
  }

  return null;
}

export const KeyboardProvider: ParentComponent = (props) => {
  const [enabled, setEnabled] = createSignal(true);
  const handlers = new Set<KeyboardHandler>();

  const registerHandler = (handler: KeyboardHandler) => {
    handlers.add(handler);
    return () => handlers.delete(handler);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!enabled()) return;

    const action = parseKeyboardEvent(event);
    if (!action) return;

    // Prevent default for our shortcuts
    event.preventDefault();

    // Notify all handlers
    handlers.forEach((handler) => handler(action, event));
  };

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  const value: KeyboardContextValue = {
    registerHandler,
    enabled,
    setEnabled,
  };

  return (
    <KeyboardContext.Provider value={value}>
      {props.children}
    </KeyboardContext.Provider>
  );
};

/**
 * Access keyboard context for registering handlers.
 */
export function useKeyboard(): KeyboardContextValue {
  const ctx = useContext(KeyboardContext);
  if (!ctx) {
    throw new Error('useKeyboard must be used within a KeyboardProvider');
  }
  return ctx;
}

/**
 * Hook to subscribe to keyboard actions.
 * Automatically cleans up on component unmount.
 */
export function useKeyboardAction(
  handler: (action: KeyboardAction, event: KeyboardEvent) => void
): void {
  const { registerHandler } = useKeyboard();

  onMount(() => {
    const cleanup = registerHandler(handler);
    onCleanup(cleanup);
  });
}
