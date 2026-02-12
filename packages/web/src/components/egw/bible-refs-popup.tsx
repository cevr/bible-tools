/**
 * Bible references popup for EGW paragraphs.
 *
 * Extracts Bible references from paragraph text using @bible/core's parser,
 * then displays them as clickable links that navigate to the Bible reader.
 */
import { type Component, For, Show, createMemo } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Dialog } from '@kobalte/core/dialog';
import {
  extractBibleReferences,
  getBibleBook,
  formatBibleReference,
} from '@bible/core/bible-reader';

export interface BibleRefsPopupProps {
  /** Raw HTML/text content of the selected paragraph */
  content: string | null;
  /** Refcode label shown in the popup header (e.g. "PP 351.1") */
  refcode: string | null;
  open: boolean;
  onClose: () => void;
}

export const BibleRefsPopup: Component<BibleRefsPopupProps> = (props) => {
  const navigate = useNavigate();

  const refs = createMemo(() => {
    if (!props.content) return [];
    // Strip HTML tags before parsing — extractBibleReferences works on plain text
    const plain = props.content.replace(/<[^>]*>/g, '');
    return extractBibleReferences(plain);
  });

  const handleRefClick = (ref: { book: number; chapter: number; verse?: number }) => {
    const book = getBibleBook(ref.book);
    if (!book) return;
    const slug = book.name.toLowerCase().replace(/\s+/g, '-');
    const path = ref.verse
      ? `/bible/${slug}/${ref.chapter}/${ref.verse}`
      : `/bible/${slug}/${ref.chapter}`;
    props.onClose();
    navigate(path);
  };

  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onClose()} modal>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in" />
        <Dialog.Content class="fixed left-1/2 top-1/4 z-50 w-full max-w-[420px] -translate-x-1/2 rounded-xl bg-[--color-paper] dark:bg-[--color-paper-dark] shadow-2xl border border-[--color-border] dark:border-[--color-border-dark] overflow-hidden animate-in fade-in slide-in-from-top-4">
          <div class="p-5 space-y-3">
            <Dialog.Title class="font-sans text-lg font-semibold text-[--color-ink] dark:text-[--color-ink-dark]">
              Bible References
            </Dialog.Title>

            <Show when={props.refcode}>
              <Dialog.Description class="text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                Found in {props.refcode}
              </Dialog.Description>
            </Show>

            <Show
              when={refs().length > 0}
              fallback={
                <p class="text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] italic">
                  No Bible references found in this paragraph.
                </p>
              }
            >
              <div class="border-t border-[--color-border] dark:border-[--color-border-dark] pt-3 space-y-1">
                <For each={refs()}>
                  {(extracted) => (
                    <button
                      class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] text-[--color-accent] dark:text-[--color-accent-dark] font-medium"
                      onClick={() => handleRefClick(extracted.ref)}
                    >
                      {formatBibleReference(extracted.ref)}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>

          <div class="border-t border-[--color-border] dark:border-[--color-border-dark] px-5 py-3 flex justify-end">
            <button
              class="px-3 py-1.5 text-sm font-medium text-[--color-accent] dark:text-[--color-accent-dark] hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] rounded transition-colors"
              onClick={() => props.onClose()}
            >
              Close
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};
