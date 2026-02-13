import { useState, useEffect, Suspense } from 'react';
import { useNavigate } from 'react-router';
import { useBible } from '@/providers/bible-provider';
import { useOverlay } from '@/providers/overlay-provider';
import { useApp } from '@/providers/db-provider';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toBookSlug, type Book } from '@/data/bible';

interface QuickAction {
  label: string;
  hint: string;
  action: () => void;
}

type CommandMode = 'book' | 'chapter' | 'verse';

interface CommandState {
  mode: CommandMode;
  selectedBook?: Book;
  selectedChapter?: number;
}

export function CommandPalette() {
  const { overlay, closeOverlay, openOverlay } = useOverlay();
  const navigate = useNavigate();
  const bible = useBible();

  const isOpen = overlay === 'command-palette';

  const [query, setQuery] = useState('');
  const [state, setState] = useState<CommandState>({ mode: 'book' });

  const quickActions: QuickAction[] = [
    {
      label: 'Bookmarks',
      hint: '⌘B',
      action: () => {
        closeOverlay();
        openOverlay('bookmarks');
      },
    },
    {
      label: 'History',
      hint: 'recent',
      action: () => {
        closeOverlay();
        openOverlay('history');
      },
    },
    {
      label: 'Search',
      hint: '/',
      action: () => {
        closeOverlay();
        openOverlay('search');
      },
    },
    {
      label: 'Concordance',
      hint: '⌘⇧S',
      action: () => {
        closeOverlay();
        // Trigger via keyboard provider — bible route handles openConcordance
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: 's', metaKey: true, shiftKey: true, bubbles: true }),
        );
      },
    },
  ];

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setState({ mode: 'book' });
    }
  }, [isOpen]);

  const q = query.toLowerCase().trim();

  const filteredActions = q
    ? quickActions.filter((a) => a.label.toLowerCase().includes(q))
    : quickActions;

  const filteredBooks = q
    ? bible.books.filter((b) => b.name.toLowerCase().includes(q))
    : bible.books;

  const chapters = state.selectedBook
    ? Array.from({ length: state.selectedBook.chapters }, (_, i) => i + 1)
    : [];
  const filteredChapters = q
    ? chapters.filter((ch) => ch.toString().startsWith(q.trim()))
    : chapters;

  const selectBook = (book: Book) => {
    setState({ mode: 'chapter', selectedBook: book });
    setQuery('');
  };

  const selectChapter = (chapter: number) => {
    setState((s) => ({ ...s, mode: 'verse', selectedChapter: chapter }));
    setQuery('');
  };

  const selectVerse = (verse: number) => {
    if (state.selectedBook && state.selectedChapter) {
      navigate(`/bible/${toBookSlug(state.selectedBook.name)}/${state.selectedChapter}/${verse}`);
      closeOverlay();
    }
  };

  const goBack = () => {
    setState((s) => {
      if (s.mode === 'verse') return { ...s, mode: 'chapter', selectedChapter: undefined };
      if (s.mode === 'chapter') return { mode: 'book', selectedBook: undefined };
      return s;
    });
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      tryQuickNavigate();
    } else if (e.key === 'Backspace' && query === '') {
      e.preventDefault();
      goBack();
    }
  };

  const tryQuickNavigate = () => {
    const ref = bible.parseReference(query);
    if (ref) {
      const book = bible.getBook(ref.book);
      if (book) {
        const path = ref.verse
          ? `/bible/${toBookSlug(book.name)}/${ref.chapter}/${ref.verse}`
          : `/bible/${toBookSlug(book.name)}/${ref.chapter}`;
        navigate(path);
        closeOverlay();
        return true;
      }
    }
    return false;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeOverlay()}>
      <DialogContent
        className="top-1/4 translate-y-0 p-0 gap-0 w-full max-w-lg rounded-xl bg-background border border-border overflow-hidden"
        showCloseButton={false}
        initialFocus={false}
      >
        {/* Header with breadcrumb */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-2 text-sm text-muted-foreground">
          <span>Go to</span>
          {state.selectedBook && (
            <>
              <span>→</span>
              <button className="hover:text-foreground" onClick={goBack}>
                {state.selectedBook.name}
              </button>
            </>
          )}
          {state.selectedChapter != null && (
            <>
              <span>→</span>
              <span>Chapter {state.selectedChapter}</span>
            </>
          )}
        </div>

        {/* Search input */}
        <div className="px-4 pb-2">
          <input
            id="command-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            placeholder={
              state.mode === 'book'
                ? 'Search books or type reference (e.g., John 3:16)...'
                : state.mode === 'chapter'
                  ? 'Select chapter...'
                  : 'Select verse...'
            }
            className="w-full bg-transparent text-lg text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>

        <div className="border-t border-border" />

        {/* Results */}
        <ScrollArea className="max-h-80 p-2">
          {state.mode === 'book' && (
            <div className="space-y-1">
              {filteredActions.length > 0 && (
                <>
                  {filteredActions.map((action) => (
                    <button
                      key={action.label}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left hover:bg-accent text-foreground transition-colors"
                      onClick={action.action}
                    >
                      <span>{action.label}</span>
                      <span className="text-xs text-muted-foreground">{action.hint}</span>
                    </button>
                  ))}
                  <div className="border-t border-border my-1" />
                </>
              )}
              {filteredBooks.length > 0 ? (
                filteredBooks.map((book) => (
                  <button
                    key={book.number}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left hover:bg-accent text-foreground transition-colors"
                    onClick={() => selectBook(book)}
                  >
                    <span>{book.name}</span>
                    <span className="text-xs text-muted-foreground">{book.chapters} chapters</span>
                  </button>
                ))
              ) : filteredActions.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">No results found</p>
              ) : null}
            </div>
          )}

          {state.mode === 'chapter' && (
            <div className="grid grid-cols-6 gap-2">
              {filteredChapters.map((chapter) => (
                <button
                  key={chapter}
                  className="px-3 py-2 rounded-lg text-center hover:bg-accent text-foreground transition-colors"
                  onClick={() => selectChapter(chapter)}
                >
                  {chapter}
                </button>
              ))}
            </div>
          )}

          {state.mode === 'verse' && state.selectedBook && state.selectedChapter && (
            <Suspense
              fallback={
                <p className="px-3 py-2 text-sm text-muted-foreground">Loading verses...</p>
              }
            >
              <VerseGrid
                bookNumber={state.selectedBook.number}
                chapter={state.selectedChapter}
                query={q}
                onSelect={selectVerse}
              />
            </Suspense>
          )}
        </ScrollArea>

        {/* Footer hints */}
        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground flex items-center gap-4">
          <span>
            <kbd className="rounded bg-border px-1">↵</kbd> select
          </span>
          <span>
            <kbd className="rounded bg-border px-1">esc</kbd> close
          </span>
          {state.mode !== 'book' && (
            <span>
              <kbd className="rounded bg-border px-1">⌫</kbd> back
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Suspending child that reads verses from cache and renders the grid. */
function VerseGrid({
  bookNumber,
  chapter,
  query,
  onSelect,
}: {
  bookNumber: number;
  chapter: number;
  query: string;
  onSelect: (verse: number) => void;
}) {
  const app = useApp();
  const verses = app.verses(bookNumber, chapter);
  const nums = verses.map((v) => v.verse);
  const filtered = query ? nums.filter((v) => v.toString().startsWith(query)) : nums;

  return (
    <div className="grid grid-cols-8 gap-2">
      {filtered.map((verse) => (
        <button
          key={verse}
          className="px-3 py-2 rounded-lg text-center hover:bg-accent text-foreground transition-colors"
          onClick={() => onSelect(verse)}
        >
          {verse}
        </button>
      ))}
    </div>
  );
}
