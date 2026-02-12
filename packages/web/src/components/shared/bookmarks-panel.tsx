/**
 * Bookmarks panel — view, add, and navigate to bookmarked verses.
 */
import { type Component, createSignal, For, Show } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { useNavigate } from '@solidjs/router';
import { useBible } from '@/providers/bible-provider';
import { useOverlay } from '@/providers/overlay-provider';
import { useBookmarks } from '@/providers/state-provider';

export const BookmarksPanel: Component = () => {
  const { overlay, overlayData, closeOverlay } = useOverlay();
  const navigate = useNavigate();
  const bible = useBible();
  const { bookmarks, add, remove } = useBookmarks();

  const isOpen = () => overlay() === 'bookmarks';

  // Data from overlay can carry current verse for quick-add
  const currentRef = () => overlayData() as { book: number; chapter: number; verse: number } | null;

  const [noteInput, setNoteInput] = createSignal('');

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeOverlay();
      setNoteInput('');
    }
  };

  const formatRef = (ref: { book: number; chapter: number; verse?: number }) => {
    const b = bible.getBook(ref.book);
    if (!b) return `${ref.book}:${ref.chapter}:${ref.verse ?? ''}`;
    return ref.verse ? `${b.name} ${ref.chapter}:${ref.verse}` : `${b.name} ${ref.chapter}`;
  };

  const navigateToBookmark = (ref: { book: number; chapter: number; verse?: number }) => {
    const b = bible.getBook(ref.book);
    if (b) {
      const slug = b.name.toLowerCase().replace(/\s+/g, '-');
      const versePart = ref.verse ? `/${ref.verse}` : '';
      navigate(`/bible/${slug}/${ref.chapter}${versePart}`);
      closeOverlay();
    }
  };

  const handleAdd = async () => {
    const ref = currentRef();
    if (!ref) return;
    await add(ref, noteInput() || undefined);
    setNoteInput('');
  };

  const formatDate = (ts: number) => {
    const date = new Date(ts);
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  return (
    <Dialog open={isOpen()} onOpenChange={handleOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in" />
        <Dialog.Content class="fixed left-1/2 top-1/4 z-50 w-full max-w-lg -translate-x-1/2 rounded-xl bg-[--color-paper] dark:bg-[--color-paper-dark] shadow-2xl border border-[--color-border] dark:border-[--color-border-dark] overflow-hidden animate-in fade-in slide-in-from-top-4 max-h-[70vh] flex flex-col">
          <div class="px-4 pt-4 pb-2 border-b border-[--color-border] dark:border-[--color-border-dark] shrink-0">
            <Dialog.Title class="font-sans text-lg font-semibold text-[--color-ink] dark:text-[--color-ink-dark]">
              Bookmarks
            </Dialog.Title>
            <Dialog.Description class="sr-only">Your saved bookmarks</Dialog.Description>
          </div>

          {/* Quick-add form when opened from a verse */}
          <Show when={currentRef()}>
            {(ref) => (
              <div class="px-4 py-3 bg-[--color-highlight]/50 dark:bg-[--color-highlight-dark]/50 shrink-0">
                <form
                  class="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleAdd();
                  }}
                >
                  <span class="text-sm text-[--color-ink] dark:text-[--color-ink-dark] shrink-0 py-1.5">
                    {formatRef(ref())}
                  </span>
                  <input
                    type="text"
                    placeholder="Note (optional)"
                    class="flex-1 px-2 py-1.5 text-sm rounded-lg border border-[--color-border] dark:border-[--color-border-dark] bg-transparent text-[--color-ink] dark:text-[--color-ink-dark] placeholder:text-[--color-ink-muted] dark:placeholder:text-[--color-ink-muted-dark] focus:outline-none focus:ring-1 focus:ring-[--color-accent] dark:focus:ring-[--color-accent-dark]"
                    value={noteInput()}
                    onInput={(e) => setNoteInput(e.currentTarget.value)}
                  />
                  <button
                    type="submit"
                    class="px-3 py-1.5 text-sm font-medium rounded-lg bg-[--color-accent] dark:bg-[--color-accent-dark] text-white hover:opacity-90 transition-opacity"
                  >
                    Add
                  </button>
                </form>
              </div>
            )}
          </Show>

          {/* Bookmark list */}
          <div class="overflow-y-auto min-h-0 flex-1 p-2">
            <Show when={bookmarks.loading}>
              <p class="px-4 py-6 text-center text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                Loading...
              </p>
            </Show>
            <Show when={!bookmarks.loading}>
              <Show
                when={(bookmarks() ?? []).length > 0}
                fallback={
                  <p class="px-4 py-6 text-center text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                    No bookmarks yet.
                  </p>
                }
              >
                <div class="space-y-1">
                  <For each={bookmarks()}>
                    {(bm) => (
                      <div class="flex items-center gap-2 p-2 rounded-lg hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] transition-colors group">
                        <button
                          class="flex-1 text-left min-w-0"
                          onClick={() => navigateToBookmark(bm.reference)}
                        >
                          <span class="text-sm font-medium text-[--color-ink] dark:text-[--color-ink-dark]">
                            {formatRef(bm.reference)}
                          </span>
                          <Show when={bm.note}>
                            <p class="text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] mt-0.5">
                              {bm.note}
                            </p>
                          </Show>
                          <time
                            class="text-[10px] text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]"
                            dateTime={new Date(bm.createdAt).toISOString()}
                          >
                            {formatDate(bm.createdAt)}
                          </time>
                        </button>
                        <button
                          class="shrink-0 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 dark:hover:text-red-300 transition-opacity text-xs px-1"
                          onClick={() => void remove(bm.id)}
                          title="Remove"
                        >
                          x
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </Show>
          </div>

          {/* Footer */}
          <div class="border-t border-[--color-border] dark:border-[--color-border-dark] px-4 py-3 flex justify-end shrink-0">
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
