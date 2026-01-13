/**
 * EGW Navigation Context
 *
 * Manages navigation state for the EGW Reader.
 * Similar to the Bible navigation context but adapted for EGW paragraph structure.
 */

import type { EGWReference } from '@bible/core/app';
import type {
  EGWBookInfo,
  EGWParagraph,
  EGWReaderPosition,
} from '@bible/core/egw-reader';
import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onMount,
  untrack,
  useContext,
  type ParentProps,
} from 'solid-js';

import { useBibleState } from './bible.js';
import { useEGW } from './egw.js';

/**
 * Loading state for async operations
 */
type LoadingState =
  | { _tag: 'idle' }
  | { _tag: 'loading'; message: string }
  | { _tag: 'loaded' }
  | { _tag: 'error'; error: string };

interface EGWNavigationContextValue {
  // Current state
  loadingState: () => LoadingState;
  currentBook: () => EGWBookInfo | null;
  paragraphs: () => readonly EGWParagraph[];
  selectedParagraphIndex: () => number;
  currentParagraph: () => EGWParagraph | null;

  // Navigation
  goToBook: (bookCode: string) => void;
  goToPosition: (position: EGWReaderPosition) => void;
  nextParagraph: () => void;
  prevParagraph: () => void;
  goToFirstParagraph: () => void;
  goToLastParagraph: () => void;
  goToParagraphIndex: (index: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  nextChapter: () => void;
  prevChapter: () => void;

  // Book list
  books: () => readonly EGWBookInfo[];
  loadBooks: () => void;

  // Total paragraphs
  totalParagraphs: () => number;
  currentPage: () => number | null;
}

const EGWNavigationContext = createContext<EGWNavigationContextValue>();

interface EGWNavigationProviderProps {
  initialRef?: EGWReference;
}

export function EGWNavigationProvider(
  props: ParentProps<EGWNavigationProviderProps>,
) {
  const egw = useEGW();
  const bibleState = useBibleState();

  // State
  const [loadingState, setLoadingState] = createSignal<LoadingState>({
    _tag: 'idle',
  });
  const [books, setBooks] = createSignal<readonly EGWBookInfo[]>([]);
  const [currentBook, setCurrentBook] = createSignal<EGWBookInfo | null>(null);
  const [paragraphs, setParagraphs] = createSignal<readonly EGWParagraph[]>([]);
  const [selectedParagraphIndex, setSelectedParagraphIndex] = createSignal(0);

  // Derived state
  const currentParagraph = createMemo(() => {
    const paras = paragraphs();
    const index = selectedParagraphIndex();
    return paras[index] ?? null;
  });

  const totalParagraphs = createMemo(() => paragraphs().length);

  // Extract page number from refcode (e.g., "PP 351.1" -> 351)
  const getPageFromParagraph = (para: EGWParagraph | null): number | null => {
    if (!para) return null;
    const refcode = para.refcodeShort ?? para.refcodeLong ?? '';
    const match = refcode.match(/\s(\d+)\.\d+$/);
    return match ? parseInt(match[1]!, 10) : null;
  };

  const currentPage = createMemo(() =>
    getPageFromParagraph(currentParagraph()),
  );

  // Load book list
  const loadBooks = () => {
    setLoadingState({ _tag: 'loading', message: 'Loading book list...' });
    egw
      .getBooks()
      .then((bookList) => {
        setBooks(bookList);
        setLoadingState({ _tag: 'loaded' });
      })
      .catch((error) => {
        setLoadingState({ _tag: 'error', error: String(error) });
      });
  };

  // Navigate to a specific book
  const goToBook = (bookCode: string) => {
    setLoadingState({ _tag: 'loading', message: `Loading ${bookCode}...` });

    Promise.all([
      egw.getBookByCode(bookCode),
      egw.getParagraphsByBookCode(bookCode),
    ])
      .then(([book, paras]) => {
        if (book) {
          setCurrentBook(book);
          setParagraphs(paras);
          setSelectedParagraphIndex(0);
          setLoadingState({ _tag: 'loaded' });
        } else {
          setLoadingState({
            _tag: 'error',
            error: `Book not found: ${bookCode}`,
          });
        }
      })
      .catch((error) => {
        setLoadingState({ _tag: 'error', error: String(error) });
      });
  };

  // Navigate to a specific position (page/paragraph)
  const goToPosition = (position: EGWReaderPosition) => {
    const bookCode = position.bookCode;
    const book = currentBook();

    // If different book, load it first
    if (!book || book.bookCode.toUpperCase() !== bookCode.toUpperCase()) {
      setLoadingState({ _tag: 'loading', message: `Loading ${bookCode}...` });

      Promise.all([
        egw.getBookByCode(bookCode),
        egw.getParagraphsByBookCode(bookCode),
      ])
        .then(([loadedBook, paras]) => {
          if (loadedBook) {
            setCurrentBook(loadedBook);
            setParagraphs(paras);
            navigateToPosition(paras, position);
            setLoadingState({ _tag: 'loaded' });
          } else {
            setLoadingState({
              _tag: 'error',
              error: `Book not found: ${bookCode}`,
            });
          }
        })
        .catch((error) => {
          setLoadingState({ _tag: 'error', error: String(error) });
        });
    } else {
      // Same book, just navigate
      navigateToPosition(paragraphs(), position);
    }
  };

  // Find paragraph index from position
  const navigateToPosition = (
    paras: readonly EGWParagraph[],
    position: EGWReaderPosition,
  ) => {
    // If we have page and paragraph, build refcode
    if (position.page != null) {
      const refcodePrefix =
        position.paragraph != null
          ? `${position.bookCode} ${position.page}.${position.paragraph}`
          : `${position.bookCode} ${position.page}.`;

      const index = paras.findIndex((p) => {
        const ref = p.refcodeShort ?? p.refcodeLong ?? '';
        return position.paragraph != null
          ? ref.toUpperCase() === refcodePrefix.toUpperCase()
          : ref.toUpperCase().startsWith(refcodePrefix.toUpperCase());
      });

      if (index >= 0) {
        setSelectedParagraphIndex(index);
        return;
      }
    }

    // If we have puborder
    if (position.puborder != null) {
      const index = paras.findIndex((p) => p.puborder === position.puborder);
      if (index >= 0) {
        setSelectedParagraphIndex(index);
        return;
      }
    }

    // Default to first
    setSelectedParagraphIndex(0);
  };

  // Navigation methods
  const nextParagraph = () => {
    const total = totalParagraphs();
    setSelectedParagraphIndex((i) => (i < total - 1 ? i + 1 : 0));
  };

  const prevParagraph = () => {
    const total = totalParagraphs();
    setSelectedParagraphIndex((i) => (i > 0 ? i - 1 : total - 1));
  };

  const goToFirstParagraph = () => {
    setSelectedParagraphIndex(0);
  };

  const goToLastParagraph = () => {
    setSelectedParagraphIndex(Math.max(0, totalParagraphs() - 1));
  };

  const goToParagraphIndex = (index: number) => {
    const total = totalParagraphs();
    setSelectedParagraphIndex(Math.max(0, Math.min(index, total - 1)));
  };

  // Navigate to next page (find first paragraph on next page)
  const nextPage = () => {
    const paras = paragraphs();
    const current = currentPage();
    if (current === null) return;

    const currentIndex = selectedParagraphIndex();
    // Find first paragraph on a different (higher) page
    for (let i = currentIndex + 1; i < paras.length; i++) {
      const page = getPageFromParagraph(paras[i]!);
      if (page !== null && page > current) {
        setSelectedParagraphIndex(i);
        return;
      }
    }
    // If no next page found, go to last paragraph
    setSelectedParagraphIndex(paras.length - 1);
  };

  // Navigate to previous page (find first paragraph on previous page)
  const prevPage = () => {
    const paras = paragraphs();
    const current = currentPage();
    if (current === null) return;

    const currentIndex = selectedParagraphIndex();
    // Find the page before current
    let targetPage: number | null = null;
    for (let i = currentIndex - 1; i >= 0; i--) {
      const page = getPageFromParagraph(paras[i]!);
      if (page !== null && page < current) {
        targetPage = page;
        break;
      }
    }

    if (targetPage === null) {
      // No previous page, go to first
      setSelectedParagraphIndex(0);
      return;
    }

    // Find first paragraph on that page
    for (let i = 0; i < paras.length; i++) {
      const page = getPageFromParagraph(paras[i]!);
      if (page === targetPage) {
        setSelectedParagraphIndex(i);
        return;
      }
    }
  };

  // Check if paragraph is a chapter/section heading
  const isChapterHeading = (para: EGWParagraph): boolean => {
    const type = para.elementType;
    return type === 'chapter' || type === 'heading' || type === 'title';
  };

  // Navigate to next chapter (find next chapter heading)
  const nextChapter = () => {
    const paras = paragraphs();
    const currentIndex = selectedParagraphIndex();

    // Find next chapter heading after current position
    for (let i = currentIndex + 1; i < paras.length; i++) {
      if (isChapterHeading(paras[i]!)) {
        setSelectedParagraphIndex(i);
        return;
      }
    }
    // If no next chapter, go to last paragraph
    setSelectedParagraphIndex(paras.length - 1);
  };

  // Navigate to previous chapter (find previous chapter heading)
  const prevChapter = () => {
    const paras = paragraphs();
    const currentIndex = selectedParagraphIndex();

    // If we're on a chapter heading, go to the one before it
    // Otherwise, go to the chapter heading of the current section
    let foundCurrentChapter = false;

    for (let i = currentIndex - 1; i >= 0; i--) {
      if (isChapterHeading(paras[i]!)) {
        if (
          foundCurrentChapter ||
          (currentIndex === selectedParagraphIndex() &&
            !isChapterHeading(paras[currentIndex]!))
        ) {
          // We found the previous chapter
          setSelectedParagraphIndex(i);
          return;
        }
        // This is the current chapter's heading, keep looking for previous
        foundCurrentChapter = true;
      }
    }
    // If no previous chapter, go to first paragraph
    setSelectedParagraphIndex(0);
  };

  // Save position when it changes (untrack the save call to avoid loops)
  createEffect(() => {
    const book = currentBook();
    const para = currentParagraph();
    if (book && para) {
      const page = currentPage();
      // Untrack the save operation to prevent reactive loops
      untrack(() => {
        bibleState.setLastEGWPosition({
          bookCode: book.bookCode,
          page: page ?? undefined,
          puborder: para.puborder,
        });
      });
    }
  });

  // Initialize from initial ref or saved state - only runs once on mount
  onMount(() => {
    const ref = props.initialRef;
    if (ref?.bookCode) {
      goToPosition({
        bookCode: ref.bookCode,
        page: ref.page,
        paragraph: ref.paragraph,
      });
    } else {
      // Try to load last position from state
      const lastPos = bibleState.getLastEGWPosition();
      if (lastPos) {
        goToPosition({
          bookCode: lastPos.bookCode,
          page: lastPos.page,
          puborder: lastPos.puborder,
        });
      } else {
        // Load book list if no saved position
        loadBooks();
      }
    }
  });

  const value: EGWNavigationContextValue = {
    loadingState,
    currentBook,
    paragraphs,
    selectedParagraphIndex,
    currentParagraph,
    goToBook,
    goToPosition,
    nextParagraph,
    prevParagraph,
    goToFirstParagraph,
    goToLastParagraph,
    goToParagraphIndex,
    nextPage,
    prevPage,
    nextChapter,
    prevChapter,
    books,
    loadBooks,
    totalParagraphs,
    currentPage,
  };

  return (
    <EGWNavigationContext.Provider value={value}>
      {props.children}
    </EGWNavigationContext.Provider>
  );
}

export function useEGWNavigation(): EGWNavigationContextValue {
  const ctx = useContext(EGWNavigationContext);
  if (!ctx) {
    throw new Error(
      'useEGWNavigation must be used within an EGWNavigationProvider',
    );
  }
  return ctx;
}
