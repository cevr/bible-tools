import { type Component, createMemo, For, Show, createResource } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { useNavigate } from '@solidjs/router';
import { useBible } from '@/providers/bible-provider';
import { useOverlay } from '@/providers/overlay-provider';
import { fetchVerses, type Reference, type Verse } from '@/data/bible';

interface CrossRefsData {
  book: number;
  chapter: number;
  verse: number;
}

/**
 * Cross-references popup showing related verses.
 * Opens when pressing Enter on a selected verse.
 */
export const CrossRefsPopup: Component = () => {
  const { overlay, overlayData, closeOverlay } = useOverlay();
  const navigate = useNavigate();
  const bible = useBible();

  const isOpen = () => overlay() === 'cross-refs';
  const data = () => overlayData() as CrossRefsData | null;

  // Fetch chapter verses (async)
  const [chapterVerses] = createResource(
    () => {
      const d = data();
      if (!d) return null;
      return { book: d.book, chapter: d.chapter };
    },
    async (params) => {
      if (!params) return [];
      return fetchVerses(params.book, params.chapter);
    },
  );

  // Get current verse from fetched data
  const currentVerse = createMemo(() => {
    const d = data();
    const verses = chapterVerses();
    if (!d || !verses) return null;
    return verses.find((v) => v.verse === d.verse) ?? null;
  });

  const currentBook = createMemo(() => {
    const d = data();
    if (!d) return null;
    return bible.getBook(d.book);
  });

  // For now, show some contextual related verses (same chapter +/- 5 verses)
  // In a full implementation, this would use actual cross-reference data
  const relatedVerses = createMemo((): readonly Verse[] => {
    const d = data();
    const verses = chapterVerses();
    if (!d || !verses) return [];

    const currentIdx = verses.findIndex((v) => v.verse === d.verse);
    if (currentIdx === -1) return [];

    // Get surrounding verses
    const start = Math.max(0, currentIdx - 2);
    const end = Math.min(verses.length, currentIdx + 3);
    return verses.slice(start, end).filter((v) => v.verse !== d.verse);
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeOverlay();
    }
  };

  const navigateToVerse = (ref: Reference) => {
    const book = bible.getBook(ref.book);
    if (book) {
      const bookSlug = book.name.toLowerCase().replace(/\s+/g, '-');
      navigate(`/bible/${bookSlug}/${ref.chapter}/${ref.verse}`);
      closeOverlay();
    }
  };

  return (
    <Dialog open={isOpen()} onOpenChange={handleOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in" />
        <Dialog.Content class="fixed left-1/2 top-1/4 z-50 w-full max-w-lg -translate-x-1/2 rounded-xl bg-[--color-paper] dark:bg-[--color-paper-dark] shadow-2xl border border-[--color-border] dark:border-[--color-border-dark] overflow-hidden animate-in fade-in slide-in-from-top-4">
          {/* Header */}
          <div class="px-4 pt-4 pb-2 border-b border-[--color-border] dark:border-[--color-border-dark]">
            <Dialog.Title class="font-sans text-lg font-semibold text-[--color-ink] dark:text-[--color-ink-dark]">
              <Show when={currentBook()}>
                {(book) => (
                  <Show when={data()}>
                    {(d) => (
                      <>
                        {book().name} {d().chapter}:{d().verse}
                      </>
                    )}
                  </Show>
                )}
              </Show>
            </Dialog.Title>
            <Dialog.Description class="sr-only">
              Cross-references and related verses
            </Dialog.Description>
          </div>

          {/* Current verse text */}
          <Show when={chapterVerses.loading}>
            <div class="px-4 py-3 bg-[--color-highlight]/50 dark:bg-[--color-highlight-dark]/50">
              <p class="reading-text text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] italic">
                Loading...
              </p>
            </div>
          </Show>
          <Show when={!chapterVerses.loading && currentVerse()}>
            {(verse) => (
              <div class="px-4 py-3 bg-[--color-highlight]/50 dark:bg-[--color-highlight-dark]/50">
                <p class="reading-text text-[--color-ink] dark:text-[--color-ink-dark]">
                  {verse().text}
                </p>
              </div>
            )}
          </Show>

          {/* Related verses */}
          <div class="px-4 py-3">
            <h3 class="text-xs font-medium text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] uppercase tracking-wider mb-2">
              Context
            </h3>
            <Show when={chapterVerses.loading}>
              <p class="text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                Loading...
              </p>
            </Show>
            <Show when={!chapterVerses.loading}>
              <Show
                when={relatedVerses().length > 0}
                fallback={
                  <p class="text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                    No related verses found.
                  </p>
                }
              >
                <div class="space-y-2">
                  <For each={relatedVerses()}>
                    {(verse) => (
                      <button
                        class="w-full text-left p-2 rounded-lg hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] transition-colors"
                        onClick={() =>
                          navigateToVerse({
                            book: verse.book,
                            chapter: verse.chapter,
                            verse: verse.verse,
                          })
                        }
                      >
                        <span class="text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                          v{verse.verse}
                        </span>
                        <p class="text-sm text-[--color-ink] dark:text-[--color-ink-dark] line-clamp-2">
                          {verse.text}
                        </p>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </Show>
          </div>

          {/* Actions */}
          <div class="px-4 py-3 border-t border-[--color-border] dark:border-[--color-border-dark] flex items-center justify-between">
            <div class="text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
              <span>
                <kbd class="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1">
                  esc
                </kbd>{' '}
                close
              </span>
            </div>
            <button
              class="px-3 py-1.5 text-sm font-medium text-[--color-accent] dark:text-[--color-accent-dark] hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] rounded transition-colors"
              onClick={() => closeOverlay()}
            >
              Done
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};
