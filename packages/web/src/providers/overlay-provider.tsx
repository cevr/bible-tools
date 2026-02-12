import { createContext, useContext, useState, useRef, type ReactNode } from 'react';

export type OverlayType =
  | 'none'
  | 'command-palette'
  | 'goto-dialog'
  | 'search'
  | 'cross-refs'
  | 'concordance'
  | 'bookmarks'
  | 'history';

interface OverlayContextValue {
  overlay: OverlayType;
  overlayData: unknown;
  openOverlay: (type: OverlayType, data?: unknown) => void;
  closeOverlay: () => void;
  returnFocusRef: HTMLElement | null;
  setReturnFocusRef: (el: HTMLElement | null) => void;
}

const OverlayContext = createContext<OverlayContextValue | null>(null);

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [overlay, setOverlay] = useState<OverlayType>('none');
  const [overlayData, setOverlayData] = useState<unknown>(null);
  const [returnFocusRef, setReturnFocusRef] = useState<HTMLElement | null>(null);
  // Keep a ref copy so closeOverlay can read the latest value synchronously
  const returnFocusRefLatest = useRef<HTMLElement | null>(null);
  returnFocusRefLatest.current = returnFocusRef;

  const openOverlay = (type: OverlayType, data?: unknown) => {
    const currentFocus = document.activeElement as HTMLElement | null;
    if (currentFocus) {
      setReturnFocusRef(currentFocus);
    }
    setOverlayData(data);
    setOverlay(type);
  };

  const closeOverlay = () => {
    const ref = returnFocusRefLatest.current;
    setOverlay('none');
    setOverlayData(null);
    if (ref && typeof ref.focus === 'function') {
      requestAnimationFrame(() => ref.focus());
    }
    setReturnFocusRef(null);
  };

  return (
    <OverlayContext.Provider
      value={{ overlay, overlayData, openOverlay, closeOverlay, returnFocusRef, setReturnFocusRef }}
    >
      {children}
    </OverlayContext.Provider>
  );
}

export function useOverlay(): OverlayContextValue {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error('useOverlay must be used within an OverlayProvider');
  return ctx;
}

export function useIsOverlayOpen(type: OverlayType): boolean {
  const { overlay } = useOverlay();
  return overlay === type;
}
