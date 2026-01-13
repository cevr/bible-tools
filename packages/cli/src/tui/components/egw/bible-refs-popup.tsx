/**
 * EGW Bible References Popup
 *
 * Shows Bible references found in the current EGW paragraph.
 * Navigate with j/k or up/down, select with Enter to navigate to Bible verse, close with Escape.
 */

import {
  extractBibleReferences,
  formatBibleReference,
} from '@bible/core/bible-reader';
import type { EGWParagraph } from '@bible/core/egw-reader';
import type { ScrollBoxRenderable } from '@opentui/core';
import { useKeyboard } from '@opentui/solid';
import { createMemo, createSignal, For, Show } from 'solid-js';

import { useBibleData } from '../../context/bible.js';
import { useTheme } from '../../context/theme.js';
import { useScrollSync } from '../../hooks/use-scroll-sync.js';

/**
 * Strip HTML tags from content
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .trim();
}

interface EGWBibleRefsPopupProps {
  paragraph: EGWParagraph;
  onClose: () => void;
  onNavigate: (ref: { book: number; chapter: number; verse?: number }) => void;
}

export function EGWBibleRefsPopup(props: EGWBibleRefsPopupProps) {
  const { theme } = useTheme();
  const data = useBibleData();
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  let scrollRef: ScrollBoxRenderable | undefined;

  // Extract Bible references from paragraph content
  const references = createMemo(() => {
    const content = stripHtml(props.paragraph.content ?? '');
    return extractBibleReferences(content);
  });

  // Get preview text for each reference
  const refsWithPreviews = createMemo(() => {
    return references().map((extracted) => {
      const verse = data.getVerse(
        extracted.ref.book,
        extracted.ref.chapter,
        extracted.ref.verse ?? 1,
      );
      let preview = '';
      if (verse) {
        preview = verse.text
          .replace(/\u00b6\s*/, '')
          .replace(/\[.*?\]/g, '')
          .slice(0, 60);
        if (verse.text.length > 60) preview += '...';
      }
      return { extracted, preview };
    });
  });

  const moveSelection = (delta: number) => {
    setSelectedIndex((i) => {
      const maxIndex = refsWithPreviews().length - 1;
      const newIndex = i + delta;
      return Math.max(0, Math.min(maxIndex, newIndex));
    });
  };

  // Scroll to keep selected item visible
  useScrollSync(() => `bibleref-${selectedIndex()}`, {
    getRef: () => scrollRef,
  });

  const selectCurrent = () => {
    const refs = refsWithPreviews();
    const selected = refs[selectedIndex()];
    if (selected) {
      props.onNavigate(selected.extracted.ref);
    }
  };

  useKeyboard((key) => {
    if (key.name === 'escape') {
      props.onClose();
      return;
    }

    if (key.name === 'return') {
      selectCurrent();
      return;
    }

    if (key.name === 'up' || key.name === 'k') {
      moveSelection(-1);
      return;
    }

    if (key.name === 'down' || key.name === 'j') {
      moveSelection(1);
      return;
    }
  });

  const refcode = () =>
    props.paragraph.refcodeShort ?? props.paragraph.refcodeLong ?? '';
  const hasRefs = () => refsWithPreviews().length > 0;

  return (
    <box
      flexDirection="column"
      border
      borderColor={theme().border}
      backgroundColor={theme().backgroundPanel}
      width={70}
      maxHeight={18}
      padding={1}
    >
      {/* Header */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        marginBottom={1}
      >
        <text fg={theme().text}>
          <strong>Bible References</strong>
        </text>
        <text fg={theme().textMuted}>{refcode()}</text>
      </box>

      {/* References List */}
      <Show
        when={hasRefs()}
        fallback={
          <text fg={theme().textMuted}>
            No Bible references found in this paragraph
          </text>
        }
      >
        <scrollbox
          ref={scrollRef}
          focused={false}
          style={{
            height: 10,
            rootOptions: {
              backgroundColor: theme().backgroundPanel,
            },
            wrapperOptions: {
              backgroundColor: theme().backgroundPanel,
            },
            viewportOptions: {
              backgroundColor: theme().backgroundPanel,
            },
            contentOptions: {
              backgroundColor: theme().backgroundPanel,
            },
            scrollbarOptions: {
              showArrows: false,
              trackOptions: {
                foregroundColor: theme().accent,
                backgroundColor: theme().border,
              },
            },
          }}
        >
          <For each={refsWithPreviews()}>
            {(item, index) => {
              const isSelected = () => index() === selectedIndex();
              const refText = formatBibleReference(item.extracted.ref);
              const paddedRef = refText.padEnd(20, ' ');
              return (
                <box
                  id={`bibleref-${index()}`}
                  flexDirection="column"
                  backgroundColor={
                    isSelected() ? theme().verseHighlight : undefined
                  }
                  paddingLeft={1}
                  paddingRight={1}
                >
                  <text fg={isSelected() ? theme().accent : theme().textMuted}>
                    {isSelected() ? '▶ ' : '  '}
                    <span
                      style={{
                        fg: isSelected() ? theme().accent : theme().text,
                      }}
                    >
                      {isSelected() ? <strong>{paddedRef}</strong> : paddedRef}
                    </span>
                    <span style={{ fg: theme().textMuted }}>
                      ({item.extracted.text})
                    </span>
                  </text>
                  <text
                    fg={theme().text}
                    paddingLeft={4}
                    wrapMode="word"
                  >
                    {item.preview}
                  </text>
                </box>
              );
            }}
          </For>
        </scrollbox>
      </Show>

      {/* Footer */}
      <box marginTop={1}>
        <text fg={theme().textMuted}>
          <Show when={hasRefs()}>
            <span style={{ fg: theme().accent }}>↑↓</span> nav
            {'  '}
            <span style={{ fg: theme().accent }}>Enter</span> go to verse
            {'  '}
          </Show>
          <span style={{ fg: theme().accent }}>Esc</span> close
        </text>
      </box>
    </box>
  );
}
