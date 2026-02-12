/**
 * Concordance search overlay.
 *
 * Search by Strong's number (H157, G26) or English word.
 * Results show verse references with the matched word text.
 */
import { type Component, createSignal, createResource, For, Show } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { useNavigate } from '@solidjs/router';
import { useBible } from '@/providers/bible-provider';
import { useOverlay } from '@/providers/overlay-provider';
import { useStudyData } from '@/providers/study-hooks';

export const ConcordanceSearch: Component = () => {
  const { overlay, closeOverlay } = useOverlay();
  const navigate = useNavigate();
  const bible = useBible();
  const study = useStudyData();

  const isOpen = () => overlay() === 'concordance';
  const [query, setQuery] = createSignal('');

  // Parse Strong's number from query (H157, G26, etc.)
  const strongsNumber = () => {
    const q = query().trim().toUpperCase();
    if (/^[HG]\d+$/.test(q)) return q;
    return null;
  };

  // Search by Strong's number
  const [results] = createResource(
    () => (isOpen() ? strongsNumber() : null),
    async (num) => {
      if (!num) return [];
      return study.searchByStrongs(num);
    },
  );

  // Also load the Strong's entry for display
  const [strongsEntry] = createResource(
    () => (isOpen() ? strongsNumber() : null),
    async (num) => {
      if (!num) return null;
      return study.getStrongsEntry(num);
    },
  );

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeOverlay();
      setQuery('');
    }
  };

  const navigateToVerse = (book: number, chapter: number, verse: number) => {
    const b = bible.getBook(book);
    if (b) {
      const slug = b.name.toLowerCase().replace(/\s+/g, '-');
      navigate(`/bible/${slug}/${chapter}/${verse}`);
      closeOverlay();
    }
  };

  const formatRef = (book: number, chapter: number, verse: number) => {
    const b = bible.getBook(book);
    return b ? `${b.name} ${chapter}:${verse}` : `${book}:${chapter}:${verse}`;
  };

  const languageColor = () => {
    const e = strongsEntry();
    if (!e) return '';
    return e.language === 'hebrew'
      ? 'text-[--color-strongs-hebrew] dark:text-[--color-strongs-hebrew-dark]'
      : 'text-[--color-strongs-greek] dark:text-[--color-strongs-greek-dark]';
  };

  return (
    <Dialog open={isOpen()} onOpenChange={handleOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in" />
        <Dialog.Content
          class="fixed left-1/2 top-1/4 z-50 w-full max-w-xl -translate-x-1/2 rounded-xl bg-[--color-paper] dark:bg-[--color-paper-dark] shadow-2xl border border-[--color-border] dark:border-[--color-border-dark] overflow-hidden animate-in fade-in slide-in-from-top-4 max-h-[70vh] flex flex-col"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            document.getElementById('concordance-input')?.focus();
          }}
        >
          {/* Header */}
          <div class="px-4 pt-4 pb-2">
            <Dialog.Title class="text-sm font-medium text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
              Strong's Concordance
            </Dialog.Title>
            <Dialog.Description class="sr-only">
              Search by Strong's number (e.g. H157, G26)
            </Dialog.Description>
          </div>

          {/* Search input */}
          <div class="px-4 pb-2">
            <input
              id="concordance-input"
              type="text"
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              placeholder="Strong's number (e.g. H157, G26)"
              class="w-full bg-transparent text-lg text-[--color-ink] dark:text-[--color-ink-dark] placeholder:text-[--color-ink-muted] dark:placeholder:text-[--color-ink-muted-dark] outline-none font-mono"
            />
          </div>

          {/* Strong's entry preview */}
          <Show when={strongsEntry()}>
            {(e) => (
              <div class="px-4 py-2 bg-[--color-highlight]/50 dark:bg-[--color-highlight-dark]/50 shrink-0">
                <span class={`font-mono font-bold ${languageColor()}`}>{e().number}</span>
                <span class="ml-2 font-serif text-[--color-ink] dark:text-[--color-ink-dark]">
                  {e().lemma}
                </span>
                <Show when={e().transliteration}>
                  <span class="ml-2 text-sm italic text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                    {e().transliteration}
                  </span>
                </Show>
                <p class="mt-1 text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] line-clamp-2">
                  {e().definition}
                </p>
              </div>
            )}
          </Show>

          <div class="border-t border-[--color-border] dark:border-[--color-border-dark]" />

          {/* Results */}
          <div class="overflow-y-auto min-h-0 flex-1">
            <Show
              when={strongsNumber()}
              fallback={
                <p class="px-4 py-6 text-center text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                  Enter a Strong's number (H for Hebrew, G for Greek)
                </p>
              }
            >
              <Show when={results.loading}>
                <p class="px-4 py-6 text-center text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                  Searching...
                </p>
              </Show>
              <Show when={!results.loading}>
                <Show
                  when={(results() ?? []).length > 0}
                  fallback={
                    <p class="px-4 py-6 text-center text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                      No verses found
                    </p>
                  }
                >
                  <div class="p-2 space-y-0.5">
                    <For each={results()}>
                      {(result) => (
                        <button
                          class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] transition-colors flex items-baseline gap-3"
                          onClick={() => navigateToVerse(result.book, result.chapter, result.verse)}
                        >
                          <span class="text-xs font-medium text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] w-36 shrink-0">
                            {formatRef(result.book, result.chapter, result.verse)}
                          </span>
                          <Show when={result.wordText}>
                            <span class="text-sm text-[--color-ink] dark:text-[--color-ink-dark]">
                              {result.wordText}
                            </span>
                          </Show>
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </Show>
            </Show>
          </div>

          {/* Footer */}
          <div class="border-t border-[--color-border] dark:border-[--color-border-dark] px-4 py-2 flex items-center justify-between text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] shrink-0">
            <Show when={(results() ?? []).length > 0}>
              <span>{(results() ?? []).length} verses</span>
            </Show>
            <span>
              <kbd class="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1">esc</kbd>{' '}
              close
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};
