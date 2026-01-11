import { For } from 'solid-js';

import type { Verse as VerseType } from '../../bible/types.js';
import { useTheme } from '../context/theme.js';

interface VerseProps {
  verse: VerseType;
  isHighlighted?: boolean;
  id?: string;
}

export function Verse(props: VerseProps) {
  const { theme } = useTheme();

  // Clean up verse text (remove pilcrow and brackets)
  const cleanText = () => props.verse.text
    .replace(/^\u00b6\s*/, '') // Remove pilcrow at start
    .replace(/\[([^\]]+)\]/g, '$1'); // Remove brackets around italicized words

  return (
    <box
      id={props.id}
      flexDirection="row"
      paddingLeft={2}
      paddingRight={2}
      paddingTop={0}
      paddingBottom={0}
      backgroundColor={props.isHighlighted ? theme().verseHighlight : undefined}
    >
      <text fg={theme().verseNumber} marginRight={1} minWidth={4}>
        <strong>{props.verse.verse}</strong>
      </text>
      <text fg={theme().verseText} wrapMode="word">
        {cleanText()}
      </text>
    </box>
  );
}

interface VerseParagraphProps {
  verses: VerseType[];
  highlightedVerse?: number | null;
}

export function VerseParagraph(props: VerseParagraphProps) {
  const { theme } = useTheme();

  return (
    <box paddingLeft={2} paddingRight={2}>
      <text fg={theme().verseText} wrapMode="word">
        <For each={props.verses}>
          {(verse, index) => {
            // Clean up verse text
            const cleanText = verse.text
              .replace(/^\u00b6\s*/, '')
              .replace(/\[([^\]]+)\]/g, '$1');

            const isHighlighted = () => props.highlightedVerse === verse.verse;

            return (
              <span>
                <strong style={{ fg: theme().verseNumber, bg: isHighlighted() ? theme().verseHighlight : undefined }}>
                  {verse.verse}
                </strong>
                <span style={{ bg: isHighlighted() ? theme().verseHighlight : undefined }}>
                  {' '}{cleanText}
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
