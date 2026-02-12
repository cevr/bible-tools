/**
 * Paragraph display mode for Bible reading.
 *
 * Renders all verses as continuous text with inline verse numbers,
 * like a printed Bible page. Selected verse gets a subtle highlight.
 */
import { createMemo, For, type Component } from 'solid-js';
import type { Verse } from '@/data/bible';
import type { MarginNote } from '@/data/study/service';
import { cleanVerseText, segmentVerseText, renderSegment } from './verse-renderer';

export interface ParagraphViewProps {
  verses: readonly Verse[];
  selectedVerse: number;
  marginNotesByVerse?: Map<number, MarginNote[]>;
  searchQuery?: string;
  onVerseClick: (verse: number) => void;
}

export const ParagraphView: Component<ParagraphViewProps> = (props) => {
  return (
    <div class="reading-text leading-[1.9]">
      <For each={props.verses as Verse[]}>
        {(verse, index) => {
          const notes = () => props.marginNotesByVerse?.get(verse.verse) ?? [];
          const segments = createMemo(() =>
            segmentVerseText(cleanVerseText(verse.text), notes(), props.searchQuery),
          );
          const isSelected = () => props.selectedVerse === verse.verse;

          return (
            <>
              <sup
                class="verse-num cursor-pointer select-none"
                classList={{
                  'text-[--color-accent] dark:text-[--color-accent-dark] font-bold': isSelected(),
                }}
                style={{ 'font-variant-numeric': 'tabular-nums' }}
                onClick={() => props.onVerseClick(verse.verse)}
              >
                {verse.verse}
              </sup>
              <span
                class="cursor-pointer transition-colors duration-100"
                classList={{
                  'bg-[--color-highlight] dark:bg-[--color-highlight-dark] rounded-sm':
                    isSelected(),
                }}
                onClick={() => props.onVerseClick(verse.verse)}
                data-verse={verse.verse}
              >
                {'\u2009'}
                <For each={segments()}>{(segment) => renderSegment(segment, notes())}</For>
              </span>
              {index() < props.verses.length - 1 ? ' ' : ''}
            </>
          );
        }}
      </For>
    </div>
  );
};
