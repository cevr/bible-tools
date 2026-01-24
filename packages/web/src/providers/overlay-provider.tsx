import {
  createContext,
  useContext,
  createSignal,
  type ParentComponent,
  type Accessor,
} from 'solid-js';

/**
 * Types of overlays that can be shown.
 */
export type OverlayType =
  | 'none'
  | 'command-palette'
  | 'goto-dialog'
  | 'search'
  | 'cross-refs'
  | 'concordance';

interface OverlayContextValue {
  /**
   * Currently active overlay.
   */
  overlay: Accessor<OverlayType>;

  /**
   * Additional data for the overlay (e.g., verse reference for cross-refs).
   */
  overlayData: Accessor<unknown>;

  /**
   * Open an overlay.
   */
  openOverlay: (type: OverlayType, data?: unknown) => void;

  /**
   * Close the current overlay.
   */
  closeOverlay: () => void;

  /**
   * Element to return focus to when overlay closes.
   */
  returnFocusRef: Accessor<HTMLElement | null>;

  /**
   * Set the return focus element.
   */
  setReturnFocusRef: (el: HTMLElement | null) => void;
}

const OverlayContext = createContext<OverlayContextValue>();

export const OverlayProvider: ParentComponent = (props) => {
  const [overlay, setOverlay] = createSignal<OverlayType>('none');
  const [overlayData, setOverlayData] = createSignal<unknown>(null);
  const [returnFocusRef, setReturnFocusRef] = createSignal<HTMLElement | null>(null);

  const openOverlay = (type: OverlayType, data?: unknown) => {
    // Save current focus for restoration
    const currentFocus = document.activeElement as HTMLElement | null;
    if (currentFocus) {
      setReturnFocusRef(currentFocus);
    }

    setOverlayData(data);
    setOverlay(type);
  };

  const closeOverlay = () => {
    const ref = returnFocusRef();

    setOverlay('none');
    setOverlayData(null);

    // Restore focus
    if (ref && typeof ref.focus === 'function') {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        ref.focus();
      });
    }

    setReturnFocusRef(null);
  };

  const value: OverlayContextValue = {
    overlay,
    overlayData,
    openOverlay,
    closeOverlay,
    returnFocusRef,
    setReturnFocusRef,
  };

  return <OverlayContext.Provider value={value}>{props.children}</OverlayContext.Provider>;
};

/**
 * Access overlay state and controls.
 */
export function useOverlay(): OverlayContextValue {
  const ctx = useContext(OverlayContext);
  if (!ctx) {
    throw new Error('useOverlay must be used within an OverlayProvider');
  }
  return ctx;
}

/**
 * Check if a specific overlay is open.
 */
export function useIsOverlayOpen(type: OverlayType): Accessor<boolean> {
  const { overlay } = useOverlay();
  return () => overlay() === type;
}
