import type { Component, ParentProps } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { createSignal, createEffect, createMemo, For, Show, onMount } from 'solid-js';
import { useKeyboardAction } from '@/providers/keyboard-provider';
import { useOverlay } from '@/providers/overlay-provider';
import { useBible, useChapter } from '@/providers/bible-provider';
import { useAppState } from '@/providers/state-provider';
import { BOOK_ALIASES, type Verse } from '@/data/bible';

/**
 * Bible reader route.
 * Displays chapter content with verse navigation.
 */
const BibleRoute: Component<ParentProps> = () => {
  const params = useParams<{ book?: string; chapter?: string; verse?: string }>();
  const navigate = useNavigate();
  const bible = useBible();
  const { openOverlay } = useOverlay();
  const appState = useAppState();

  // Parse book name to number
  const bookNumber = createMemo(() => {
    const bookParam = params.book?.toLowerCase();
    if (!bookParam) return 1; // Default to Genesis

    // Check if it's a number
    const num = parseInt(bookParam, 10);
    if (!isNaN(num) && num >= 1 && num <= 66) return num;

    // Check aliases
    const aliasNum = BOOK_ALIASES[bookParam];
    if (aliasNum) return aliasNum;

    // Try to find by name
    const book = bible.books.find(
      (b) => b.name.toLowerCase() === bookParam
    );
    return book?.number ?? 1;
  });

  const chapterNumber = createMemo(() => {
    const ch = parseInt(params.chapter ?? '1', 10);
    return isNaN(ch) ? 1 : ch;
  });

  // Get book and chapter data
  const book = createMemo(() => bible.getBook(bookNumber()));

  // Use createResource for chapter verses (async)
  const verses = useChapter(bookNumber, chapterNumber);

  // Selected verse state
  const [selectedVerse, setSelectedVerse] = createSignal(
    params.verse ? parseInt(params.verse, 10) : 1
  );

  // Update selected verse when URL changes
  createEffect(() => {
    if (params.verse) {
      setSelectedVerse(parseInt(params.verse, 10));
    } else {
      setSelectedVerse(1);
    }
  });

  // Redirect to saved position or default book/chapter if needed
  onMount(() => {
    if (!params.book) {
      // Restore saved position
      const savedPos = appState.getPosition();
      const savedBook = bible.getBook(savedPos.book);
      if (savedBook) {
        const bookSlug = savedBook.name.toLowerCase().replace(/\s+/g, '-');
        navigate(`/bible/${bookSlug}/${savedPos.chapter}/${savedPos.verse}`, { replace: true });
      } else {
        navigate('/bible/genesis/1', { replace: true });
      }
    } else if (!params.chapter) {
      const bookName = book()?.name.toLowerCase().replace(/\s+/g, '-') ?? 'genesis';
      navigate(`/bible/${bookName}/1`, { replace: true });
    }
  });

  // Save position when it changes
  createEffect(() => {
    const b = bookNumber();
    const c = chapterNumber();
    const v = selectedVerse();
    if (b && c && v) {
      appState.setPosition({ book: b, chapter: c, verse: v });
      appState.addToHistory({ book: b, chapter: c, verse: v });
    }
  });

  // Scroll selected verse into view
  createEffect(() => {
    const verse = selectedVerse();
    const el = document.querySelector(`[data-verse="${verse}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  // Handle keyboard navigation
  useKeyboardAction((action) => {
    switch (action) {
      case 'nextVerse': {
        const v = verses();
        const max = v?.length ?? 0;
        setSelectedVerse((v) => Math.min(v + 1, max));
        break;
      }
      case 'prevVerse':
        setSelectedVerse((v) => Math.max(1, v - 1));
        break;
      case 'nextChapter': {
        const next = bible.getNextChapter(bookNumber(), chapterNumber());
        if (next) {
          const nextBook = bible.getBook(next.book);
          if (nextBook) {
            const bookSlug = nextBook.name.toLowerCase().replace(/\s+/g, '-');
            navigate(`/bible/${bookSlug}/${next.chapter}`);
          }
        }
        break;
      }
      case 'prevChapter': {
        const prev = bible.getPrevChapter(bookNumber(), chapterNumber());
        if (prev) {
          const prevBook = bible.getBook(prev.book);
          if (prevBook) {
            const bookSlug = prevBook.name.toLowerCase().replace(/\s+/g, '-');
            navigate(`/bible/${bookSlug}/${prev.chapter}`);
          }
        }
        break;
      }
      case 'openCrossRefs':
        openOverlay('cross-refs', {
          book: bookNumber(),
          chapter: chapterNumber(),
          verse: selectedVerse(),
        });
        break;
    }
  });

  // Loading state
  if (!params.book || !params.chapter) {
    return null;
  }

  return (
    <div class="space-y-6">
      {/* Topbar */}
      <header class="border-b border-[--color-border] dark:border-[--color-border-dark] pb-4">
        <h1 class="font-sans text-2xl font-semibold text-[--color-ink] dark:text-[--color-ink-dark]">
          {book()?.name} {chapterNumber()}
        </h1>
        <p class="mt-1 text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
          Press{' '}
          <kbd class="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1.5 py-0.5 text-xs">
            ⌘K
          </kbd>{' '}
          for command palette
        </p>
      </header>

      {/* Chapter content */}
      <div class="reading-text space-y-3">
        <Show when={verses.loading}>
          <p class="text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] italic">
            Loading verses...
          </p>
        </Show>
        <Show when={verses.error}>
          <p class="text-red-600 dark:text-red-400">
            Failed to load verses: {String(verses.error)}
          </p>
        </Show>
        <Show
          when={!verses.loading && !verses.error && verses()}
        >
          {(loadedVerses) => (
            <Show
              when={loadedVerses().length > 0}
              fallback={
                <p class="text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] italic">
                  No verses found for this chapter.
                </p>
              }
            >
              <For each={loadedVerses()}>
                {(verse) => (
                  <VerseDisplay
                    verse={verse}
                    isSelected={selectedVerse() === verse.verse}
                    onClick={() => setSelectedVerse(verse.verse)}
                  />
                )}
              </For>
            </Show>
          )}
        </Show>
      </div>

      {/* Footer */}
      <footer class="border-t border-[--color-border] dark:border-[--color-border-dark] pt-4 text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <span>
            {book()?.name} {chapterNumber()}:{selectedVerse()}
          </span>
          <div class="flex gap-4 flex-wrap">
            <span>
              <kbd class="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1 text-xs">
                ↑↓
              </kbd>{' '}
              verse
            </span>
            <span>
              <kbd class="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1 text-xs">
                ←→
              </kbd>{' '}
              chapter
            </span>
            <span>
              <kbd class="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1 text-xs">
                Enter
              </kbd>{' '}
              cross-refs
            </span>
            <span>
              <kbd class="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1 text-xs">
                ⌘G
              </kbd>{' '}
              go to
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

/**
 * Individual verse display component
 */
const VerseDisplay: Component<{
  verse: Verse;
  isSelected: boolean;
  onClick: () => void;
}> = (props) => {
  return (
    <p
      data-verse={props.verse.verse}
      class="cursor-pointer rounded px-2 py-1 transition-colors duration-100"
      classList={{
        'bg-[--color-highlight] dark:bg-[--color-highlight-dark]':
          props.isSelected,
        'hover:bg-[--color-highlight]/50 dark:hover:bg-[--color-highlight-dark]/50':
          !props.isSelected,
      }}
      onClick={props.onClick}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          props.onClick();
        }
      }}
    >
      <span class="verse-num">{props.verse.verse}</span>
      <span>{props.verse.text}</span>
    </p>
  );
};

export default BibleRoute;
