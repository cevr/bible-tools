import {
  type Component,
  createSignal,
  createMemo,
  For,
  Show,
  type JSX,
} from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { useNavigate, useParams } from '@solidjs/router';
import { useBible } from '@/providers/bible-provider';
import { useOverlay } from '@/providers/overlay-provider';
import { BOOK_ALIASES, type Reference } from '@/data/bible';

/**
 * Search overlay for finding verses in current chapter or globally.
 * Opens with ⌘F and searches verse text.
 */
export const SearchOverlay: Component = () => {
  const { overlay, closeOverlay } = useOverlay();
  const navigate = useNavigate();
  const params = useParams<{ book?: string; chapter?: string }>();
  const bible = useBible();

  const isOpen = () => overlay() === 'search';

  const [query, setQuery] = createSignal('');
  const [searchScope, setSearchScope] = createSignal<'chapter' | 'global'>(
    'chapter'
  );

  // Get current book number from URL
  const currentBookNumber = createMemo(() => {
    const bookParam = params.book?.toLowerCase();
    if (!bookParam) return 1;

    const num = parseInt(bookParam, 10);
    if (!isNaN(num) && num >= 1 && num <= 66) return num;

    const aliasNum = BOOK_ALIASES[bookParam];
    if (aliasNum) return aliasNum;

    const book = bible.books.find(
      (b) => b.name.toLowerCase() === bookParam
    );
    return book?.number ?? 1;
  });

  const currentChapter = createMemo(() => {
    const ch = parseInt(params.chapter ?? '1', 10);
    return isNaN(ch) ? 1 : ch;
  });

  // Unified result type for both chapter and global search
  interface DisplayResult {
    reference: Reference;
    text: string;
  }

  // Search results
  const results = createMemo((): DisplayResult[] => {
    const q = query().toLowerCase().trim();
    if (q.length < 2) return [];

    if (searchScope() === 'chapter') {
      // Search current chapter only
      const verses = bible.getChapter(currentBookNumber(), currentChapter());
      return verses
        .filter((v) => v.text.toLowerCase().includes(q))
        .map((v) => ({
          reference: {
            book: currentBookNumber(),
            chapter: currentChapter(),
            verse: v.verse,
          },
          text: v.text,
        }))
        .slice(0, 20);
    } else {
      // Global search returns SearchResult[], map to DisplayResult
      return bible.searchVerses(q, 20).map((sr) => ({
        reference: sr.reference,
        text: sr.verse.text,
      }));
    }
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeOverlay();
    }
    if (open) {
      setQuery('');
    }
  };

  const navigateToResult = (result: DisplayResult) => {
    const book = bible.getBook(result.reference.book);
    if (book) {
      const bookSlug = book.name.toLowerCase().replace(/\s+/g, '-');
      navigate(
        `/bible/${bookSlug}/${result.reference.chapter}/${result.reference.verse}`
      );
      closeOverlay();
    }
  };

  // Highlight matching text
  const highlightMatch = (text: string, q: string): JSX.Element => {
    if (!q) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return <>{text}</>;

    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + q.length);
    const after = text.slice(idx + q.length);

    return (
      <>
        {before}
        <mark class="bg-[--color-highlight] dark:bg-[--color-highlight-dark] rounded px-0.5">
          {match}
        </mark>
        {after}
      </>
    );
  };

  return (
    <Dialog open={isOpen()} onOpenChange={handleOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in" />
        <Dialog.Content
          class="fixed left-1/2 top-1/4 z-50 w-full max-w-xl -translate-x-1/2 rounded-xl bg-[--color-paper] dark:bg-[--color-paper-dark] shadow-2xl border border-[--color-border] dark:border-[--color-border-dark] overflow-hidden animate-in fade-in slide-in-from-top-4"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            const input = document.getElementById('search-input');
            input?.focus();
          }}
        >
          {/* Header with scope toggle */}
          <div class="flex items-center justify-between px-4 pt-4 pb-2">
            <Dialog.Title class="text-sm font-medium text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
              Search verses
            </Dialog.Title>
            <div class="flex gap-1 text-xs">
              <button
                class="px-2 py-1 rounded transition-colors"
                classList={{
                  'bg-[--color-highlight] dark:bg-[--color-highlight-dark] text-[--color-ink] dark:text-[--color-ink-dark]':
                    searchScope() === 'chapter',
                  'text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] hover:text-[--color-ink] dark:hover:text-[--color-ink-dark]':
                    searchScope() !== 'chapter',
                }}
                onClick={() => setSearchScope('chapter')}
              >
                This chapter
              </button>
              <button
                class="px-2 py-1 rounded transition-colors"
                classList={{
                  'bg-[--color-highlight] dark:bg-[--color-highlight-dark] text-[--color-ink] dark:text-[--color-ink-dark]':
                    searchScope() === 'global',
                  'text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] hover:text-[--color-ink] dark:hover:text-[--color-ink-dark]':
                    searchScope() !== 'global',
                }}
                onClick={() => setSearchScope('global')}
              >
                All Bible
              </button>
            </div>
          </div>

          {/* Search input */}
          <div class="px-4 pb-2">
            <input
              id="search-input"
              type="text"
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              placeholder="Search for words or phrases..."
              class="w-full bg-transparent text-lg text-[--color-ink] dark:text-[--color-ink-dark] placeholder:text-[--color-ink-muted] dark:placeholder:text-[--color-ink-muted-dark] outline-none"
            />
          </div>

          <div class="border-t border-[--color-border] dark:border-[--color-border-dark]" />

          {/* Results */}
          <div class="max-h-80 overflow-y-auto">
            <Show
              when={query().length >= 2}
              fallback={
                <p class="px-4 py-6 text-center text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                  Type at least 2 characters to search
                </p>
              }
            >
              <Show
                when={results().length > 0}
                fallback={
                  <p class="px-4 py-6 text-center text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                    No results found
                  </p>
                }
              >
                <div class="p-2 space-y-1">
                  <For each={results()}>
                    {(result) => {
                      const book = bible.getBook(result.reference.book);
                      return (
                        <button
                          class="w-full text-left px-3 py-2 rounded-lg hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] transition-colors"
                          onClick={() => navigateToResult(result)}
                        >
                          <div class="text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] mb-0.5">
                            {book?.name} {result.reference.chapter}:
                            {result.reference.verse}
                          </div>
                          <div class="text-sm text-[--color-ink] dark:text-[--color-ink-dark] line-clamp-2">
                            {highlightMatch(result.text, query())}
                          </div>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </Show>
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
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};
