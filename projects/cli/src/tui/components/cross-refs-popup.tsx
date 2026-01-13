/**
 * Cross-References Popup
 *
 * Shows cross-references, margin notes, and EGW commentary for the currently selected verse.
 * Navigate with j/k or up/down, select with Enter, close with Escape.
 * Switch between pages with h/l or left/right arrows.
 *
 * Pages:
 * 1. Cross-references & Margin Notes
 * 2. EGW Commentary (from Bible Commentary volumes)
 */

import {
  EGWCommentaryService,
  type CommentaryEntry,
} from '@bible/core/egw-commentary';
import { EGWParagraphDatabase } from '@bible/core/egw-db';
import { BunContext } from '@effect/platform-bun';
import type { ScrollBoxRenderable } from '@opentui/core';
import { useKeyboard } from '@opentui/solid';
import { Effect, Layer } from 'effect';
import { createMemo, createSignal, For, Show } from 'solid-js';

import type { Reference } from '../../bible/types.js';
import { formatReference, getBook } from '../../bible/types.js';
import { useBibleData } from '../context/bible.js';
import { useStudyData } from '../context/study-data.js';
import { useTheme } from '../context/theme.js';
import { useScrollSync } from '../hooks/use-scroll-sync.js';
import { formatNoteType } from './verse.js';

/** Page type for the popup */
type PopupPage = 'crossrefs' | 'commentary';

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
  const [currentPage, setCurrentPage] = createSignal<PopupPage>('crossrefs');
  const [commentary, setCommentary] = createSignal<readonly CommentaryEntry[]>(
    [],
  );
  const [commentaryLoading, setCommentaryLoading] = createSignal(false);
  const [selectedCommentaryIndex, setSelectedCommentaryIndex] = createSignal(0);
  let scrollRef: ScrollBoxRenderable | undefined;
  let commentaryScrollRef: ScrollBoxRenderable | undefined;

  // Get cross-references for this verse
  const crossRefs = createMemo(() => {
    const verse = props.verseRef.verse ?? 1;
    return studyData.getCrossRefs(
      props.verseRef.book,
      props.verseRef.chapter,
      verse,
    );
  });

  // Get margin notes for this verse
  const marginNotes = createMemo(() => {
    const verse = props.verseRef.verse ?? 1;
    return studyData.getMarginNotes(
      props.verseRef.book,
      props.verseRef.chapter,
      verse,
    );
  });

  // Get preview text for each reference
  const refsWithPreviews = createMemo(() => {
    return crossRefs().map((ref) => {
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
    if (currentPage() === 'crossrefs') {
      setSelectedIndex((i) => {
        const maxIndex = refsWithPreviews().length - 1;
        const newIndex = i + delta;
        return Math.max(0, Math.min(maxIndex, newIndex));
      });
    } else {
      setSelectedCommentaryIndex((i) => {
        const maxIndex = commentary().length - 1;
        const newIndex = i + delta;
        return Math.max(0, Math.min(maxIndex, newIndex));
      });
    }
  };

  // Scroll to keep selected item visible
  useScrollSync(() => `crossref-${selectedIndex()}`, {
    getRef: () => scrollRef,
  });

  useScrollSync(() => `commentary-${selectedCommentaryIndex()}`, {
    getRef: () => commentaryScrollRef,
  });

  const selectCurrent = () => {
    if (currentPage() === 'crossrefs') {
      const refs = refsWithPreviews();
      const selected = refs[selectedIndex()];
      if (selected) {
        props.onNavigate(selected.ref);
      }
    }
    // Commentary doesn't navigate anywhere, just shows text
  };

  // Switch between pages
  const switchPage = (direction: 'left' | 'right') => {
    if (direction === 'left' && currentPage() === 'commentary') {
      setCurrentPage('crossrefs');
    } else if (direction === 'right' && currentPage() === 'crossrefs') {
      setCurrentPage('commentary');
      // Load commentary if not already loaded
      if (commentary().length === 0 && !commentaryLoading()) {
        loadCommentary();
      }
    }
  };

  // Load commentary from EGW Commentary service
  const loadCommentary = () => {
    setCommentaryLoading(true);

    const CommentaryLayer = EGWCommentaryService.Default.pipe(
      Layer.provideMerge(EGWParagraphDatabase.Default),
      Layer.provideMerge(BunContext.layer),
    );

    const verse = props.verseRef.verse ?? 1;

    Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* EGWCommentaryService;
        return yield* service.getCommentary({
          book: props.verseRef.book,
          chapter: props.verseRef.chapter,
          verse,
        });
      }).pipe(Effect.provide(CommentaryLayer), Effect.scoped),
    )
      .then((result) => {
        setCommentary(result.entries);
        setCommentaryLoading(false);
      })
      .catch(() => {
        setCommentary([]);
        setCommentaryLoading(false);
      });
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

    // Page navigation with h/l or left/right
    if (key.name === 'left' || key.sequence === 'h') {
      switchPage('left');
      return;
    }

    if (key.name === 'right' || key.sequence === 'l') {
      switchPage('right');
      return;
    }
  });

  const sourceBook = getBook(props.verseRef.book);
  const sourceLabel = sourceBook
    ? `${sourceBook.name} ${props.verseRef.chapter}:${props.verseRef.verse ?? 1}`
    : 'Unknown';

  const hasMarginNotes = () => marginNotes().length > 0;
  const hasCrossRefs = () => refsWithPreviews().length > 0;
  const hasContent = () => hasMarginNotes() || hasCrossRefs();
  const hasCommentary = () => commentary().length > 0;

  return (
    <box
      flexDirection="column"
      border
      borderColor={theme().border}
      backgroundColor={theme().backgroundPanel}
      width={65}
      maxHeight={20}
      padding={1}
    >
      {/* Header with tabs */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        marginBottom={1}
      >
        <text fg={theme().text}>
          <strong>{sourceLabel}</strong>
        </text>
        <box
          flexDirection="row"
          gap={1}
        >
          <text
            fg={
              currentPage() === 'crossrefs' ? theme().accent : theme().textMuted
            }
          >
            {currentPage() === 'crossrefs' ? <strong>[Refs]</strong> : 'Refs'}
          </text>
          <text fg={theme().textMuted}>|</text>
          <text
            fg={
              currentPage() === 'commentary'
                ? theme().accent
                : theme().textMuted
            }
          >
            {currentPage() === 'commentary' ? <strong>[EGW]</strong> : 'EGW'}
          </text>
        </box>
      </box>

      {/* Cross-References Page */}
      <Show when={currentPage() === 'crossrefs'}>
        <Show
          when={hasContent()}
          fallback={
            <text fg={theme().textMuted}>
              No cross-references or margin notes
            </text>
          }
        >
          {/* Margin Notes Section */}
          <Show when={hasMarginNotes()}>
            <box
              flexDirection="column"
              marginBottom={1}
            >
              <text
                fg={theme().textMuted}
                marginBottom={0}
              >
                <strong>Margin Notes</strong>
              </text>
              <For each={marginNotes()}>
                {(note, index) => (
                  <text
                    fg={theme().text}
                    wrapMode="word"
                  >
                    <span style={{ fg: theme().accent }}>{index() + 1}.</span>{' '}
                    <span style={{ fg: theme().accentMuted }}>
                      {formatNoteType(note.type)}
                    </span>
                    {formatNoteType(note.type) ? ' ' : ''}
                    {note.text}
                  </text>
                )}
              </For>
            </box>
          </Show>

          {/* Cross-References Section */}
          <Show when={hasCrossRefs()}>
            <box flexDirection="column">
              <text
                fg={theme().textMuted}
                marginBottom={0}
              >
                <strong>Cross-References</strong>
              </text>
              <scrollbox
                ref={scrollRef}
                focused={false}
                style={{
                  height: hasMarginNotes() ? 6 : 10,
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
                    const paddedRef = refText.padEnd(25, ' ');
                    return (
                      <text
                        id={`crossref-${index()}`}
                        fg={isSelected() ? theme().accent : theme().textMuted}
                      >
                        {isSelected() ? '▶ ' : '  '}
                        <span
                          style={{
                            fg: isSelected() ? theme().accent : theme().text,
                          }}
                        >
                          {isSelected() ? (
                            <strong>{paddedRef}</strong>
                          ) : (
                            paddedRef
                          )}
                        </span>
                        {item.preview}
                      </text>
                    );
                  }}
                </For>
              </scrollbox>
            </box>
          </Show>
        </Show>
      </Show>

      {/* Commentary Page */}
      <Show when={currentPage() === 'commentary'}>
        <Show
          when={!commentaryLoading()}
          fallback={
            <text fg={theme().textMuted}>Loading EGW Commentary...</text>
          }
        >
          <Show
            when={hasCommentary()}
            fallback={
              <text fg={theme().textMuted}>
                No EGW commentary found for this verse
              </text>
            }
          >
            <scrollbox
              ref={commentaryScrollRef}
              focused={false}
              style={{
                height: 12,
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
              <For each={commentary()}>
                {(entry, index) => {
                  const isSelected = () =>
                    index() === selectedCommentaryIndex();
                  return (
                    <box
                      id={`commentary-${index()}`}
                      flexDirection="column"
                      marginBottom={1}
                      backgroundColor={
                        isSelected() ? theme().verseHighlight : undefined
                      }
                      paddingLeft={1}
                      paddingRight={1}
                    >
                      <text
                        fg={isSelected() ? theme().accent : theme().textMuted}
                      >
                        {isSelected() ? (
                          <strong>{entry.refcode}</strong>
                        ) : (
                          entry.refcode
                        )}
                      </text>
                      <text
                        fg={theme().text}
                        wrapMode="word"
                      >
                        {entry.content.slice(0, 200)}
                        {entry.content.length > 200 ? '...' : ''}
                      </text>
                    </box>
                  );
                }}
              </For>
            </scrollbox>
          </Show>
        </Show>
      </Show>

      {/* Footer */}
      <box marginTop={1}>
        <text fg={theme().textMuted}>
          <span style={{ fg: theme().accent }}>←→</span> pages
          {'  '}
          <Show when={currentPage() === 'crossrefs' && hasCrossRefs()}>
            <span style={{ fg: theme().accent }}>↑↓</span> nav •{' '}
            <span style={{ fg: theme().accent }}>Enter</span> select
            {'  '}
          </Show>
          <Show when={currentPage() === 'commentary' && hasCommentary()}>
            <span style={{ fg: theme().accent }}>↑↓</span> scroll
            {'  '}
          </Show>
          <span style={{ fg: theme().accent }}>Esc</span> close
        </text>
      </box>
    </box>
  );
}
