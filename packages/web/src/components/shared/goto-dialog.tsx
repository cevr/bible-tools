import { type Component, createSignal } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { useNavigate } from '@solidjs/router';
import { useBible } from '@/providers/bible-provider';
import { useOverlay } from '@/providers/overlay-provider';

/**
 * Goto dialog for quick reference navigation.
 * Opens with ⌘G and allows typing a reference like "John 3:16".
 */
export const GotoDialog: Component = () => {
  const { overlay, closeOverlay } = useOverlay();
  const navigate = useNavigate();
  const bible = useBible();

  const isOpen = () => overlay() === 'goto-dialog';

  const [query, setQuery] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeOverlay();
    }
    if (open) {
      setQuery('');
      setError(null);
    }
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const ref = bible.parseReference(query());

    if (!ref) {
      setError('Invalid reference. Try "John 3:16" or "Genesis 1"');
      return;
    }

    const book = bible.getBook(ref.book);
    if (!book) {
      setError('Book not found');
      return;
    }

    const bookSlug = book.name.toLowerCase().replace(/\s+/g, '-');
    const path = ref.verse
      ? `/bible/${bookSlug}/${ref.chapter}/${ref.verse}`
      : `/bible/${bookSlug}/${ref.chapter}`;

    navigate(path);
    closeOverlay();
  };

  return (
    <Dialog open={isOpen()} onOpenChange={handleOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in" />
        <Dialog.Content
          class="fixed left-1/2 top-1/4 z-50 w-full max-w-md -translate-x-1/2 rounded-xl bg-[--color-paper] dark:bg-[--color-paper-dark] shadow-2xl border border-[--color-border] dark:border-[--color-border-dark] overflow-hidden animate-in fade-in slide-in-from-top-4"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            const input = document.getElementById('goto-input');
            input?.focus();
          }}
        >
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div class="px-4 pt-4 pb-2">
              <Dialog.Title class="text-sm font-medium text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                Go to reference
              </Dialog.Title>
            </div>

            {/* Input */}
            <div class="px-4 pb-3">
              <input
                id="goto-input"
                type="text"
                value={query()}
                onInput={(e) => {
                  setQuery(e.currentTarget.value);
                  setError(null);
                }}
                placeholder="John 3:16, Genesis 1, Ps 23..."
                class="w-full bg-transparent text-xl text-[--color-ink] dark:text-[--color-ink-dark] placeholder:text-[--color-ink-muted] dark:placeholder:text-[--color-ink-muted-dark] outline-none"
              />
              {error() && (
                <p class="mt-2 text-sm text-red-600 dark:text-red-400">
                  {error()}
                </p>
              )}
            </div>

            {/* Footer */}
            <div class="border-t border-[--color-border] dark:border-[--color-border-dark] px-4 py-2 text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] flex items-center gap-4">
              <span>
                <kbd class="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1">
                  ↵
                </kbd>{' '}
                go
              </span>
              <span>
                <kbd class="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1">
                  esc
                </kbd>{' '}
                close
              </span>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};
