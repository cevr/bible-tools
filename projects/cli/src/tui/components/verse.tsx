import { For, Show, createMemo } from 'solid-js';

import type { Verse as VerseType } from '../../bible/types.js';
import { useTheme } from '../context/theme.js';

interface VerseProps {
  verse: VerseType;
  isHighlighted?: boolean;
  isSearchMatch?: boolean;
  searchQuery?: string;
  id?: string;
}

// Split text into segments with search highlights
function splitBySearch(text: string, query: string): Array<{ text: string; highlight: boolean }> {
  if (!query || query.length < 2) {
    return [{ text, highlight: false }];
  }

  const segments: Array<{ text: string; highlight: boolean }> = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let lastIndex = 0;

  let pos = 0;
  while ((pos = lowerText.indexOf(lowerQuery, pos)) !== -1) {
    // Add text before match
    if (pos > lastIndex) {
      segments.push({ text: text.slice(lastIndex, pos), highlight: false });
    }
    // Add matched text
    segments.push({ text: text.slice(pos, pos + query.length), highlight: true });
    lastIndex = pos + query.length;
    pos += 1;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), highlight: false });
  }

  return segments.length > 0 ? segments : [{ text, highlight: false }];
}

export function Verse(props: VerseProps) {
  const { theme } = useTheme();

  // Clean up verse text (remove pilcrow and brackets)
  const cleanText = () => props.verse.text
    .replace(/^\u00b6\s*/, '') // Remove pilcrow at start
    .replace(/\[([^\]]+)\]/g, '$1'); // Remove brackets around italicized words

  const segments = createMemo(() => splitBySearch(cleanText(), props.searchQuery ?? ''));

  return (
    <box
      id={props.id}
      flexDirection="row"
      paddingLeft={2}
      paddingRight={2}
      paddingTop={0}
      paddingBottom={0}
      backgroundColor={props.isHighlighted ? theme().verseHighlight : props.isSearchMatch ? theme().backgroundPanel : undefined}
    >
      <text fg={theme().verseNumber} marginRight={1} minWidth={4}>
        <strong>{props.verse.verse}</strong>
      </text>
      <text fg={theme().verseText} wrapMode="word">
        <For each={segments()}>
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
      </text>
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

  const renderTextWithHighlights = (text: string, query: string | undefined) => {
    const segments = splitBySearch(text, query ?? '');
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
    <box paddingLeft={2} paddingRight={2}>
      <text fg={theme().verseText} wrapMode="word">
        <For each={props.verses}>
          {(verse, index) => {
            // Clean up verse text
            const cleanText = verse.text
              .replace(/^\u00b6\s*/, '')
              .replace(/\[([^\]]+)\]/g, '$1');

            const isHighlighted = () => props.highlightedVerse === verse.verse;
            const isSearchMatch = () => props.searchMatchVerses?.includes(verse.verse) ?? false;

            return (
              <span>
                <strong style={{
                  fg: theme().verseNumber,
                  bg: isHighlighted() ? theme().verseHighlight : isSearchMatch() ? theme().backgroundPanel : undefined
                }}>
                  {verse.verse}
                </strong>
                <span style={{ bg: isHighlighted() ? theme().verseHighlight : isSearchMatch() ? theme().backgroundPanel : undefined }}>
                  {' '}{renderTextWithHighlights(cleanText, props.searchQuery)}
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
