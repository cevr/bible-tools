/**
 * EGW reader route.
 *
 * Three states based on URL params:
 * 1. No bookCode -> Book list (fetched from API)
 * 2. bookCode, no page -> Redirect to page 1
 * 3. bookCode + page -> Page reader view
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useKeyboardAction } from '@/providers/keyboard-provider';
import { useOverlay } from '@/providers/overlay-provider';
import {
  fetchEgwBooks,
  fetchEgwPage,
  fetchEgwChapters,
  type EGWBookInfo,
  type EGWChapter,
  type EGWPageResponse,
  type EGWParagraph,
} from '@/data/egw/api';
import { isChapterHeading } from '@bible/core/egw';
import { PageView } from '@/components/egw/page-view';
import { BibleRefsPopup } from '@/components/egw/bible-refs-popup';

// ---------------------------------------------------------------------------
// Route component
// ---------------------------------------------------------------------------

function EgwRoute() {
  const params = useParams<'bookCode' | 'page'>();
  const navigate = useNavigate();

  // Redirect to page 1 when bookCode present but no page
  useEffect(() => {
    if (params.bookCode && !params.page) {
      navigate(`/egw/${params.bookCode}/1`, { replace: true });
    }
  }, [params.bookCode, params.page, navigate]);

  if (params.bookCode && params.page) {
    return <PageReaderView />;
  }

  if (!params.bookCode) {
    return <BookListView />;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Book list view
// ---------------------------------------------------------------------------

function BookListView() {
  const [books, setBooks] = useState<readonly EGWBookInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEgwBooks()
      .then((b) => {
        setBooks(b);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-6">
      <header className="border-b border-[--color-border] dark:border-[--color-border-dark] pb-4">
        <h1 className="font-sans text-2xl font-semibold text-[--color-ink] dark:text-[--color-ink-dark]">
          Ellen G. White Writings
        </h1>
        <p className="mt-1 text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
          Select a book to begin reading
        </p>
      </header>

      {loading && (
        <p className="text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] italic">
          Loading books...
        </p>
      )}

      {error && (
        <div className="rounded-lg border border-[--color-border] dark:border-[--color-border-dark] bg-[--color-highlight]/30 dark:bg-[--color-highlight-dark]/30 p-4">
          <p className="text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
            No books available. Run{' '}
            <code className="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1 text-xs">
              bible egw sync
            </code>{' '}
            on the server to download books.
          </p>
        </div>
      )}

      {!loading && !error && books.length === 0 && (
        <div className="rounded-lg border border-[--color-border] dark:border-[--color-border-dark] bg-[--color-highlight]/30 dark:bg-[--color-highlight-dark]/30 p-4">
          <p className="text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
            No books synced. Run{' '}
            <code className="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1 text-xs">
              bible egw sync
            </code>{' '}
            on the server.
          </p>
        </div>
      )}

      {!loading && !error && books.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <a
              key={book.bookCode}
              href={`/egw/${book.bookCode}`}
              className="group rounded-lg border border-[--color-border] dark:border-[--color-border-dark] p-4 transition-colors hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark]"
            >
              <div className="font-sans font-semibold text-[--color-ink] dark:text-[--color-ink-dark] group-hover:text-[--color-accent] dark:group-hover:text-[--color-accent-dark]">
                {book.bookCode}
              </div>
              <div className="mt-1 text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                {book.title}
              </div>
              <div className="mt-1 text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] opacity-60">
                {book.author}
                {book.paragraphCount && <> &middot; {book.paragraphCount} paragraphs</>}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page reader view
// ---------------------------------------------------------------------------

function PageReaderView() {
  const params = useParams<'bookCode' | 'page'>();
  const navigate = useNavigate();
  const { overlay } = useOverlay();

  const bookCode = params.bookCode ?? '';
  const pageNum = parseInt(params.page ?? '1', 10) || 1;

  // State
  const [pageData, setPageData] = useState<EGWPageResponse | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [chapters, setChapters] = useState<readonly EGWChapter[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);
  const [refsPopupOpen, setRefsPopupOpen] = useState(false);

  // Refs for event handlers
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;
  const refsPopupOpenRef = useRef(refsPopupOpen);
  refsPopupOpenRef.current = refsPopupOpen;

  // Fetch page data
  useEffect(() => {
    let cancelled = false;
    setPageLoading(true);
    setPageError(null);
    fetchEgwPage(bookCode, pageNum)
      .then((data) => {
        if (!cancelled) {
          setPageData(data);
          setPageLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPageError(String(err));
          setPageLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [bookCode, pageNum]);

  // Fetch chapters
  useEffect(() => {
    fetchEgwChapters(bookCode)
      .then(setChapters)
      .catch(() => {});
  }, [bookCode]);

  // Reset selection on page change
  useEffect(() => {
    setSelectedIndex(0);
  }, [pageNum]);

  // Body paragraphs (excluding headings)
  const bodyParagraphs: readonly EGWParagraph[] = pageData
    ? pageData.paragraphs.filter((p) => !isChapterHeading(p.elementType))
    : [];

  // Selected paragraph data
  const selectedParagraph = bodyParagraphs[selectedIndex] ?? null;

  // Scroll selected paragraph into view
  useEffect(() => {
    if (!bodyParagraphs.length) return;
    const para = bodyParagraphs[selectedIndex];
    if (!para) return;
    const el = document.querySelector(`[data-para="${para.puborder}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedIndex, bodyParagraphs]);

  const goToPage = (page: number | null) => {
    if (page == null) return;
    navigate(`/egw/${bookCode}/${page}`);
  };

  // Space/Enter opens Bible refs popup
  useEffect(() => {
    const handleRawKeyDown = (event: KeyboardEvent) => {
      if (overlayRef.current !== 'none') return;
      if (refsPopupOpenRef.current) return;
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (event.key === ' ' || (event.key === 'Enter' && !event.metaKey && !event.ctrlKey)) {
        event.preventDefault();
        event.stopPropagation();
        if (selectedParagraph) {
          setRefsPopupOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleRawKeyDown, true);
    return () => window.removeEventListener('keydown', handleRawKeyDown, true);
  }, [selectedParagraph]);

  // Keyboard navigation
  useKeyboardAction((action) => {
    if (refsPopupOpen) return;

    switch (action) {
      case 'nextVerse': {
        const max = bodyParagraphs.length - 1;
        setSelectedIndex((i) => Math.min(i + 1, max));
        break;
      }
      case 'prevVerse':
        setSelectedIndex((i) => Math.max(0, i - 1));
        break;
      case 'nextChapter':
        if (pageData) goToPage(pageData.nextPage);
        break;
      case 'prevChapter':
        if (pageData) goToPage(pageData.prevPage);
        break;
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[--color-paper] dark:bg-[--color-paper-dark] border-b border-[--color-border] dark:border-[--color-border-dark] pb-4 pt-2">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-3">
            <a
              href="/egw"
              className="text-sm text-[--color-accent] dark:text-[--color-accent-dark] hover:underline"
            >
              Books
            </a>
            <h1 className="font-sans text-2xl font-semibold text-[--color-ink] dark:text-[--color-ink-dark]">
              {pageData ? pageData.book.title : bookCode}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Chapter TOC dropdown */}
            {chapters.length > 0 && (
              <div className="relative">
                <button
                  className="text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] hover:text-[--color-accent] dark:hover:text-[--color-accent-dark] transition-colors"
                  onClick={() => setTocOpen((o) => !o)}
                >
                  Chapters ▾
                </button>
                {tocOpen && (
                  <ChapterDropdown
                    chapters={chapters}
                    currentPage={pageNum}
                    onSelect={(page) => {
                      setTocOpen(false);
                      goToPage(page);
                    }}
                    onClose={() => setTocOpen(false)}
                  />
                )}
              </div>
            )}
            <span className="text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
              {pageData && (
                <>
                  Page {pageData.page} of {pageData.totalPages}
                </>
              )}
            </span>
          </div>
        </div>
        {pageData?.chapterHeading && (
          <div className="mt-2 text-lg font-medium text-[--color-accent] dark:text-[--color-accent-dark]">
            {pageData.chapterHeading}
          </div>
        )}
      </header>

      {/* Content */}
      {pageLoading && (
        <p className="text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] italic">
          Loading...
        </p>
      )}

      {pageError && (
        <p className="text-red-600 dark:text-red-400">Failed to load page: {pageError}</p>
      )}

      {!pageLoading && !pageError && pageData && (
        <PageView
          paragraphs={pageData.paragraphs}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
        />
      )}

      {/* Bible refs popup */}
      <BibleRefsPopup
        content={selectedParagraph?.content ?? null}
        refcode={selectedParagraph?.refcodeShort ?? null}
        open={refsPopupOpen}
        onClose={() => setRefsPopupOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-[--color-border] dark:border-[--color-border-dark] pt-4 text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span>{selectedParagraph?.refcodeShort}</span>
          <div className="flex gap-4 flex-wrap">
            <span>
              <kbd className="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1 text-xs">
                ↑↓
              </kbd>{' '}
              paragraph
            </span>
            <span>
              <kbd className="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1 text-xs">
                ←→
              </kbd>{' '}
              page
            </span>
            <span>
              <kbd className="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1 text-xs">
                ␣
              </kbd>{' '}
              refs
            </span>
            <span>
              <kbd className="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1 text-xs">
                ⌘K
              </kbd>{' '}
              palette
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chapter dropdown
// ---------------------------------------------------------------------------

function ChapterDropdown({
  chapters,
  currentPage,
  onSelect,
  onClose,
}: {
  chapters: readonly EGWChapter[];
  currentPage: number;
  onSelect: (page: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 z-20 max-h-80 w-64 overflow-y-auto rounded-lg border border-[--color-border] dark:border-[--color-border-dark] bg-[--color-paper] dark:bg-[--color-paper-dark] shadow-xl"
    >
      {chapters.map((ch, i) => {
        if (!ch.page) return null;
        const page = ch.page;
        return (
          <button
            key={i}
            className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] ${
              page === currentPage
                ? 'text-[--color-accent] dark:text-[--color-accent-dark] font-medium'
                : 'text-[--color-ink] dark:text-[--color-ink-dark]'
            }`}
            onClick={() => onSelect(page)}
          >
            {ch.title || ch.refcodeShort || `Page ${page}`}
            <span className="ml-2 text-xs opacity-50">p.{page}</span>
          </button>
        );
      })}
    </div>
  );
}

export default EgwRoute;
