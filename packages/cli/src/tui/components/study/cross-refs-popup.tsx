// @effect-diagnostics strictBooleanExpressions:off strictEffectProvide:off
/**
 * Cross-References Popup
 *
 * Shows cross-references, margin notes, EGW commentary, and structural analysis
 * for the currently selected verse.
 * Navigate with j/k or up/down, select with Enter, close with Escape.
 * Switch between pages with h/l or left/right arrows.
 *
 * Pages:
 * 1. Cross-references & Margin Notes
 * 2. EGW Commentary (from Bible Commentary volumes)
 * 3. Structural Analysis (word frequency, Strong's data)
 */

import { BibleDatabase } from '@bible/core/bible-db';
import { EGWCommentaryService, type CommentaryEntry } from '@bible/core/egw-commentary';
import { EGWParagraphDatabase } from '@bible/core/egw-db';
import {
  StructuralAnalysis,
  type WordFrequencyEntry,
  type PassageContext,
} from '@bible/core/structural-analysis';
import { BunContext } from '@effect/platform-bun';
import type { ScrollBoxRenderable } from '@opentui/core';
import { useModalKeyboard } from '../../hooks/use-modal-keyboard.js';
import { Effect, Layer } from 'effect';
import { createMemo, createSignal, For, Show } from 'solid-js';

import type { Reference } from '../../../data/bible/types.js';
import { formatReference, getBook } from '../../../data/bible/types.js';
import { useBibleData } from '../../context/bible.js';
import { useStudyData } from '../../context/study-data.js';
import { useTheme } from '../../context/theme.js';
import { useScrollSync } from '../../hooks/use-scroll-sync.js';
import { formatNoteType } from '../bible/verse.js';

/** Page type for the popup */
type PopupPage = 'crossrefs' | 'commentary' | 'structure';

const PAGES: PopupPage[] = ['crossrefs', 'commentary', 'structure'];

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
  const [commentary, setCommentary] = createSignal<readonly CommentaryEntry[]>([]);
  const [commentaryLoading, setCommentaryLoading] = createSignal(false);
  const [selectedCommentaryIndex, setSelectedCommentaryIndex] = createSignal(0);
  const [structureData, setStructureData] = createSignal<PassageContext | null>(null);
  const [structureLoading, setStructureLoading] = createSignal(false);
  const [selectedStructureIndex, setSelectedStructureIndex] = createSignal(0);
  let scrollRef: ScrollBoxRenderable | undefined = undefined;
  let commentaryScrollRef: ScrollBoxRenderable | undefined = undefined;
  let structureScrollRef: ScrollBoxRenderable | undefined = undefined;

  // Get cross-references for this verse
  const crossRefs = createMemo(() => {
    const verse = props.verseRef.verse ?? 1;
    return studyData.getCrossRefs(props.verseRef.book, props.verseRef.chapter, verse);
  });

  // Get margin notes for this verse
  const marginNotes = createMemo(() => {
    const verse = props.verseRef.verse ?? 1;
    return studyData.getMarginNotes(props.verseRef.book, props.verseRef.chapter, verse);
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

  // Derived structure data for rendering
  const structureWords = createMemo((): readonly WordFrequencyEntry[] => {
    const ctx = structureData();
    if (!ctx) return [];
    // Show top 20 words + all symbolic entries
    const top = ctx.wordFrequency.entries.slice(0, 20);
    const symbolic = ctx.wordFrequency.symbolicEntries;
    // Merge, deduplicating
    const seen = new Set(top.map((e) => e.word));
    const extra = symbolic.filter((e) => !seen.has(e.word));
    return [...top, ...extra];
  });

  const structureStrongs = createMemo(() => {
    const ctx = structureData();
    if (!ctx) return [];
    // Get Strong's entries for current verse's words
    const verse = props.verseRef.verse ?? 1;
    const words = ctx.words.get(verse) ?? [];
    const strongsNums = new Set<string>();
    for (const w of words) {
      if (w.strongsNumbers) {
        for (const sn of w.strongsNumbers) strongsNums.add(sn);
      }
    }
    return [...strongsNums]
      .map((sn) => ctx.strongsEntries.get(sn))
      .filter((e): e is NonNullable<typeof e> => e != null);
  });

  const moveSelection = (delta: number) => {
    const page = currentPage();
    if (page === 'crossrefs') {
      setSelectedIndex((i) => {
        const maxIndex = refsWithPreviews().length - 1;
        return Math.max(0, Math.min(maxIndex, i + delta));
      });
    } else if (page === 'commentary') {
      setSelectedCommentaryIndex((i) => {
        const maxIndex = commentary().length - 1;
        return Math.max(0, Math.min(maxIndex, i + delta));
      });
    } else {
      setSelectedStructureIndex((i) => {
        const maxIndex = structureWords().length + structureStrongs().length - 1;
        return Math.max(0, Math.min(maxIndex, i + delta));
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

  useScrollSync(() => `structure-${selectedStructureIndex()}`, {
    getRef: () => structureScrollRef,
  });

  const selectCurrent = () => {
    if (currentPage() === 'crossrefs') {
      const refs = refsWithPreviews();
      const selected = refs[selectedIndex()];
      if (selected) {
        props.onNavigate(selected.ref);
      }
    }
    // Commentary and structure don't navigate
  };

  // Switch between pages (cycle through 3 pages)
  const switchPage = (direction: 'left' | 'right') => {
    const idx = PAGES.indexOf(currentPage());
    const nextIdx =
      direction === 'right' ? (idx + 1) % PAGES.length : (idx - 1 + PAGES.length) % PAGES.length;
    const nextPage = PAGES[nextIdx] ?? 'crossrefs';
    setCurrentPage(nextPage);

    if (nextPage === 'commentary' && commentary().length === 0 && !commentaryLoading()) {
      loadCommentary();
    }
    if (nextPage === 'structure' && structureData() === null && !structureLoading()) {
      loadStructure();
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

  // Load structural analysis data
  const loadStructure = () => {
    setStructureLoading(true);

    const StructuralLayer = StructuralAnalysis.Live.pipe(
      Layer.provideMerge(BibleDatabase.Default),
      Layer.provideMerge(BunContext.layer),
    );

    const verse = props.verseRef.verse ?? 1;

    Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* StructuralAnalysis;
        return yield* service.getPassageContext(
          props.verseRef.book,
          props.verseRef.chapter,
          verse,
          verse,
        );
      }).pipe(Effect.provide(StructuralLayer), Effect.scoped),
    )
      .then((result) => {
        setStructureData(result);
        setStructureLoading(false);
      })
      .catch(() => {
        setStructureData(null);
        setStructureLoading(false);
      });
  };

  useModalKeyboard((key) => {
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
  const hasStructure = () => structureData() !== null;

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
      <box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <text fg={theme().text}>
          <strong>{sourceLabel}</strong>
        </text>
        <box flexDirection="row" gap={1}>
          <text fg={currentPage() === 'crossrefs' ? theme().accent : theme().textMuted}>
            {currentPage() === 'crossrefs' ? <strong>[Refs]</strong> : 'Refs'}
          </text>
          <text fg={theme().textMuted}>|</text>
          <text fg={currentPage() === 'commentary' ? theme().accent : theme().textMuted}>
            {currentPage() === 'commentary' ? <strong>[EGW]</strong> : 'EGW'}
          </text>
          <text fg={theme().textMuted}>|</text>
          <text fg={currentPage() === 'structure' ? theme().accent : theme().textMuted}>
            {currentPage() === 'structure' ? <strong>[Struct]</strong> : 'Struct'}
          </text>
        </box>
      </box>

      {/* Cross-References Page */}
      <Show when={currentPage() === 'crossrefs'}>
        <Show
          when={hasContent()}
          fallback={<text fg={theme().textMuted}>No cross-references or margin notes</text>}
        >
          {/* Margin Notes Section */}
          <Show when={hasMarginNotes()}>
            <box flexDirection="column" marginBottom={1}>
              <text fg={theme().textMuted} marginBottom={0}>
                <strong>Margin Notes</strong>
              </text>
              <For each={marginNotes()}>
                {(note, index) => (
                  <text fg={theme().text} wrapMode="word">
                    <span style={{ fg: theme().accent }}>{index() + 1}.</span>{' '}
                    <span style={{ fg: theme().accentMuted }}>{formatNoteType(note.type)}</span>
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
              <text fg={theme().textMuted} marginBottom={0}>
                <strong>Cross-References</strong>
              </text>
              <scrollbox
                ref={(el) => (scrollRef = el)}
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
                          {isSelected() ? <strong>{paddedRef}</strong> : paddedRef}
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
          fallback={<text fg={theme().textMuted}>Loading EGW Commentary...</text>}
        >
          <Show
            when={hasCommentary()}
            fallback={<text fg={theme().textMuted}>No EGW commentary found for this verse</text>}
          >
            <scrollbox
              ref={(el) => (commentaryScrollRef = el)}
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
                  const isSelected = () => index() === selectedCommentaryIndex();
                  return (
                    <box
                      id={`commentary-${index()}`}
                      flexDirection="column"
                      marginBottom={1}
                      backgroundColor={isSelected() ? theme().verseHighlight : undefined}
                      paddingLeft={1}
                      paddingRight={1}
                    >
                      <text fg={isSelected() ? theme().accent : theme().textMuted}>
                        {isSelected() ? <strong>{entry.refcode}</strong> : entry.refcode}
                      </text>
                      <text fg={theme().text} wrapMode="word">
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

      {/* Structure Page */}
      <Show when={currentPage() === 'structure'}>
        <Show
          when={!structureLoading()}
          fallback={<text fg={theme().textMuted}>Loading structural data...</text>}
        >
          <Show
            when={hasStructure()}
            fallback={<text fg={theme().textMuted}>No structural data available</text>}
          >
            <scrollbox
              ref={(el) => (structureScrollRef = el)}
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
              {/* Word Frequency */}
              <Show when={structureWords().length > 0}>
                <text fg={theme().textMuted} marginBottom={0}>
                  <strong>Word Frequency</strong>
                </text>
                <For each={structureWords()}>
                  {(entry, index) => {
                    const isSelected = () => index() === selectedStructureIndex();
                    const symbolic = entry.symbolicCount !== null;
                    return (
                      <text
                        id={`structure-${index()}`}
                        fg={
                          symbolic
                            ? theme().accent
                            : isSelected()
                              ? theme().text
                              : theme().textMuted
                        }
                      >
                        {isSelected() ? '▶ ' : '  '}
                        {entry.word.padEnd(20, ' ')} {String(entry.count).padStart(3, ' ')}x
                        {symbolic ? ` (${entry.symbolicCount})` : ''}
                      </text>
                    );
                  }}
                </For>
              </Show>

              {/* Strong's Entries for current verse */}
              <Show when={structureStrongs().length > 0}>
                <text fg={theme().textMuted} marginTop={1} marginBottom={0}>
                  <strong>Strong's (this verse)</strong>
                </text>
                <For each={structureStrongs()}>
                  {(entry, index) => {
                    const globalIdx = () => structureWords().length + index();
                    const isSelected = () => globalIdx() === selectedStructureIndex();
                    const lang = entry.number.startsWith('H') ? 'Heb' : 'Grk';
                    return (
                      <box
                        id={`structure-${globalIdx()}`}
                        flexDirection="column"
                        marginBottom={0}
                        backgroundColor={isSelected() ? theme().verseHighlight : undefined}
                        paddingLeft={1}
                      >
                        <text fg={isSelected() ? theme().accent : theme().textMuted}>
                          {entry.number} [{lang}] {entry.lemma} (
                          {entry.transliteration ?? entry.lemma})
                        </text>
                        <text fg={theme().text} wrapMode="word">
                          {entry.definition.slice(0, 120)}
                          {entry.definition.length > 120 ? '...' : ''}
                        </text>
                      </box>
                    );
                  }}
                </For>
              </Show>
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
          <Show when={currentPage() === 'structure' && hasStructure()}>
            <span style={{ fg: theme().accent }}>↑↓</span> scroll
            {'  '}
          </Show>
          <span style={{ fg: theme().accent }}>Esc</span> close
        </text>
      </box>
    </box>
  );
}
