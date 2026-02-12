/**
 * Word mode view for Strong's concordance study.
 *
 * Displays verse text as individual words with Strong's number indicators.
 * Arrow keys navigate between words, Space/Enter opens Strong's popup.
 */
import { For, Show, type Component } from 'solid-js';
import type { VerseWord } from '@/data/study/service';

export interface WordModeViewProps {
  words: VerseWord[];
  selectedIndex: number;
  onSelectWord: (index: number) => void;
  onOpenStrongs: (strongsNumber: string) => void;
}

export const WordModeView: Component<WordModeViewProps> = (props) => {
  return (
    <span class="reading-text">
      <For each={props.words}>
        {(word, index) => {
          const isSelected = () => index() === props.selectedIndex;
          const hasStrongs = () => word.strongsNumbers !== null && word.strongsNumbers.length > 0;

          return (
            <>
              <span
                class="cursor-pointer rounded px-0.5 transition-colors duration-75"
                classList={{
                  'bg-[--color-accent]/15 dark:bg-[--color-accent-dark]/15 text-[--color-accent] dark:text-[--color-accent-dark] font-semibold underline underline-offset-2':
                    isSelected(),
                  'text-[--color-ink] dark:text-[--color-ink-dark]': !isSelected() && hasStrongs(),
                  'text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]':
                    !isSelected() && !hasStrongs(),
                }}
                tabIndex={0}
                aria-selected={isSelected()}
                aria-description={
                  hasStrongs() ? `Strong's: ${word.strongsNumbers?.join(', ')}` : undefined
                }
                onClick={() => {
                  props.onSelectWord(index());
                  const first = word.strongsNumbers?.[0];
                  if (first) {
                    props.onOpenStrongs(first);
                  }
                }}
              >
                {word.wordText}
              </span>
              <Show when={isSelected() && hasStrongs()}>
                <sup class="text-[0.6rem] font-mono text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] ml-0.5">
                  {word.strongsNumbers?.[0]}
                </sup>
              </Show>
              {index() < props.words.length - 1 ? ' ' : ''}
            </>
          );
        }}
      </For>
    </span>
  );
};
