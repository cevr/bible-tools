import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';

// ---------------------------------------------------------------------------
// Overlay type map — typed data per overlay
// ---------------------------------------------------------------------------

export interface SearchOverlayData {
  query?: string;
  onSearch?: (q: string) => void;
}

export interface BookmarksOverlayData {
  book: number;
  chapter: number;
  verse: number;
}

interface OverlayDataMap {
  search: SearchOverlayData;
  bookmarks: BookmarksOverlayData;
}

type OverlayWithData = keyof OverlayDataMap;
type OverlayWithoutData = 'command-palette' | 'goto-dialog' | 'history';

export type OverlayType = 'none' | OverlayWithData | OverlayWithoutData;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface OverlayContextValue {
  overlay: OverlayType;
  overlayData: unknown;
  openOverlay: {
    <T extends OverlayWithData>(type: T, data: OverlayDataMap[T]): void;
    (type: OverlayWithoutData | OverlayWithData): void;
  };
  closeOverlay: () => void;
}

const OverlayContext = createContext<OverlayContextValue | null>(null);

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [overlay, setOverlay] = useState<OverlayType>('none');
  const [overlayData, setOverlayData] = useState<unknown>(null);
  const [returnFocusRef, setReturnFocusRef] = useState<HTMLElement | null>(null);
  // Keep a ref copy so closeOverlay can read the latest value synchronously
  const returnFocusRefLatest = useRef<HTMLElement | null>(null);
  returnFocusRefLatest.current = returnFocusRef;

  const openOverlay = useCallback((type: OverlayType, data?: unknown) => {
    const currentFocus = document.activeElement as HTMLElement | null;
    if (currentFocus) {
      setReturnFocusRef(currentFocus);
    }
    setOverlayData(data ?? null);
    setOverlay(type);
  }, []);

  const closeOverlay = useCallback(() => {
    const ref = returnFocusRefLatest.current;
    setOverlay('none');
    setOverlayData(null);
    if (ref && typeof ref.focus === 'function') {
      requestAnimationFrame(() => ref.focus());
    }
    setReturnFocusRef(null);
  }, []);

  const value = useMemo(
    () => ({ overlay, overlayData, openOverlay, closeOverlay }),
    [overlay, overlayData, openOverlay, closeOverlay],
  );

  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>;
}

export function useOverlay() {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error('useOverlay must be used within an OverlayProvider');
  return ctx;
}

export function useOverlayData<T extends OverlayWithData>(type: T): OverlayDataMap[T] | null {
  const { overlay, overlayData } = useOverlay();
  if (overlay !== type) return null;
  return overlayData as OverlayDataMap[T];
}
