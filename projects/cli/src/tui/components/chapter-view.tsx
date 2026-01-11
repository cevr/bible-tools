import { createEffect, createMemo, For, Show } from 'solid-js';
import type { ScrollBoxRenderable } from '@opentui/core';

import { useBibleData } from '../context/bible.js';
import { useNavigation } from '../context/navigation.js';
import { useDisplay } from '../context/display.js';
import { useTheme } from '../context/theme.js';
import { useSearch } from '../context/search.js';
import { Verse, VerseParagraph } from './verse.js';

export function ChapterView() {
  const { theme } = useTheme();
  const { position, selectedVerse, highlightedVerse } = useNavigation();
  const { mode } = useDisplay();
  const { query, matches, isActive } = useSearch();
  const data = useBibleData();

  // Get search match verse numbers for highlighting
  const searchMatchVerses = createMemo(() => {
    if (!isActive() || !query()) return [];
    return matches().map(m => m.verse);
  });

  let scrollRef: ScrollBoxRenderable | undefined;

  // Get verses for current chapter
  const verses = () => data.getChapter(position().book, position().chapter);

  // Find verse element and sync scroll position
  const syncScroll = (verseNum: number) => {
    if (!scrollRef) return false;

    const children = scrollRef.getChildren();
    const target = children.find((child) => child.id === `verse-${verseNum}`);
    if (!target) return false;

    const relativeY = target.y - scrollRef.y;
    const viewportHeight = scrollRef.height;

    // Scroll if verse is outside viewport
    if (relativeY < 0) {
      scrollRef.scrollBy(relativeY);
    } else if (relativeY + target.height > viewportHeight) {
      scrollRef.scrollBy(relativeY + target.height - viewportHeight);
    }
    return true;
  };

  // Retry sync until children are ready
  const syncScrollWithRetry = (verseNum: number, retries: number = 15) => {
    if (syncScroll(verseNum)) return;
    if (retries > 0) {
      setTimeout(() => syncScrollWithRetry(verseNum, retries - 1), 30);
    }
  };

  // Single effect: whenever selected verse changes, sync scroll
  // The verse number IS the source of truth - we just ensure it's visible
  createEffect(() => {
    const verse = selectedVerse();
    // Small delay to let render complete
    setTimeout(() => syncScrollWithRetry(verse), 10);
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
            <VerseParagraph
              verses={verses()}
              highlightedVerse={selectedVerse()}
              searchQuery={isActive() ? query() : undefined}
              searchMatchVerses={searchMatchVerses()}
            />
          }
        >
          <For each={verses()}>
            {(verse) => (
              <Verse
                id={`verse-${verse.verse}`}
                verse={verse}
                isHighlighted={selectedVerse() === verse.verse || highlightedVerse() === verse.verse}
                isSearchMatch={searchMatchVerses().includes(verse.verse)}
                searchQuery={isActive() ? query() : undefined}
              />
            )}
          </For>
        </Show>
      </scrollbox>
    </Show>
  );
}
