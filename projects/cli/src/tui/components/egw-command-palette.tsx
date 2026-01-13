/**
 * EGW Command Palette
 *
 * A tiered command palette for EGW navigation.
 * - Books → Chapters → Paragraphs
 * - Press left/right to navigate between tiers
 * - Press Enter to select, Esc to close
 * - Search to filter results
 */

import type { EGWBookInfo, EGWParagraph } from '@bible/core/egw-reader';
import type { ScrollBoxRenderable } from '@opentui/core';
import { useKeyboard } from '@opentui/solid';
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onMount,
  Show,
} from 'solid-js';

import { useEGWNavigation } from '../context/egw-navigation.js';
import { useTheme } from '../context/theme.js';
import { useScrollSync } from '../hooks/use-scroll-sync.js';

interface EGWCommandPaletteProps {
  onClose: () => void;
}

type PaletteMode = 'books' | 'chapters' | 'paragraphs';

interface ChapterInfo {
  title: string;
  paragraphIndex: number;
  elementType: string;
}

// Strip HTML from content
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

export function EGWCommandPalette(props: EGWCommandPaletteProps) {
  const { theme } = useTheme();
  const {
    books,
    loadBooks,
    currentBook,
    paragraphs,
    goToBook,
    goToParagraphIndex,
    loadingState,
    selectedParagraphIndex,
  } = useEGWNavigation();

  const [query, setQuery] = createSignal('');
  const [selectedIndex, setSelectedIndex] = createSignal(0);

  // Default to chapters if in a book, otherwise books
  const [mode, setMode] = createSignal<PaletteMode>(
    currentBook() ? 'chapters' : 'books',
  );
  const [selectedChapterIndex, setSelectedChapterIndex] = createSignal(0);

  let scrollRef: ScrollBoxRenderable | undefined;

  // Scroll sync - keep selected item visible
  useScrollSync(() => `item-${selectedIndex()}`, { getRef: () => scrollRef });

  // Extract chapters from paragraphs
  const chapters = createMemo((): ChapterInfo[] => {
    const paras = paragraphs();
    const result: ChapterInfo[] = [];

    for (let i = 0; i < paras.length; i++) {
      const para = paras[i]!;
      const type = para.elementType;
      if (type === 'chapter' || type === 'heading' || type === 'title') {
        const title = stripHtml(para.content ?? '').slice(0, 60);
        result.push({
          title: title || `Chapter ${result.length + 1}`,
          paragraphIndex: i,
          elementType: type,
        });
      }
    }
    return result;
  });

  // Get paragraphs for selected chapter (from chapter heading to next chapter or end)
  const chapterParagraphs = createMemo(
    (): { para: EGWParagraph; index: number }[] => {
      const chaps = chapters();
      const chapterIdx = selectedChapterIndex();
      if (chapterIdx < 0 || chapterIdx >= chaps.length) return [];

      const chapter = chaps[chapterIdx]!;
      const startIdx = chapter.paragraphIndex;
      const nextChapter = chaps[chapterIdx + 1];
      const endIdx = nextChapter
        ? nextChapter.paragraphIndex
        : paragraphs().length;

      const paras = paragraphs();
      const result: { para: EGWParagraph; index: number }[] = [];
      for (let i = startIdx; i < endIdx; i++) {
        result.push({ para: paras[i]!, index: i });
      }
      return result;
    },
  );

  // Load books on mount if not loaded
  onMount(() => {
    if (books().length === 0) {
      loadBooks();
    }
  });

  // Filter books based on query
  const filteredBooks = createMemo(() => {
    const q = query().toLowerCase();
    if (!q) return books();
    return books().filter(
      (book) =>
        book.title.toLowerCase().includes(q) ||
        book.bookCode.toLowerCase().includes(q),
    );
  });

  // Filter chapters based on query
  const filteredChapters = createMemo(() => {
    const q = query().toLowerCase();
    if (!q) return chapters();
    return chapters().filter((ch) => ch.title.toLowerCase().includes(q));
  });

  // Filter paragraphs based on query
  const filteredParagraphs = createMemo(() => {
    const q = query().toLowerCase();
    if (!q) return chapterParagraphs();
    return chapterParagraphs().filter((p) => {
      const content = stripHtml(p.para.content ?? '').toLowerCase();
      return content.includes(q);
    });
  });

  const currentItems = createMemo(() => {
    switch (mode()) {
      case 'books':
        return filteredBooks();
      case 'chapters':
        return filteredChapters();
      case 'paragraphs':
        return filteredParagraphs();
    }
  });

  // Reset selection when query or mode changes
  createEffect(() => {
    query();
    mode();
    setSelectedIndex(0);
  });

  // Handle selecting a book (enter chapters view)
  const handleSelectBook = (book: EGWBookInfo) => {
    // If this is the current book, switch to chapters
    if (currentBook()?.bookCode === book.bookCode) {
      setMode('chapters');
      setQuery('');
      setSelectedIndex(0);
    } else {
      // Load the book and close
      goToBook(book.bookCode);
      props.onClose();
    }
  };

  // Handle drilling into a book
  const handleDrillIntoBook = (book: EGWBookInfo) => {
    if (book.bookCode !== currentBook()?.bookCode) {
      goToBook(book.bookCode);
    }
    setMode('chapters');
    setQuery('');
    setSelectedIndex(0);
  };

  // Handle selecting a chapter (go to it)
  const handleSelectChapter = (chapter: ChapterInfo) => {
    goToParagraphIndex(chapter.paragraphIndex);
    props.onClose();
  };

  // Handle drilling into a chapter to see paragraphs
  const handleDrillIntoChapter = (chapterIdx: number) => {
    setSelectedChapterIndex(chapterIdx);
    setMode('paragraphs');
    setQuery('');
    setSelectedIndex(0);
  };

  // Handle selecting a paragraph
  const handleSelectParagraph = (paraIndex: number) => {
    goToParagraphIndex(paraIndex);
    props.onClose();
  };

  useKeyboard((key) => {
    if (key.name === 'escape') {
      props.onClose();
      return;
    }

    if (key.name === 'return') {
      if (mode() === 'books') {
        const book = filteredBooks()[selectedIndex()];
        if (book) {
          handleSelectBook(book);
        }
      } else if (mode() === 'chapters') {
        const chapter = filteredChapters()[selectedIndex()];
        if (chapter) {
          handleSelectChapter(chapter);
        }
      } else if (mode() === 'paragraphs') {
        const para = filteredParagraphs()[selectedIndex()];
        if (para) {
          handleSelectParagraph(para.index);
        }
      }
      return;
    }

    // Left to go back a tier
    if (key.name === 'left') {
      if (mode() === 'paragraphs') {
        setMode('chapters');
        setQuery('');
        setSelectedIndex(selectedChapterIndex());
      } else if (mode() === 'chapters') {
        setMode('books');
        setQuery('');
        // Select the current book in the list
        const currentBookCode = currentBook()?.bookCode;
        if (currentBookCode) {
          const idx = books().findIndex((b) => b.bookCode === currentBookCode);
          setSelectedIndex(idx >= 0 ? idx : 0);
        } else {
          setSelectedIndex(0);
        }
      }
      return;
    }

    // Right to drill into next tier
    if (key.name === 'right') {
      if (mode() === 'books') {
        const book = filteredBooks()[selectedIndex()];
        if (book) {
          handleDrillIntoBook(book);
        }
      } else if (mode() === 'chapters') {
        const chapterIdx = selectedIndex();
        if (chapterIdx < filteredChapters().length) {
          // Find the actual index in the full chapters list
          const chapter = filteredChapters()[chapterIdx];
          if (chapter) {
            const actualIdx = chapters().findIndex(
              (c) => c.paragraphIndex === chapter.paragraphIndex,
            );
            handleDrillIntoChapter(actualIdx >= 0 ? actualIdx : chapterIdx);
          }
        }
      }
      return;
    }

    if (key.name === 'up' || (key.ctrl && key.name === 'p')) {
      setSelectedIndex((i) => Math.max(0, i - 1));
      return;
    }

    if (key.name === 'down' || (key.ctrl && key.name === 'n')) {
      const maxIndex = currentItems().length - 1;
      setSelectedIndex((i) => Math.min(maxIndex, i + 1));
      return;
    }

    if (key.name === 'backspace') {
      setQuery((q) => q.slice(0, -1));
      return;
    }

    // Type characters into query
    if (key.sequence && key.sequence.length === 1 && !key.ctrl) {
      setQuery((q) => q + key.sequence);
    }
  });

  const isLoading = () => loadingState()._tag === 'loading';
  const hasError = () => loadingState()._tag === 'error';

  // Shared scrollbox style
  const scrollboxStyle = () => ({
    flexGrow: 1,
    maxHeight: 15,
    rootOptions: { backgroundColor: theme().backgroundPanel },
    wrapperOptions: { backgroundColor: theme().backgroundPanel },
    viewportOptions: { backgroundColor: theme().backgroundPanel },
    contentOptions: { backgroundColor: theme().backgroundPanel },
  });

  // Mode indicator text
  const getModeIndicator = () => {
    const book = currentBook();
    switch (mode()) {
      case 'books':
        return null;
      case 'chapters':
        return book ? ` (${book.bookCode})` : '';
      case 'paragraphs': {
        const chapter = chapters()[selectedChapterIndex()];
        const title = chapter?.title.slice(0, 20) ?? '';
        return book
          ? ` (${book.bookCode} - ${title}${title.length >= 20 ? '...' : ''})`
          : '';
      }
    }
  };

  return (
    <box
      flexDirection="column"
      border
      borderColor={theme().borderFocused}
      backgroundColor={theme().backgroundPanel}
      width={70}
      maxHeight={22}
    >
      {/* Mode indicator */}
      <box
        flexDirection="row"
        paddingLeft={1}
        paddingRight={1}
        marginBottom={0}
      >
        <text
          fg={mode() === 'books' ? theme().textHighlight : theme().textMuted}
        >
          <Show
            when={mode() === 'books'}
            fallback="Books"
          >
            <strong>Books</strong>
          </Show>
        </text>
        <text fg={theme().textMuted}> / </text>
        <text
          fg={mode() === 'chapters' ? theme().textHighlight : theme().textMuted}
        >
          <Show
            when={mode() === 'chapters'}
            fallback="Chapters"
          >
            <strong>Chapters</strong>
          </Show>
        </text>
        <text fg={theme().textMuted}> / </text>
        <text
          fg={
            mode() === 'paragraphs' ? theme().textHighlight : theme().textMuted
          }
        >
          <Show
            when={mode() === 'paragraphs'}
            fallback="Paragraphs"
          >
            <strong>Paragraphs</strong>
          </Show>
        </text>
        <text fg={theme().textMuted}>{getModeIndicator()}</text>
      </box>

      {/* Search input */}
      <box
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={theme().accent}>{'> '}</text>
        <text fg={theme().text}>{query()}</text>
        <text fg={theme().textMuted}>|</text>
      </box>

      {/* Content */}
      <Show
        when={!isLoading()}
        fallback={
          <box padding={1}>
            <text fg={theme().textMuted}>Loading...</text>
          </box>
        }
      >
        <Show
          when={!hasError()}
          fallback={
            <box padding={1}>
              <text fg={theme().error}>Error loading data</text>
            </box>
          }
        >
          {/* Books list */}
          <Show when={mode() === 'books'}>
            <scrollbox
              ref={scrollRef}
              focused={false}
              style={scrollboxStyle()}
            >
              <For each={filteredBooks().slice(0, 50)}>
                {(book, index) => (
                  <box
                    id={`item-${index()}`}
                    paddingLeft={1}
                    paddingRight={1}
                    backgroundColor={
                      index() === selectedIndex() ? theme().accent : undefined
                    }
                  >
                    <text
                      fg={
                        index() === selectedIndex()
                          ? theme().background
                          : theme().text
                      }
                    >
                      <span
                        style={{
                          fg:
                            index() === selectedIndex()
                              ? theme().background
                              : theme().textMuted,
                        }}
                      >
                        [{book.bookCode}]
                      </span>{' '}
                      {book.title}
                      <Show when={book.bookCode === currentBook()?.bookCode}>
                        <span
                          style={{
                            fg:
                              index() === selectedIndex()
                                ? theme().background
                                : theme().accent,
                          }}
                        >
                          {' '}
                          ●
                        </span>
                      </Show>
                    </text>
                  </box>
                )}
              </For>
              <Show when={filteredBooks().length === 0}>
                <box padding={1}>
                  <text fg={theme().textMuted}>No books found</text>
                </box>
              </Show>
            </scrollbox>
          </Show>

          {/* Chapters list */}
          <Show when={mode() === 'chapters'}>
            <scrollbox
              ref={scrollRef}
              focused={false}
              style={scrollboxStyle()}
            >
              <For each={filteredChapters().slice(0, 50)}>
                {(chapter, index) => (
                  <box
                    id={`item-${index()}`}
                    paddingLeft={1}
                    paddingRight={1}
                    backgroundColor={
                      index() === selectedIndex() ? theme().accent : undefined
                    }
                  >
                    <text
                      fg={
                        index() === selectedIndex()
                          ? theme().background
                          : theme().text
                      }
                    >
                      <span
                        style={{
                          fg:
                            index() === selectedIndex()
                              ? theme().background
                              : theme().textMuted,
                        }}
                      >
                        {chapter.elementType === 'title' ? '§' : ''}
                        {chapter.elementType === 'chapter' ? '◆' : ''}
                        {chapter.elementType === 'heading' ? '•' : ''}
                      </span>{' '}
                      {chapter.title}
                    </text>
                  </box>
                )}
              </For>
              <Show when={filteredChapters().length === 0}>
                <box padding={1}>
                  <text fg={theme().textMuted}>
                    {currentBook() ? 'No chapters found' : 'No book selected'}
                  </text>
                </box>
              </Show>
            </scrollbox>
          </Show>

          {/* Paragraphs list */}
          <Show when={mode() === 'paragraphs'}>
            <scrollbox
              ref={scrollRef}
              focused={false}
              style={scrollboxStyle()}
            >
              <For each={filteredParagraphs().slice(0, 50)}>
                {(item, index) => {
                  const isSelected = () => index() === selectedIndex();
                  const isCurrent = item.index === selectedParagraphIndex();
                  const content = stripHtml(item.para.content ?? '').slice(
                    0,
                    55,
                  );
                  const refcode = item.para.refcodeShort ?? '';

                  return (
                    <box
                      id={`item-${index()}`}
                      paddingLeft={1}
                      paddingRight={1}
                      backgroundColor={
                        isSelected() ? theme().accent : undefined
                      }
                    >
                      <text
                        fg={isSelected() ? theme().background : theme().text}
                      >
                        <span
                          style={{
                            fg: isSelected()
                              ? theme().background
                              : isCurrent
                                ? theme().accent
                                : theme().textMuted,
                          }}
                        >
                          {refcode.padEnd(12, ' ')}
                        </span>{' '}
                        <span
                          style={{
                            fg: isSelected()
                              ? theme().background
                              : theme().textMuted,
                          }}
                        >
                          {content}
                          {content.length >= 55 ? '...' : ''}
                        </span>
                      </text>
                    </box>
                  );
                }}
              </For>
              <Show when={filteredParagraphs().length === 0}>
                <box padding={1}>
                  <text fg={theme().textMuted}>No paragraphs found</text>
                </box>
              </Show>
            </scrollbox>
          </Show>
        </Show>
      </Show>

      {/* Footer */}
      <box
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={theme().textMuted}>
          <span style={{ fg: theme().accent }}>Enter</span> select{'  '}
          <span style={{ fg: theme().accent }}>←/→</span> navigate{'  '}
          <span style={{ fg: theme().accent }}>Esc</span> close{'  '}
          {currentItems().length} items
        </text>
      </box>
    </box>
  );
}
