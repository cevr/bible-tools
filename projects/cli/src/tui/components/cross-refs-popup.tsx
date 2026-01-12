/**
 * Cross-References Popup
 *
 * Shows cross-references for the currently selected verse.
 * Navigate with j/k or up/down, select with Enter, close with Escape.
 */

import { createSignal, createMemo, For, Show } from 'solid-js';
import { useKeyboard } from '@opentui/solid';
import type { ScrollBoxRenderable } from '@opentui/core';

import type { Reference } from '../../bible/types.js';
import { formatReference, getBook } from '../../bible/types.js';
import { useBibleData } from '../context/bible.js';
import { useStudyData } from '../context/study-data.js';
import { useTheme } from '../context/theme.js';
import { useScrollSync } from '../hooks/use-scroll-sync.js';

interface CrossRefsPopupProps {
  verseRef: Reference;
  onClose: () => void;
  onNavigate: (ref: Reference) => void;
}

export function CrossRefsPopup(props: CrossRefsPopupProps) {
  const { theme } = useTheme();
  const data = useBibleData();
  const studyData = useStudyData();
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  let scrollRef: ScrollBoxRenderable | undefined;

  // Get cross-references for this verse
  const crossRefs = createMemo(() => {
    const verse = props.verseRef.verse ?? 1;
    return studyData.getCrossRefs(props.verseRef.book, props.verseRef.chapter, verse);
  });

  // Get preview text for each reference
  const refsWithPreviews = createMemo(() => {
    return crossRefs().map(ref => {
      const verse = data.getVerse(ref.book, ref.chapter, ref.verse ?? 1);
      let preview = '';
      if (verse) {
        preview = verse.text
          .replace(/\u00b6\s*/, '')
          .replace(/\[.*?\]/g, '')
          .slice(0, 50);
        if (verse.text.length > 50) preview += '...';
      }
      return { ref, preview };
    });
  });

  const moveSelection = (delta: number) => {
    setSelectedIndex(i => {
      const maxIndex = refsWithPreviews().length - 1;
      const newIndex = i + delta;
      return Math.max(0, Math.min(maxIndex, newIndex));
    });
  };

  // Scroll to keep selected item visible
  useScrollSync(
    () => `crossref-${selectedIndex()}`,
    { getRef: () => scrollRef }
  );

  const selectCurrent = () => {
    const refs = refsWithPreviews();
    const selected = refs[selectedIndex()];
    if (selected) {
      props.onNavigate(selected.ref);
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

    if (key.name === 'up' || key.sequence === 'k') {
      moveSelection(-1);
      return;
    }

    if (key.name === 'down' || key.sequence === 'j') {
      moveSelection(1);
      return;
    }
  });

  const sourceBook = getBook(props.verseRef.book);
  const sourceLabel = sourceBook
    ? `${sourceBook.name} ${props.verseRef.chapter}:${props.verseRef.verse ?? 1}`
    : 'Unknown';

  return (
    <box
      flexDirection="column"
      border
      borderColor={theme().border}
      backgroundColor={theme().backgroundPanel}
      width={65}
      maxHeight={18}
      padding={1}
    >
      {/* Header */}
      <box marginBottom={1}>
        <text fg={theme().text}>
          <strong>Cross-References for {sourceLabel}</strong>
        </text>
      </box>

      {/* Results */}
      <Show
        when={refsWithPreviews().length > 0}
        fallback={
          <text fg={theme().textMuted}>No cross-references found</text>
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
              const refText = formatReference(item.ref);
              // Pad reference to fixed width for alignment
              const paddedRef = refText.padEnd(25, ' ');
              return (
                <text id={`crossref-${index()}`} fg={isSelected() ? theme().accent : theme().textMuted}>
                  {isSelected() ? '▶ ' : '  '}
                  <span style={{ fg: isSelected() ? theme().accent : theme().text }}>
                    {isSelected() ? <strong>{paddedRef}</strong> : paddedRef}
                  </span>
                  {item.preview}
                </text>
              );
            }}
          </For>
        </scrollbox>
      </Show>

      {/* Footer */}
      <box marginTop={1}>
        <text fg={theme().textMuted}>
          ↑↓ navigate • Enter select • Esc close
        </text>
      </box>
    </box>
  );
}
