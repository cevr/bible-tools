import { createEffect, createSignal, For, Show, onMount, batch } from 'solid-js';
import type { ScrollBoxRenderable, BoxRenderable } from '@opentui/core';

import { useBibleData } from '../context/bible.js';
import { useNavigation } from '../context/navigation.js';
import { useDisplay } from '../context/display.js';
import { useTheme } from '../context/theme.js';
import { Verse, VerseParagraph } from './verse.js';

export function ChapterView() {
  const { theme } = useTheme();
  const { position, selectedVerse, highlightedVerse } = useNavigation();
  const { mode } = useDisplay();
  const data = useBibleData();

  let scrollRef: ScrollBoxRenderable | undefined;
  const verseRefs = new Map<number, BoxRenderable>();

  // Track chapter changes
  const [lastChapter, setLastChapter] = createSignal(`${position().book}-${position().chapter}`);
  const [lastSelectedVerse, setLastSelectedVerse] = createSignal(selectedVerse());

  // Get verses for current chapter
  const verses = () => data.getChapter(position().book, position().chapter);

  // Calculate cumulative Y position of a verse by summing heights of previous verses
  const getVersePosition = (verseNum: number): { top: number; height: number } | null => {
    let top = 0;
    for (let i = 1; i < verseNum; i++) {
      const el = verseRefs.get(i);
      if (el) {
        top += el.height;
      }
    }
    const el = verseRefs.get(verseNum);
    if (!el) return null;
    return { top, height: el.height };
  };

  // Scroll to keep selected verse visible
  const scrollToVerse = (verse: number, center: boolean = false) => {
    if (!scrollRef) return;

    const versePos = getVersePosition(verse);
    if (!versePos) return;

    const viewportHeight = scrollRef.viewport?.height ?? 20;
    const scrollTop = scrollRef.scrollTop;
    const viewportBottom = scrollTop + viewportHeight;
    const verseTop = versePos.top;
    const verseBottom = verseTop + versePos.height;

    if (center) {
      // Center the verse in viewport
      const targetScroll = Math.max(0, verseTop - Math.floor((viewportHeight - versePos.height) / 2));
      scrollRef.scrollTo(targetScroll);
    } else if (verseTop < scrollTop) {
      // Verse is above viewport - scroll up to show it at top
      scrollRef.scrollTo(verseTop);
    } else if (verseBottom > viewportBottom) {
      // Verse is below viewport - scroll down to show it at bottom
      const targetScroll = verseBottom - viewportHeight;
      scrollRef.scrollTo(Math.max(0, targetScroll));
    }
  };

  // Scroll with retry for when refs aren't ready yet
  const scrollToVerseWithRetry = (verse: number, center: boolean, retries: number = 10) => {
    const verseElement = verseRefs.get(verse);
    if (verseElement && scrollRef) {
      scrollToVerse(verse, center);
    } else if (retries > 0) {
      setTimeout(() => scrollToVerseWithRetry(verse, center, retries - 1), 30);
    }
  };

  // Handle verse selection changes
  createEffect(() => {
    const pos = position();
    const chapterKey = `${pos.book}-${pos.chapter}`;
    const currentSelected = selectedVerse();
    const chapterChanged = chapterKey !== lastChapter();

    if (chapterChanged) {
      batch(() => {
        setLastChapter(chapterKey);
        setLastSelectedVerse(currentSelected);
      });
      // Clear verse refs when chapter changes
      verseRefs.clear();

      // Chapter changed - scroll to position after render
      if (currentSelected === 1) {
        // Scroll to top immediately
        setTimeout(() => scrollRef?.scrollTo(0), 50);
      } else {
        // Wait for refs to be populated, then center on verse
        scrollToVerseWithRetry(currentSelected, true);
      }
    } else if (currentSelected !== lastSelectedVerse()) {
      setLastSelectedVerse(currentSelected);
      // Verse changed within same chapter - scroll only if leaving viewport
      // Use a small delay to ensure the DOM has updated
      setTimeout(() => scrollToVerse(currentSelected, false), 10);
    }
  });

  // Handle goTo highlight (center the verse)
  createEffect(() => {
    const highlighted = highlightedVerse();
    if (highlighted) {
      setTimeout(() => {
        scrollToVerse(highlighted, true);
      }, 100);
    }
  });

  // Scroll to initial position on mount
  onMount(() => {
    const current = selectedVerse();
    if (current > 1) {
      scrollToVerseWithRetry(current, true);
    }
  });

  return (
    <Show
      when={verses().length > 0}
      fallback={
        <box flexGrow={1} alignItems="center" justifyContent="center">
          <text fg={theme().textMuted}>No verses found</text>
        </box>
      }
    >
      <scrollbox
        ref={scrollRef}
        focused={false}
        style={{
          flexGrow: 1,
          rootOptions: {
            backgroundColor: theme().background,
          },
          wrapperOptions: {
            backgroundColor: theme().background,
          },
          viewportOptions: {
            backgroundColor: theme().background,
          },
          contentOptions: {
            backgroundColor: theme().background,
            paddingTop: 1,
            paddingBottom: 1,
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
        <Show
          when={mode() === 'verse'}
          fallback={
            <VerseParagraph verses={verses()} highlightedVerse={selectedVerse()} />
          }
        >
          <For each={verses()}>
            {(verse) => (
              <Verse
                ref={(el) => verseRefs.set(verse.verse, el)}
                verse={verse}
                isHighlighted={selectedVerse() === verse.verse || highlightedVerse() === verse.verse}
              />
            )}
          </For>
        </Show>
      </scrollbox>
    </Show>
  );
}
