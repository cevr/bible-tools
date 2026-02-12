/**
 * Strong's dictionary entry popup.
 *
 * Shows lemma, transliteration, pronunciation, and definition
 * for a given Strong's number. Hebrew numbers in warm amber,
 * Greek in scholar blue.
 */
import { type Component, createResource, Show } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { useStudyData } from '@/providers/study-hooks';
import type { StrongsEntry } from '@/data/study/service';

export interface StrongsPopupProps {
  strongsNumber: string | null;
  onClose: () => void;
}

export const StrongsPopup: Component<StrongsPopupProps> = (props) => {
  const study = useStudyData();

  const [entry] = createResource(
    () => props.strongsNumber,
    async (num) => (num ? study.getStrongsEntry(num) : null),
  );

  const isOpen = () => props.strongsNumber !== null;

  const languageColor = (lang: 'hebrew' | 'greek') =>
    lang === 'hebrew'
      ? 'text-[--color-strongs-hebrew] dark:text-[--color-strongs-hebrew-dark]'
      : 'text-[--color-strongs-greek] dark:text-[--color-strongs-greek-dark]';

  const renderEntry = (e: StrongsEntry) => (
    <div class="p-5 space-y-3">
      {/* Header: number + lemma */}
      <div class="flex items-baseline gap-3">
        <Dialog.Title class={`font-mono text-lg font-bold ${languageColor(e.language)}`}>
          {e.number}
        </Dialog.Title>
        <span class="font-serif text-xl text-[--color-ink] dark:text-[--color-ink-dark]">
          {e.lemma}
        </span>
      </div>

      {/* Transliteration + pronunciation */}
      <Show when={e.transliteration || e.pronunciation}>
        <div class="text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
          <Show when={e.transliteration}>
            <span class="font-serif italic">{e.transliteration}</span>
          </Show>
          <Show when={e.pronunciation}>
            <span class="ml-2">({e.pronunciation})</span>
          </Show>
        </div>
      </Show>

      {/* Definition */}
      <div class="border-t border-[--color-border] dark:border-[--color-border-dark] pt-3">
        <p class="text-sm text-[--color-ink] dark:text-[--color-ink-dark] leading-relaxed">
          {e.definition}
        </p>
      </div>

      {/* KJV definition */}
      <Show when={e.kjvDefinition}>
        <div class="text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
          <span class="font-semibold">KJV:</span> {e.kjvDefinition}
        </div>
      </Show>

      <Dialog.Description class="sr-only">
        Strong's concordance entry for {e.number}
      </Dialog.Description>
    </div>
  );

  return (
    <Dialog open={isOpen()} onOpenChange={(open) => !open && props.onClose()} modal>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in" />
        <Dialog.Content class="fixed left-1/2 top-1/4 z-50 w-full max-w-[480px] -translate-x-1/2 rounded-xl bg-[--color-paper] dark:bg-[--color-paper-dark] shadow-2xl border border-[--color-border] dark:border-[--color-border-dark] overflow-hidden animate-in fade-in slide-in-from-top-4">
          <Show when={entry.loading}>
            <div class="p-6 text-center text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
              Loading...
            </div>
          </Show>
          <Show when={!entry.loading && !entry()}>
            <div class="p-6 text-center text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
              <Dialog.Title class="sr-only">Strong's Entry</Dialog.Title>
              <Dialog.Description>No entry found</Dialog.Description>
            </div>
          </Show>
          <Show when={!entry.loading && entry()}>{(e) => renderEntry(e())}</Show>

          {/* Close button */}
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
