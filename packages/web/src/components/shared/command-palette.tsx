import {
  type Component,
  createSignal,
  createMemo,
  For,
  Show,
} from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { useNavigate } from '@solidjs/router';
import { useBible } from '@/providers/bible-provider';
import { useOverlay } from '@/providers/overlay-provider';
import type { Book } from '@/data/bible';

type CommandMode = 'book' | 'chapter' | 'verse';

interface CommandState {
  mode: CommandMode;
  selectedBook?: Book;
  selectedChapter?: number;
}

/**
 * Command palette for Bible navigation.
 * Opens with ⌘K and allows quick navigation to any verse.
 */
export const CommandPalette: Component = () => {
  const { overlay, closeOverlay } = useOverlay();
  const navigate = useNavigate();
  const bible = useBible();

  const isOpen = () => overlay() === 'command-palette';

  const [query, setQuery] = createSignal('');
  const [state, setState] = createSignal<CommandState>({ mode: 'book' });

  // Filter books based on query
  const filteredBooks = createMemo(() => {
    const q = query().toLowerCase().trim();
    if (!q) return bible.books;
    return bible.books.filter(
      (book) =>
        book.name.toLowerCase().includes(q) ||
        book.name.toLowerCase().startsWith(q)
    );
  });

  // Get chapters for selected book
  const chapters = createMemo(() => {
    const book = state().selectedBook;
    if (!book) return [];
    return Array.from({ length: book.chapters }, (_, i) => i + 1);
  });

  // Filter chapters based on query
  const filteredChapters = createMemo(() => {
    const q = query().trim();
    if (!q) return chapters();
    const num = parseInt(q, 10);
    if (isNaN(num)) return chapters();
    return chapters().filter((ch) => ch.toString().startsWith(q));
  });

  // Get verses for selected chapter
  const verses = createMemo(() => {
    const s = state();
    if (!s.selectedBook || !s.selectedChapter) return [];
    const chapter = bible.getChapter(s.selectedBook.number, s.selectedChapter);
    return chapter.map((v) => v.verse);
  });

  // Filter verses based on query
  const filteredVerses = createMemo(() => {
    const q = query().trim();
    if (!q) return verses();
    const num = parseInt(q, 10);
    if (isNaN(num)) return verses();
    return verses().filter((v) => v.toString().startsWith(q));
  });

  // Reset state when dialog opens/closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeOverlay();
    }
    if (open) {
      setQuery('');
      setState({ mode: 'book' });
    }
  };

  // Select a book
  const selectBook = (book: Book) => {
    setState({ mode: 'chapter', selectedBook: book });
    setQuery('');
  };

  // Select a chapter
  const selectChapter = (chapter: number) => {
    setState((s) => ({
      ...s,
      mode: 'verse',
      selectedChapter: chapter,
    }));
    setQuery('');
  };

  // Navigate to verse
  const selectVerse = (verse: number) => {
    const s = state();
    if (s.selectedBook && s.selectedChapter) {
      const bookSlug = s.selectedBook.name.toLowerCase().replace(/\s+/g, '-');
      navigate(`/bible/${bookSlug}/${s.selectedChapter}/${verse}`);
      closeOverlay();
    }
  };

  // Go back to previous mode
  const goBack = () => {
    setState((s) => {
      if (s.mode === 'verse') {
        return { ...s, mode: 'chapter', selectedChapter: undefined };
      }
      if (s.mode === 'chapter') {
        return { mode: 'book', selectedBook: undefined };
      }
      return s;
    });
    setQuery('');
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Backspace' && query() === '') {
      e.preventDefault();
      goBack();
    }
  };

  // Quick navigate: if query matches a reference, go directly
  const tryQuickNavigate = () => {
    const ref = bible.parseReference(query());
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
    <Dialog open={isOpen()} onOpenChange={handleOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in" />
        <Dialog.Content
          class="fixed left-1/2 top-1/4 z-50 w-full max-w-lg -translate-x-1/2 rounded-xl bg-[--color-paper] dark:bg-[--color-paper-dark] shadow-2xl border border-[--color-border] dark:border-[--color-border-dark] overflow-hidden animate-in fade-in slide-in-from-top-4"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            const input = document.getElementById('command-input');
            input?.focus();
          }}
        >
          {/* Header with breadcrumb */}
          <div class="flex items-center gap-2 px-4 pt-4 pb-2 text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
            <span>Go to</span>
            <Show when={state().selectedBook}>
              <span>→</span>
              <button
                class="hover:text-[--color-ink] dark:hover:text-[--color-ink-dark]"
                onClick={goBack}
              >
                {state().selectedBook?.name}
              </button>
            </Show>
            <Show when={state().selectedChapter}>
              <span>→</span>
              <span>Chapter {state().selectedChapter}</span>
            </Show>
          </div>

          {/* Search input */}
          <div class="px-4 pb-2">
            <input
              id="command-input"
              type="text"
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  tryQuickNavigate();
                }
              }}
              placeholder={
                state().mode === 'book'
                  ? 'Search books or type reference (e.g., John 3:16)...'
                  : state().mode === 'chapter'
                    ? 'Select chapter...'
                    : 'Select verse...'
              }
              class="w-full bg-transparent text-lg text-[--color-ink] dark:text-[--color-ink-dark] placeholder:text-[--color-ink-muted] dark:placeholder:text-[--color-ink-muted-dark] outline-none"
            />
          </div>

          <div class="border-t border-[--color-border] dark:border-[--color-border-dark]" />

          {/* Results list */}
          <div class="max-h-80 overflow-y-auto p-2">
            <Show when={state().mode === 'book'}>
              <div class="space-y-1">
                <Show
                  when={filteredBooks().length > 0}
                  fallback={
                    <p class="px-3 py-2 text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                      No books found
                    </p>
                  }
                >
                  <For each={filteredBooks()}>
                    {(book) => (
                      <button
                        class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] text-[--color-ink] dark:text-[--color-ink-dark] transition-colors"
                        onClick={() => selectBook(book)}
                      >
                        <span>{book.name}</span>
                        <span class="text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                          {book.chapters} chapters
                        </span>
                      </button>
                    )}
                  </For>
                </Show>
              </div>
            </Show>

            <Show when={state().mode === 'chapter'}>
              <div class="grid grid-cols-6 gap-2">
                <For each={filteredChapters()}>
                  {(chapter) => (
                    <button
                      class="px-3 py-2 rounded-lg text-center hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] text-[--color-ink] dark:text-[--color-ink-dark] transition-colors"
                      onClick={() => selectChapter(chapter)}
                    >
                      {chapter}
                    </button>
                  )}
                </For>
              </div>
            </Show>

            <Show when={state().mode === 'verse'}>
              <div class="grid grid-cols-8 gap-2">
                <For each={filteredVerses()}>
                  {(verse) => (
                    <button
                      class="px-3 py-2 rounded-lg text-center hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] text-[--color-ink] dark:text-[--color-ink-dark] transition-colors"
                      onClick={() => selectVerse(verse)}
                    >
                      {verse}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>

          {/* Footer hints */}
          <div class="border-t border-[--color-border] dark:border-[--color-border-dark] px-4 py-2 text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] flex items-center gap-4">
            <span>
              <kbd class="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1">
                ↵
              </kbd>{' '}
              select
            </span>
            <span>
              <kbd class="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1">
                esc
              </kbd>{' '}
              close
            </span>
            <Show when={state().mode !== 'book'}>
              <span>
                <kbd class="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1">
                  ⌫
                </kbd>{' '}
                back
              </span>
            </Show>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};
