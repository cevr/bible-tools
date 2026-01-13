/**
 * EGW Chapter View
 *
 * Renders the current EGW book's paragraphs in a scrollable view.
 * Similar to the Bible's ChapterView but adapted for EGW structure.
 */

import type { ScrollBoxRenderable } from '@opentui/core';
import { For, Show } from 'solid-js';

import { useEGWNavigation } from '../context/egw-navigation.js';
import { useTheme } from '../context/theme.js';
import { useScrollSync } from '../hooks/use-scroll-sync.js';
import { EGWParagraphView } from './egw-paragraph.js';

export function EGWChapterView() {
  const { theme } = useTheme();
  const { loadingState, paragraphs, selectedParagraphIndex, currentBook } =
    useEGWNavigation();

  let scrollRef: ScrollBoxRenderable | undefined;

  // Sync scroll to selected paragraph
  useScrollSync(() => `para-${selectedParagraphIndex()}`, {
    getRef: () => scrollRef,
  });

  return (
    <Show
      when={loadingState()._tag === 'loaded' && paragraphs().length > 0}
      fallback={
        <box
          flexGrow={1}
          alignItems="center"
          justifyContent="center"
        >
          <Show
            when={loadingState()._tag === 'loading'}
            fallback={
              <Show
                when={loadingState()._tag === 'error'}
                fallback={
                  <text fg={theme().textMuted}>
                    {currentBook()
                      ? 'No paragraphs found'
                      : 'Select a book to begin reading'}
                  </text>
                }
              >
                <text fg={theme().error}>
                  Error:{' '}
                  {(loadingState() as { _tag: 'error'; error: string }).error}
                </text>
              </Show>
            }
          >
            <text fg={theme().textMuted}>
              {(loadingState() as { _tag: 'loading'; message: string }).message}
            </text>
          </Show>
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
        <For each={paragraphs()}>
          {(paragraph, index) => (
            <EGWParagraphView
              id={`para-${index()}`}
              paragraph={paragraph}
              isSelected={selectedParagraphIndex() === index()}
            />
          )}
        </For>
      </scrollbox>
    </Show>
  );
}
