/**
 * Bible reader route.
 * Displays chapter content with verse navigation.
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useKeyboardAction } from '@/providers/keyboard-provider';
import { useOverlay } from '@/providers/overlay-provider';
import { useBible } from '@/providers/bible-provider';
import { useApp } from '@/providers/db-provider';
import { BOOK_ALIASES, type Verse } from '@/data/bible';
import type { MarginNote } from '@/data/study/service';
import type { Preferences } from '@/data/state/effect-service';
import { VerseRenderer } from '@/components/bible/verse-renderer';
import { ParagraphView } from '@/components/bible/paragraph-view';
import { VerseStudyPanel, type StudyTab } from '@/components/bible/verse-study-sheet';
import { GotoModeState, gotoModeTransition, keyToGotoEvent } from '@/lib/goto-mode';

function BibleRoute() {
  const params = useParams<'book' | 'chapter' | 'verse'>();
  const navigate = useNavigate();
  const bible = useBible();
  const { overlay, openOverlay } = useOverlay();
  const app = useApp();

  // Derived route params
  const bookParam = params.book?.toLowerCase();
  const bookNumber = (() => {
    if (!bookParam) return 1;
    const num = parseInt(bookParam, 10);
    if (!isNaN(num) && num >= 1 && num <= 66) return num;
    const aliasNum = BOOK_ALIASES[bookParam];
    if (aliasNum) return aliasNum;
    const book = bible.books.find((b) => b.name.toLowerCase() === bookParam);
    return book?.number ?? 1;
  })();
  const chapterNumber = parseInt(params.chapter ?? '1', 10) || 1;
  const book = bible.getBook(bookNumber);

  // Verses
  const [verses, setVerses] = useState<readonly Verse[]>([]);
  const [versesLoading, setVersesLoading] = useState(false);
  const [versesError, setVersesError] = useState<string | null>(null);

  // Margin notes
  const [marginNotesByVerse, setMarginNotesByVerse] = useState<Map<number, MarginNote[]>>(
    new Map(),
  );

  // Display mode
  const [displayMode, setDisplayMode] = useState<Preferences['displayMode']>('verse');

  // Selected verse
  const [selectedVerse, setSelectedVerse] = useState(params.verse ? parseInt(params.verse, 10) : 1);

  // Search query — persists after overlay closes
  const [searchQuery, setSearchQuery] = useState('');

  // Goto mode state machine
  const [gotoState, setGotoState] = useState(GotoModeState.normal());
  const gotoTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Study sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTab, setSheetTab] = useState<StudyTab>('verse');

  // Refs for latest state in event handlers
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;
  const displayModeRef = useRef(displayMode);
  displayModeRef.current = displayMode;
  const gotoStateRef = useRef(gotoState);
  gotoStateRef.current = gotoState;
  const versesRef = useRef(verses);
  versesRef.current = verses;
  const selectedVerseRef = useRef(selectedVerse);
  selectedVerseRef.current = selectedVerse;
  const sheetOpenRef = useRef(sheetOpen);
  sheetOpenRef.current = sheetOpen;

  // Load display mode preference on mount
  useEffect(() => {
    app.getPreferences().then((prefs) => setDisplayMode(prefs.displayMode));
  }, [app]);

  // Redirect to saved position if no book param
  useEffect(() => {
    if (!params.book) {
      app.getPosition().then((savedPos) => {
        const savedBook = bible.getBook(savedPos.book);
        if (savedBook) {
          const bookSlug = savedBook.name.toLowerCase().replace(/\s+/g, '-');
          navigate(`/bible/${bookSlug}/${savedPos.chapter}/${savedPos.verse}`, { replace: true });
        } else {
          navigate('/bible/genesis/1', { replace: true });
        }
      });
    } else if (!params.chapter) {
      const bookName = book?.name.toLowerCase().replace(/\s+/g, '-') ?? 'genesis';
      navigate(`/bible/${bookName}/1`, { replace: true });
    }
  }, [params.book, params.chapter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch verses when book/chapter changes
  useEffect(() => {
    let cancelled = false;
    setVersesLoading(true);
    setVersesError(null);
    app
      .fetchVerses(bookNumber, chapterNumber)
      .then((v) => {
        if (!cancelled) {
          setVerses(v);
          setVersesLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setVersesError(String(err));
          setVersesLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [bookNumber, chapterNumber, app]);

  // Fetch margin notes
  useEffect(() => {
    let cancelled = false;
    app.getChapterMarginNotes(bookNumber, chapterNumber).then((notes) => {
      if (!cancelled) setMarginNotesByVerse(notes);
    });
    return () => {
      cancelled = true;
    };
  }, [bookNumber, chapterNumber, app]);

  // Update selected verse when URL changes
  useEffect(() => {
    if (params.verse) {
      setSelectedVerse(parseInt(params.verse, 10));
    } else {
      setSelectedVerse(1);
    }
  }, [params.verse]);

  // Save position
  useEffect(() => {
    if (bookNumber && chapterNumber && selectedVerse) {
      void app.setPosition({ book: bookNumber, chapter: chapterNumber, verse: selectedVerse });
      void app.addToHistory({ book: bookNumber, chapter: chapterNumber, verse: selectedVerse });
    }
  }, [bookNumber, chapterNumber, selectedVerse, app]);

  // Scroll selected verse into view (also after verses finish loading)
  useEffect(() => {
    const el = document.querySelector(`[data-verse="${selectedVerse}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedVerse, versesLoading, sheetOpen]);

  const toggleDisplayMode = () => {
    const next = displayMode === 'verse' ? 'paragraph' : 'verse';
    setDisplayMode(next);
    void app.setPreferences({ displayMode: next });
  };

  const openSheet = (tab: StudyTab = 'verse') => {
    setSheetTab(tab);
    setSheetOpen(true);
  };

  // Search match verse numbers for n/N navigation
  const searchMatchVerses = (() => {
    const q = searchQuery.toLowerCase();
    if (q.length < 2) return [];
    return verses.filter((v) => v.text.toLowerCase().includes(q)).map((v) => v.verse);
  })();

  // n/N search navigation
  const goToNextMatch = (forward: boolean) => {
    const matches = searchMatchVerses;
    if (matches.length === 0) return;
    const current = selectedVerseRef.current;
    if (forward) {
      const next = matches.find((v) => v > current) ?? matches[0];
      if (next != null) setSelectedVerse(next);
    } else {
      const prev = [...matches].reverse().find((v) => v < current) ?? matches[matches.length - 1];
      if (prev != null) setSelectedVerse(prev);
    }
  };

  // Raw keydown handler for goto mode and search nav
  useEffect(() => {
    const handleRawKeyDown = (event: KeyboardEvent) => {
      if (overlayRef.current !== 'none') return;
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Escape clears active search
      if (event.key === 'Escape' && searchQueryRef.current.length >= 2) {
        event.preventDefault();
        event.stopPropagation();
        setSearchQuery('');
        return;
      }

      // n/N for search navigation
      if (searchQueryRef.current.length >= 2 && !event.metaKey && !event.ctrlKey) {
        if (event.key === 'n' && !event.shiftKey) {
          event.preventDefault();
          goToNextMatch(true);
          return;
        }
        if (event.key === 'N' && event.shiftKey) {
          event.preventDefault();
          goToNextMatch(false);
          return;
        }
      }

      // Goto mode
      const gotoEvent = keyToGotoEvent(event);
      const current = gotoStateRef.current;

      if (
        current._tag === 'normal' &&
        gotoEvent._tag !== 'pressG' &&
        gotoEvent._tag !== 'pressShiftG'
      ) {
        return;
      }

      if (
        current._tag === 'awaiting' ||
        gotoEvent._tag === 'pressG' ||
        gotoEvent._tag === 'pressShiftG'
      ) {
        event.preventDefault();
        event.stopPropagation();

        const { state: nextState, action } = gotoModeTransition(current, gotoEvent);
        setGotoState(nextState);

        if (gotoTimeoutRef.current !== undefined) clearTimeout(gotoTimeoutRef.current);
        if (nextState._tag === 'awaiting') {
          gotoTimeoutRef.current = setTimeout(() => setGotoState(GotoModeState.normal()), 2000);
        }

        if (action) {
          const max = versesRef.current.length;
          switch (action._tag) {
            case 'goToFirst':
              setSelectedVerse(1);
              break;
            case 'goToLast':
              setSelectedVerse(max);
              break;
            case 'goToVerse':
              setSelectedVerse(Math.max(1, Math.min(action.verse, max)));
              break;
          }
        }
      }
    };

    window.addEventListener('keydown', handleRawKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleRawKeyDown, true);
      if (gotoTimeoutRef.current !== undefined) clearTimeout(gotoTimeoutRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle keyboard navigation (parsed actions from keyboard provider)
  useKeyboardAction((action) => {
    switch (action) {
      case 'nextVerse': {
        const max = verses.length;
        setSelectedVerse((v) => Math.min(v + 1, max));
        break;
      }
      case 'prevVerse':
        setSelectedVerse((v) => Math.max(1, v - 1));
        break;
      case 'nextChapter': {
        const next = bible.getNextChapter(bookNumber, chapterNumber);
        if (next) {
          const nextBook = bible.getBook(next.book);
          if (nextBook) {
            const bookSlug = nextBook.name.toLowerCase().replace(/\s+/g, '-');
            navigate(`/bible/${bookSlug}/${next.chapter}`);
          }
        }
        break;
      }
      case 'prevChapter': {
        const prev = bible.getPrevChapter(bookNumber, chapterNumber);
        if (prev) {
          const prevBook = bible.getBook(prev.book);
          if (prevBook) {
            const bookSlug = prevBook.name.toLowerCase().replace(/\s+/g, '-');
            navigate(`/bible/${bookSlug}/${prev.chapter}`);
          }
        }
        break;
      }
      case 'openCrossRefs':
        openSheet('cross-refs');
        break;
      case 'openConcordance':
        openSheet('concordance');
        break;
      case 'openSearch':
        openOverlay('search', {
          query: searchQuery,
          onSearch: (q: string) => setSearchQuery(q),
        });
        break;
      case 'openBookmarks':
        openOverlay('bookmarks', {
          book: bookNumber,
          chapter: chapterNumber,
          verse: selectedVerse,
        });
        break;
      case 'toggleDisplayMode':
        toggleDisplayMode();
        break;
    }
  });

  const handleVerseClick = (verseNum: number) => {
    setSelectedVerse(verseNum);
    openSheet('verse');
  };

  if (!params.book || !params.chapter) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="border-b border-border pb-4">
        <h1 className="font-sans text-2xl font-semibold text-foreground">
          {book?.name} {chapterNumber}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Press <kbd className="rounded bg-border px-1.5 py-0.5 text-xs">⌘K</kbd> for command
          palette
        </p>
      </header>

      {/* Chapter content */}
      <div className={displayMode === 'verse' ? 'reading-text space-y-3' : ''}>
        {versesLoading && <p className="text-muted-foreground italic">Loading verses...</p>}
        {versesError && <p className="text-destructive">Failed to load verses: {versesError}</p>}
        {!versesLoading && !versesError && verses.length === 0 && (
          <p className="text-muted-foreground italic">No verses found for this chapter.</p>
        )}
        {!versesLoading && !versesError && verses.length > 0 && (
          <>
            {displayMode === 'paragraph' ? (
              <ParagraphView
                verses={verses}
                selectedVerse={selectedVerse}
                marginNotesByVerse={marginNotesByVerse}
                searchQuery={searchQuery}
                onVerseClick={handleVerseClick}
              />
            ) : (
              verses.map((verse) => (
                <VerseDisplay
                  key={verse.verse}
                  verse={verse}
                  isSelected={selectedVerse === verse.verse}
                  marginNotes={marginNotesByVerse.get(verse.verse)}
                  searchQuery={searchQuery}
                  onClick={() => handleVerseClick(verse.verse)}
                />
              ))
            )}
          </>
        )}
      </div>

      {/* Verse study panel */}
      <VerseStudyPanel
        book={bookNumber}
        chapter={chapterNumber}
        verse={selectedVerse}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        activeTab={sheetTab}
        onTabChange={setSheetTab}
      />

      {/* Footer */}
      <footer className="border-t border-border pt-4 text-sm text-muted-foreground">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="flex items-center gap-2">
            <button
              className="text-xs px-1.5 py-0.5 rounded bg-border hover:bg-primary/20 transition-colors"
              onClick={toggleDisplayMode}
              title={`Switch to ${displayMode === 'verse' ? 'paragraph' : 'verse'} mode (⌘D)`}
              aria-live="polite"
            >
              {displayMode === 'verse' ? '☰' : '¶'}
            </button>
            {book?.name} {chapterNumber}:{selectedVerse}
            {/* Goto mode indicator */}
            {gotoState._tag === 'awaiting' && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary font-mono">
                g{(gotoState as { digits: string }).digits}…
              </span>
            )}
            {/* Search query indicator */}
            {searchQuery.length >= 2 && (
              <button
                className="text-xs px-1.5 py-0.5 rounded bg-accent text-foreground hover:opacity-70 transition-opacity"
                onClick={() => setSearchQuery('')}
                title="Clear search (click to dismiss)"
              >
                /{searchQuery}/<span className="ml-1 opacity-60">{searchMatchVerses.length}</span>
              </button>
            )}
          </span>
          <div className="flex gap-4 flex-wrap">
            <span>
              <kbd className="rounded bg-border px-1 text-xs">↑↓</kbd> verse
            </span>
            <span>
              <kbd className="rounded bg-border px-1 text-xs">←→</kbd> chapter
            </span>
            <span>
              <kbd className="rounded bg-border px-1 text-xs">⌘I</kbd> study
            </span>
            <span>
              <kbd className="rounded bg-border px-1 text-xs">⌘D</kbd> mode
            </span>
            <span>
              <kbd className="rounded bg-border px-1 text-xs">⌘G</kbd> go to
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * Individual verse display with rich text rendering.
 */
function VerseDisplay({
  verse,
  isSelected,
  marginNotes,
  searchQuery,
  onClick,
}: {
  verse: Verse;
  isSelected: boolean;
  marginNotes?: MarginNote[];
  searchQuery?: string;
  onClick: () => void;
}) {
  return (
    <p
      data-verse={verse.verse}
      className={`cursor-pointer rounded px-2 py-1 transition-colors duration-100 ${
        isSelected ? 'bg-accent' : 'hover:bg-accent/50'
      }`}
      onClick={onClick}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <span className="verse-num">{verse.verse}</span>
      <VerseRenderer text={verse.text} marginNotes={marginNotes} searchQuery={searchQuery} />
    </p>
  );
}

export default BibleRoute;
