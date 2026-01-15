import { createMemo, For, Show } from 'solid-js';

import type { Verse as VerseType } from '../../../data/bible/types.js';
import type {
  MarginNoteCompat as MarginNote,
  WordWithStrongs,
} from '../../context/study-data.js';
import { useTheme } from '../../context/theme.js';

interface VerseProps {
  verse: VerseType;
  isHighlighted?: boolean;
  isSearchMatch?: boolean;
  searchQuery?: string;
  id?: string;
  wordModeActive?: boolean;
  words?: WordWithStrongs[];
  selectedWordIndex?: number;
  marginNotes?: MarginNote[];
}

// Format margin note type prefix
export function formatNoteType(type: MarginNote['type']): string {
  switch (type) {
    case 'hebrew':
      return 'Heb.';
    case 'greek':
      return 'Gr.';
    case 'alternate':
      return 'Or,';
    case 'name':
      return '';
    case 'other':
      return '';
  }
}

// Convert number to superscript
function toSuperscript(n: number): string {
  const superscripts = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
  return String(n)
    .split('')
    .map((d) => superscripts[parseInt(d)]!)
    .join('');
}

type TextSegment =
  | { type: 'text'; text: string }
  | { type: 'highlight'; text: string }
  | { type: 'margin'; noteIndex: number };

/**
 * Split verse text into segments with margin note superscripts inserted after matching phrases.
 * Also handles search highlighting.
 */
function segmentVerseText(
  text: string,
  marginNotes: MarginNote[],
  searchQuery?: string,
): TextSegment[] {
  // First, find all phrase matches and their positions
  const phraseMatches: Array<{
    start: number;
    end: number;
    noteIndex: number;
  }> = [];

  for (let i = 0; i < marginNotes.length; i++) {
    const note = marginNotes[i]!;
    const phrase = note.phrase.toLowerCase();
    const lowerText = text.toLowerCase();

    // Find phrase in text (case-insensitive)
    const pos = lowerText.indexOf(phrase);
    if (pos !== -1) {
      phraseMatches.push({
        start: pos,
        end: pos + phrase.length,
        noteIndex: i + 1, // 1-indexed for display
      });
    }
  }

  // Sort by position (end position, so superscript appears after phrase)
  phraseMatches.sort((a, b) => a.end - b.end);

  // Build segments
  const segments: TextSegment[] = [];
  let lastIndex = 0;

  for (const match of phraseMatches) {
    // Add text before this phrase's end (including the phrase itself)
    if (match.end > lastIndex) {
      const textBefore = text.slice(lastIndex, match.end);
      segments.push({ type: 'text', text: textBefore });
    }
    // Add superscript
    segments.push({ type: 'margin', noteIndex: match.noteIndex });
    lastIndex = match.end;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({ type: 'text', text: text.slice(lastIndex) });
  }

  // If no margin matches, just return the whole text
  if (segments.length === 0) {
    segments.push({ type: 'text', text });
  }

  // Now apply search highlighting within text segments
  if (searchQuery && searchQuery.length >= 2) {
    const finalSegments: TextSegment[] = [];
    const lowerQuery = searchQuery.toLowerCase();

    for (const segment of segments) {
      if (segment.type !== 'text') {
        finalSegments.push(segment);
        continue;
      }

      // Split text segment by search query
      const segText = segment.text;
      const lowerSegText = segText.toLowerCase();
      let pos = 0;
      let searchPos = 0;

      while ((searchPos = lowerSegText.indexOf(lowerQuery, pos)) !== -1) {
        // Text before match
        if (searchPos > pos) {
          finalSegments.push({
            type: 'text',
            text: segText.slice(pos, searchPos),
          });
        }
        // Highlighted match
        finalSegments.push({
          type: 'highlight',
          text: segText.slice(searchPos, searchPos + searchQuery.length),
        });
        pos = searchPos + searchQuery.length;
      }

      // Remaining text
      if (pos < segText.length) {
        finalSegments.push({ type: 'text', text: segText.slice(pos) });
      }
    }

    return finalSegments;
  }

  return segments;
}

export function Verse(props: VerseProps) {
  const { theme } = useTheme();

  // Clean up verse text (remove pilcrow and brackets)
  const cleanText = () =>
    props.verse.text.replace(/^\u00b6\s*/, '').replace(/\[([^\]]+)\]/g, '$1');

  const segments = createMemo(() =>
    segmentVerseText(cleanText(), props.marginNotes ?? [], props.searchQuery),
  );

  // Render content based on word mode
  const renderContent = () => {
    // Word mode: render individual words with selection highlight
    if (props.wordModeActive && props.words && props.words.length > 0) {
      return (
        <For each={props.words}>
          {(word, index) => {
            const isSelected = () => index() === props.selectedWordIndex;
            const hasStrongs = () => word.strongs && word.strongs.length > 0;
            return (
              <span>
                <span
                  style={{
                    fg: isSelected()
                      ? theme().accent
                      : hasStrongs()
                        ? theme().text
                        : theme().textMuted,
                    textDecoration: isSelected() ? 'underline' : undefined,
                  }}
                >
                  {isSelected() ? <strong>{word.text}</strong> : word.text}
                </span>
                {index() < props.words!.length - 1 ? ' ' : ''}
              </span>
            );
          }}
        </For>
      );
    }

    // Normal mode: render with margin superscripts and search highlights
    return (
      <For each={segments()}>
        {(segment) => {
          if (segment.type === 'margin') {
            return (
              <span style={{ fg: theme().accentMuted }}>
                {toSuperscript(segment.noteIndex)}
              </span>
            );
          }
          if (segment.type === 'highlight') {
            return (
              <span style={{ fg: theme().background, bg: theme().warning }}>
                <strong>{segment.text}</strong>
              </span>
            );
          }
          return <span>{segment.text}</span>;
        }}
      </For>
    );
  };

  return (
    <box
      id={props.id}
      flexDirection="column"
      paddingLeft={2}
      paddingRight={2}
      paddingTop={0}
      paddingBottom={0}
      backgroundColor={
        props.isHighlighted
          ? theme().verseHighlight
          : props.isSearchMatch
            ? theme().backgroundPanel
            : undefined
      }
    >
      <box flexDirection="row">
        <text
          fg={theme().verseNumber}
          marginRight={1}
          minWidth={3}
        >
          <strong>{props.verse.verse}</strong>
        </text>
        <text
          fg={theme().verseText}
          wrapMode="word"
        >
          {renderContent()}
        </text>
      </box>
    </box>
  );
}

interface VerseParagraphProps {
  verses: VerseType[];
  highlightedVerse?: number | null;
  searchQuery?: string;
  searchMatchVerses?: number[];
}

export function VerseParagraph(props: VerseParagraphProps) {
  const { theme } = useTheme();

  const renderTextWithHighlights = (
    text: string,
    query: string | undefined,
  ) => {
    if (!query || query.length < 2) {
      return <span>{text}</span>;
    }

    const segments: Array<{ text: string; highlight: boolean }> = [];
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    let lastIndex = 0;
    let pos = 0;

    while ((pos = lowerText.indexOf(lowerQuery, pos)) !== -1) {
      if (pos > lastIndex) {
        segments.push({ text: text.slice(lastIndex, pos), highlight: false });
      }
      segments.push({
        text: text.slice(pos, pos + query.length),
        highlight: true,
      });
      lastIndex = pos + query.length;
      pos += 1;
    }

    if (lastIndex < text.length) {
      segments.push({ text: text.slice(lastIndex), highlight: false });
    }

    if (segments.length === 0) {
      return <span>{text}</span>;
    }

    return (
      <For each={segments}>
        {(segment) => (
          <Show
            when={segment.highlight}
            fallback={<span>{segment.text}</span>}
          >
            <span style={{ fg: theme().background, bg: theme().warning }}>
              <strong>{segment.text}</strong>
            </span>
          </Show>
        )}
      </For>
    );
  };

  return (
    <box
      paddingLeft={2}
      paddingRight={2}
    >
      <text
        fg={theme().verseText}
        wrapMode="word"
      >
        <For each={props.verses}>
          {(verse, index) => {
            const cleanText = verse.text
              .replace(/^\u00b6\s*/, '')
              .replace(/\[([^\]]+)\]/g, '$1');

            const isHighlighted = () => props.highlightedVerse === verse.verse;
            const isSearchMatch = () =>
              props.searchMatchVerses?.includes(verse.verse) ?? false;

            return (
              <span>
                <strong
                  style={{
                    fg: theme().verseNumber,
                    bg: isHighlighted()
                      ? theme().verseHighlight
                      : isSearchMatch()
                        ? theme().backgroundPanel
                        : undefined,
                  }}
                >
                  {verse.verse}
                </strong>
                <span
                  style={{
                    bg: isHighlighted()
                      ? theme().verseHighlight
                      : isSearchMatch()
                        ? theme().backgroundPanel
                        : undefined,
                  }}
                >
                  {' '}
                  {renderTextWithHighlights(cleanText, props.searchQuery)}
                </span>
                {index() < props.verses.length - 1 ? ' ' : ''}
              </span>
            );
          }}
        </For>
      </text>
    </box>
  );
}
