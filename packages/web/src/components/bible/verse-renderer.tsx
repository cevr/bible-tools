/**
 * Rich verse text renderer.
 *
 * Transforms raw verse text into styled JSX with:
 * - Red-letter text (single angle quotes -> curly quotes, colored spans)
 * - Italic translator additions ([brackets] -> <em>)
 * - Pilcrow removal (leading paragraph mark)
 * - Margin note superscripts with popover details
 * - Search term highlighting
 */
import { type ReactNode } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import type { MarginNote } from '@/data/study/service';
import { type TextSegment, segmentVerseText, cleanVerseText } from '@/components/bible/verse-text';

// --- Components ---

export interface VerseRendererProps {
  text: string;
  marginNotes?: MarginNote[];
  searchQuery?: string;
}

/** Format margin note type as a prefix. */
function formatNoteType(noteType: string): string {
  switch (noteType) {
    case 'hebrew':
      return 'Heb. ';
    case 'greek':
      return 'Gr. ';
    case 'alternate':
      return 'Or, ';
    default:
      return '';
  }
}

/** Render a single text segment to JSX. */
export function renderSegment(
  segment: TextSegment,
  marginNotes: MarginNote[],
  key: string | number,
): ReactNode {
  switch (segment.type) {
    case 'margin': {
      const note = marginNotes.find((n) => n.noteIndex === segment.noteIndex);
      if (!note)
        return (
          <sup key={key} className="margin-sup">
            {segment.noteIndex}
          </sup>
        );
      return <MarginNoteSup key={key} note={note} />;
    }
    case 'highlight':
      return (
        <mark key={key} className="search-highlight">
          {segment.text}
        </mark>
      );
    case 'italic':
      return (
        <em key={key} className="translator-addition">
          {segment.text}
        </em>
      );
    case 'redLetter':
      return (
        <span key={key} className="red-letter">
          {segment.text}
        </span>
      );
    case 'redLetterItalic':
      return (
        <em key={key} className="red-letter translator-addition">
          {segment.text}
        </em>
      );
    case 'redLetterQuote':
      return (
        <span key={key} className="red-letter">
          {segment.text}
        </span>
      );
    case 'text':
      return <span key={key}>{segment.text}</span>;
  }
}

/** Margin note superscript with popover. */
function MarginNoteSup({ note }: { note: MarginNote }) {
  return (
    <Popover>
      <PopoverTrigger
        className="margin-sup cursor-pointer hover:text-primary transition-colors align-super text-[0.6em] font-medium leading-none"
        aria-label={`Margin note ${note.noteIndex}`}
      >
        {note.noteIndex}
      </PopoverTrigger>
      <PopoverContent
        className="max-w-[280px] rounded-lg bg-background border border-border shadow-lg p-3 font-sans text-sm"
        sideOffset={4}
      >
        <div className="space-y-1">
          <p>
            <span className="text-muted-foreground">{formatNoteType(note.noteType)}</span>
            <strong className="text-foreground">{note.phrase}</strong>
          </p>
          <p className="text-foreground">{note.noteText}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function VerseRenderer({ text, marginNotes = [], searchQuery }: VerseRendererProps) {
  const segments = segmentVerseText(cleanVerseText(text), marginNotes, searchQuery);

  return <>{segments.map((segment, i) => renderSegment(segment, marginNotes, i))}</>;
}
