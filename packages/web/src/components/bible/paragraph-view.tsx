/**
 * Paragraph display mode for Bible reading.
 *
 * Renders all verses as continuous text with inline verse numbers,
 * like a printed Bible page. Selected verse gets a subtle highlight.
 */
import type { Verse } from '@/data/bible';
import type { MarginNote } from '@/data/study/service';
import { cleanVerseText, segmentVerseText } from './verse-text';
import { renderSegment } from './verse-renderer';

export interface ParagraphViewProps {
  verses: readonly Verse[];
  selectedVerse: number;
  marginNotesByVerse?: Map<number, MarginNote[]>;
  searchQuery?: string;
  onVerseClick: (verse: number) => void;
}

export function ParagraphView({
  verses,
  selectedVerse,
  marginNotesByVerse,
  searchQuery,
  onVerseClick,
}: ParagraphViewProps) {
  return (
    <div className="reading-text leading-[1.9]">
      {verses.map((verse, index) => {
        const notes = marginNotesByVerse?.get(verse.verse) ?? [];
        const segments = segmentVerseText(cleanVerseText(verse.text), notes, searchQuery);
        const isSelected = selectedVerse === verse.verse;

        return (
          <span key={verse.verse}>
            <sup
              className={`verse-num cursor-pointer select-none ${
                isSelected ? 'text-primary font-bold' : ''
              }`}
              style={{ fontVariantNumeric: 'tabular-nums' }}
              onClick={() => onVerseClick(verse.verse)}
            >
              {verse.verse}
            </sup>
            <span
              className={`cursor-pointer transition-colors duration-100 ${
                isSelected ? 'bg-accent rounded-sm' : ''
              }`}
              onClick={() => onVerseClick(verse.verse)}
              data-verse={verse.verse}
            >
              {'\u2009'}
              {segments.map((segment, i) => renderSegment(segment, notes, i))}
            </span>
            {index < verses.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </div>
  );
}
