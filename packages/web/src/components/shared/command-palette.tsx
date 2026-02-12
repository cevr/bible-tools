import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useBible } from '@/providers/bible-provider';
import { useOverlay } from '@/providers/overlay-provider';
import { useApp } from '@/providers/db-provider';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { Book } from '@/data/bible';

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
  const app = useApp();

  const isOpen = overlay === 'command-palette';

  const [query, setQuery] = useState('');
  const [state, setState] = useState<CommandState>({ mode: 'book' });
  const [verseNumbers, setVerseNumbers] = useState<number[]>([]);
  const [loadingVerses, setLoadingVerses] = useState(false);

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
        openOverlay('concordance');
      },
    },
  ];

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setState({ mode: 'book' });
      setVerseNumbers([]);
    }
  }, [isOpen]);

  // Fetch verses when in verse mode
  useEffect(() => {
    if (state.mode !== 'verse' || !state.selectedBook || !state.selectedChapter) {
      setVerseNumbers([]);
      return;
    }
    setLoadingVerses(true);
    app.fetchVerses(state.selectedBook.number, state.selectedChapter).then((verses) => {
      setVerseNumbers(verses.map((v) => v.verse));
      setLoadingVerses(false);
    });
  }, [state.mode, state.selectedBook, state.selectedChapter, app]);

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

  const filteredVerses = q
    ? verseNumbers.filter((v) => v.toString().startsWith(q.trim()))
    : verseNumbers;

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
      const bookSlug = state.selectedBook.name.toLowerCase().replace(/\s+/g, '-');
      navigate(`/bible/${bookSlug}/${state.selectedChapter}/${verse}`);
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
        const bookSlug = book.name.toLowerCase().replace(/\s+/g, '-');
        const path = ref.verse
          ? `/bible/${bookSlug}/${ref.chapter}/${ref.verse}`
          : `/bible/${bookSlug}/${ref.chapter}`;
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
        className="top-1/4 translate-y-0 p-0 gap-0 w-full max-w-lg rounded-xl bg-[--color-paper] dark:bg-[--color-paper-dark] border border-[--color-border] dark:border-[--color-border-dark] overflow-hidden"
        showCloseButton={false}
        initialFocus={false}
      >
        {/* Header with breadcrumb */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-2 text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
          <span>Go to</span>
          {state.selectedBook && (
            <>
              <span>→</span>
              <button
                className="hover:text-[--color-ink] dark:hover:text-[--color-ink-dark]"
                onClick={goBack}
              >
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
            className="w-full bg-transparent text-lg text-[--color-ink] dark:text-[--color-ink-dark] placeholder:text-[--color-ink-muted] dark:placeholder:text-[--color-ink-muted-dark] outline-none"
          />
        </div>

        <div className="border-t border-[--color-border] dark:border-[--color-border-dark]" />

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2">
          {state.mode === 'book' && (
            <div className="space-y-1">
              {filteredActions.length > 0 && (
                <>
                  {filteredActions.map((action) => (
                    <button
                      key={action.label}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] text-[--color-ink] dark:text-[--color-ink-dark] transition-colors"
                      onClick={action.action}
                    >
                      <span>{action.label}</span>
                      <span className="text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                        {action.hint}
                      </span>
                    </button>
                  ))}
                  <div className="border-t border-[--color-border] dark:border-[--color-border-dark] my-1" />
                </>
              )}
              {filteredBooks.length > 0 ? (
                (filteredBooks as Book[]).map((book) => (
                  <button
                    key={book.number}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] text-[--color-ink] dark:text-[--color-ink-dark] transition-colors"
                    onClick={() => selectBook(book)}
                  >
                    <span>{book.name}</span>
                    <span className="text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                      {book.chapters} chapters
                    </span>
                  </button>
                ))
              ) : filteredActions.length === 0 ? (
                <p className="px-3 py-2 text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                  No results found
                </p>
              ) : null}
            </div>
          )}

          {state.mode === 'chapter' && (
            <div className="grid grid-cols-6 gap-2">
              {filteredChapters.map((chapter) => (
                <button
                  key={chapter}
                  className="px-3 py-2 rounded-lg text-center hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] text-[--color-ink] dark:text-[--color-ink-dark] transition-colors"
                  onClick={() => selectChapter(chapter)}
                >
                  {chapter}
                </button>
              ))}
            </div>
          )}

          {state.mode === 'verse' && (
            <>
              {loadingVerses ? (
                <p className="px-3 py-2 text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                  Loading verses...
                </p>
              ) : (
                <div className="grid grid-cols-8 gap-2">
                  {filteredVerses.map((verse) => (
                    <button
                      key={verse}
                      className="px-3 py-2 rounded-lg text-center hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] text-[--color-ink] dark:text-[--color-ink-dark] transition-colors"
                      onClick={() => selectVerse(verse)}
                    >
                      {verse}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer hints */}
        <div className="border-t border-[--color-border] dark:border-[--color-border-dark] px-4 py-2 text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] flex items-center gap-4">
          <span>
            <kbd className="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1">↵</kbd>{' '}
            select
          </span>
          <span>
            <kbd className="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1">
              esc
            </kbd>{' '}
            close
          </span>
          {state.mode !== 'book' && (
            <span>
              <kbd className="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1">
                ⌫
              </kbd>{' '}
              back
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
