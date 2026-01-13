/**
 * EGW Paragraph Component
 *
 * Renders a single EGW paragraph with Bible reference highlighting.
 */

import { segmentTextWithReferences } from '@bible/core/bible-reader';
import type { EGWParagraph } from '@bible/core/egw-reader';
import { createMemo, For, Show } from 'solid-js';

import { useTheme } from '../../context/theme.js';

/**
 * Strip HTML tags from content, converting <br /> to newlines
 */
function stripHtml(html: string): string {
  return (
    html
      // Convert <br>, <br/>, <br /> to newlines
      .replace(/<br\s*\/?>/gi, '\n')
      // Remove all other HTML tags
      .replace(/<[^>]+>/g, '')
      // Decode common HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Clean up excessive whitespace (but keep single newlines)
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim()
  );
}

interface EGWParagraphViewProps {
  id: string;
  paragraph: EGWParagraph;
  isSelected: boolean;
  showRefcode?: boolean;
}

export function EGWParagraphView(props: EGWParagraphViewProps) {
  const { theme } = useTheme();

  const refcode = () =>
    props.paragraph.refcodeShort ?? props.paragraph.refcodeLong ?? '';
  const cleanContent = createMemo(() =>
    stripHtml(props.paragraph.content ?? ''),
  );

  // Segment content with Bible references highlighted
  const segments = createMemo(() => segmentTextWithReferences(cleanContent()));

  // Determine if this is a heading based on element_type
  const isHeading = () => {
    const type = props.paragraph.elementType;
    return type === 'heading' || type === 'title' || type === 'chapter';
  };

  const textColor = () =>
    props.isSelected ? theme().textHighlight : theme().text;
  const refColor = () => (props.isSelected ? theme().warning : theme().accent);

  return (
    <box
      id={props.id}
      flexDirection="column"
      paddingLeft={2}
      paddingRight={2}
      backgroundColor={props.isSelected ? theme().verseHighlight : undefined}
    >
      {/* Content with Bible references highlighted and refcode at end */}
      <text
        fg={textColor()}
        wrapMode="word"
      >
        <For each={segments()}>
          {(segment) => {
            if (segment.type === 'ref') {
              return (
                <span style={{ fg: refColor() }}>
                  {isHeading() ? <strong>{segment.text}</strong> : segment.text}
                </span>
              );
            }
            return isHeading() ? (
              <strong>{segment.text}</strong>
            ) : (
              <span>{segment.text}</span>
            );
          }}
        </For>
        <Show when={props.showRefcode !== false && refcode()}>
          <span
            style={{
              fg: props.isSelected ? theme().accent : theme().textMuted,
            }}
          >
            {' '}
            {props.isSelected ? <strong>{refcode()}</strong> : refcode()}
          </span>
        </Show>
      </text>
    </box>
  );
}
