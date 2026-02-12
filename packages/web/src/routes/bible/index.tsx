import type { Component, ParentProps } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import {
  createSignal,
  createEffect,
  createMemo,
  createResource,
  For,
  Match,
  Show,
  Switch,
  onMount,
  onCleanup,
} from 'solid-js';
import { useKeyboardAction } from '@/providers/keyboard-provider';
import { useOverlay } from '@/providers/overlay-provider';
import { useBible, useChapter } from '@/providers/bible-provider';
import { useAppState, type Preferences } from '@/providers/state-provider';
import { useStudyData } from '@/providers/study-hooks';
import { BOOK_ALIASES, type Verse } from '@/data/bible';
import type { MarginNote, VerseWord } from '@/data/study/service';
import { VerseRenderer } from '@/components/bible/verse-renderer';
import { ParagraphView } from '@/components/bible/paragraph-view';
import { WordModeView } from '@/components/bible/word-mode-view';
import { StrongsPopup } from '@/components/study/strongs-popup';
import { GotoModeState, gotoModeTransition, keyToGotoEvent } from '@/lib/goto-mode';

/**
 * Bible reader route.
 * Displays chapter content with verse navigation.
 */
const BibleRoute: Component<ParentProps> = () => {
  console.log('[bible-route] render');
  const params = useParams<{ book?: string; chapter?: string; verse?: string }>();
  const navigate = useNavigate();
  const bible = useBible();
  const { overlay, openOverlay } = useOverlay();
  const appState = useAppState();
  const studyData = useStudyData();

  // Parse book name to number
  const bookNumber = createMemo(() => {
    const bookParam = params.book?.toLowerCase();
    if (!bookParam) return 1;
    const num = parseInt(bookParam, 10);
    if (!isNaN(num) && num >= 1 && num <= 66) return num;
    const aliasNum = BOOK_ALIASES[bookParam];
    if (aliasNum) return aliasNum;
    const book = bible.books.find((b) => b.name.toLowerCase() === bookParam);
    return book?.number ?? 1;
  });

  const chapterNumber = createMemo(() => {
    const ch = parseInt(params.chapter ?? '1', 10);
    return isNaN(ch) ? 1 : ch;
  });

  const book = createMemo(() => bible.getBook(bookNumber()));
  const verses = useChapter(bookNumber, chapterNumber);

  // Batch-load margin notes for the whole chapter
  const [marginNotesByVerse] = createResource(
    () => ({ book: bookNumber(), chapter: chapterNumber() }),
    async ({ book, chapter }) => studyData.getChapterMarginNotes(book, chapter),
  );

  // Display mode
  const [displayMode, setDisplayMode] = createSignal<Preferences['displayMode']>('verse');

  onMount(async () => {
    const prefs = await appState.getPreferences();
    setDisplayMode(prefs.displayMode);
  });

  const toggleDisplayMode = () => {
    const next = displayMode() === 'verse' ? 'paragraph' : 'verse';
    setDisplayMode(next);
    void appState.setPreferences({ displayMode: next });
  };

  // Selected verse
  const [selectedVerse, setSelectedVerse] = createSignal(
    params.verse ? parseInt(params.verse, 10) : 1,
  );

  // Search query — persists after overlay closes
  const [searchQuery, setSearchQuery] = createSignal('');

  // Goto mode state machine
  const [gotoState, setGotoState] = createSignal(GotoModeState.normal());
  let gotoTimeoutId: ReturnType<typeof setTimeout> | undefined;

  // Word mode state
  const [wordModeActive, setWordModeActive] = createSignal(false);
  const [selectedWordIndex, setSelectedWordIndex] = createSignal(0);
  const [activeStrongsNumber, setActiveStrongsNumber] = createSignal<string | null>(null);

  // Load verse words on demand when word mode activates
  const [verseWords] = createResource(
    () => {
      if (!wordModeActive()) return null;
      return { book: bookNumber(), chapter: chapterNumber(), verse: selectedVerse() };
    },
    async (params) => {
      if (!params) return [];
      return studyData.getVerseWords(params.book, params.chapter, params.verse);
    },
  );

  // Exit word mode when selected verse changes
  createEffect(() => {
    selectedVerse(); // track
    setWordModeActive(false);
    setSelectedWordIndex(0);
  });

  // Search match verse numbers for n/N navigation
  const searchMatchVerses = createMemo(() => {
    const q = searchQuery().toLowerCase();
    if (q.length < 2) return [];
    const v = verses();
    if (!v) return [];
    return v.filter((verse) => verse.text.toLowerCase().includes(q)).map((verse) => verse.verse);
  });

  // Update selected verse when URL changes
  createEffect(() => {
    if (params.verse) {
      setSelectedVerse(parseInt(params.verse, 10));
    } else {
      setSelectedVerse(1);
    }
  });

  // Redirect to saved position
  onMount(async () => {
    if (!params.book) {
      const savedPos = await appState.getPosition();
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

  // Save position
  createEffect(() => {
    const b = bookNumber();
    const c = chapterNumber();
    const v = selectedVerse();
    if (b && c && v) {
      void appState.setPosition({ book: b, chapter: c, verse: v });
      void appState.addToHistory({ book: b, chapter: c, verse: v });
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

  // n/N search navigation
  const goToNextMatch = (forward: boolean) => {
    const matches = searchMatchVerses();
    if (matches.length === 0) return;
    const current = selectedVerse();
    if (forward) {
      const next = matches.find((v) => v > current) ?? matches[0];
      if (next != null) setSelectedVerse(next);
    } else {
      const prev = [...matches].reverse().find((v) => v < current) ?? matches[matches.length - 1];
      if (prev != null) setSelectedVerse(prev);
    }
  };

  // Raw keydown handler for goto mode, search nav, and word mode
  const handleRawKeyDown = (event: KeyboardEvent) => {
    if (overlay() !== 'none') return;
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    // Word mode keyboard handling
    if (wordModeActive()) {
      const words = verseWords() ?? [];
      switch (event.key) {
        case 'ArrowLeft':
        case 'h':
          event.preventDefault();
          event.stopPropagation();
          setSelectedWordIndex((i) => Math.max(0, i - 1));
          return;
        case 'ArrowRight':
        case 'l':
          event.preventDefault();
          event.stopPropagation();
          setSelectedWordIndex((i) => Math.min(words.length - 1, i + 1));
          return;
        case ' ':
        case 'Enter': {
          event.preventDefault();
          event.stopPropagation();
          const word = words[selectedWordIndex()];
          if (word?.strongsNumbers?.length) {
            setActiveStrongsNumber(word.strongsNumbers[0] ?? null);
          }
          return;
        }
        case 'Escape':
        case 'w':
          event.preventDefault();
          event.stopPropagation();
          setWordModeActive(false);
          return;
      }
      // Don't let other keys leak while in word mode
      return;
    }

    // 'w' to enter word mode (only in verse display mode)
    if (
      event.key === 'w' &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      displayMode() === 'verse'
    ) {
      event.preventDefault();
      event.stopPropagation();
      setWordModeActive(true);
      setSelectedWordIndex(0);
      return;
    }

    // Escape clears active search or exits word mode
    if (event.key === 'Escape' && searchQuery().length >= 2) {
      event.preventDefault();
      event.stopPropagation();
      setSearchQuery('');
      return;
    }

    // n/N for search navigation
    if (searchQuery().length >= 2 && !event.metaKey && !event.ctrlKey) {
      if (event.key === 'n' && !event.shiftKey) {
        event.preventDefault();
        goToNextMatch(true);
        return;
      }
      if (event.key === 'N' && event.shiftKey) {
        event.preventDefault();
        goToNextMatch(false);
        return;
      }
    }

    // Goto mode
    const gotoEvent = keyToGotoEvent(event);
    const current = gotoState();

    if (
      current._tag === 'normal' &&
      gotoEvent._tag !== 'pressG' &&
      gotoEvent._tag !== 'pressShiftG'
    ) {
      return;
    }

    if (
      current._tag === 'awaiting' ||
      gotoEvent._tag === 'pressG' ||
      gotoEvent._tag === 'pressShiftG'
    ) {
      event.preventDefault();
      event.stopPropagation();

      const { state: nextState, action } = gotoModeTransition(current, gotoEvent);
      setGotoState(nextState);

      if (gotoTimeoutId !== undefined) clearTimeout(gotoTimeoutId);
      if (nextState._tag === 'awaiting') {
        gotoTimeoutId = setTimeout(() => setGotoState(GotoModeState.normal()), 2000);
      }

      if (action) {
        const v = verses();
        const max = v?.length ?? 0;
        switch (action._tag) {
          case 'goToFirst':
            setSelectedVerse(1);
            break;
          case 'goToLast':
            setSelectedVerse(max);
            break;
          case 'goToVerse':
            setSelectedVerse(Math.max(1, Math.min(action.verse, max)));
            break;
        }
      }
    }
  };

  onMount(() => {
    window.addEventListener('keydown', handleRawKeyDown, true);
  });

  onCleanup(() => {
    window.removeEventListener('keydown', handleRawKeyDown, true);
    if (gotoTimeoutId !== undefined) clearTimeout(gotoTimeoutId);
  });

  // Handle keyboard navigation (parsed actions from keyboard provider)
  useKeyboardAction((action) => {
    // Skip verse navigation when word mode is active
    if (wordModeActive() && (action === 'nextVerse' || action === 'prevVerse')) return;

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
      case 'openSearch':
        openOverlay('search', {
          query: searchQuery(),
          onSearch: (q: string) => setSearchQuery(q),
        });
        break;
      case 'openBookmarks':
        openOverlay('bookmarks', {
          book: bookNumber(),
          chapter: chapterNumber(),
          verse: selectedVerse(),
        });
        break;
      case 'toggleDisplayMode':
        toggleDisplayMode();
        break;
    }
  });

  return (
    <Show when={params.book && params.chapter} fallback={null}>
      <div class="space-y-6">
        {/* Header */}
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
        <div class={displayMode() === 'verse' ? 'reading-text space-y-3' : ''}>
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
          <Show when={!verses.loading && !verses.error && verses()}>
            {(loadedVerses) => (
              <Show
                when={loadedVerses().length > 0}
                fallback={
                  <p class="text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] italic">
                    No verses found for this chapter.
                  </p>
                }
              >
                <Switch>
                  <Match when={displayMode() === 'paragraph'}>
                    <ParagraphView
                      verses={loadedVerses()}
                      selectedVerse={selectedVerse()}
                      marginNotesByVerse={marginNotesByVerse()}
                      searchQuery={searchQuery()}
                      onVerseClick={setSelectedVerse}
                    />
                  </Match>
                  <Match when={displayMode() === 'verse'}>
                    <For each={loadedVerses()}>
                      {(verse) => (
                        <VerseDisplay
                          verse={verse}
                          isSelected={selectedVerse() === verse.verse}
                          marginNotes={marginNotesByVerse()?.get(verse.verse)}
                          searchQuery={searchQuery()}
                          wordModeActive={wordModeActive() && selectedVerse() === verse.verse}
                          words={
                            wordModeActive() && selectedVerse() === verse.verse
                              ? (verseWords() ?? [])
                              : []
                          }
                          selectedWordIndex={selectedWordIndex()}
                          onSelectWord={setSelectedWordIndex}
                          onOpenStrongs={(num) => setActiveStrongsNumber(num)}
                          onClick={() => setSelectedVerse(verse.verse)}
                        />
                      )}
                    </For>
                  </Match>
                </Switch>
              </Show>
            )}
          </Show>
        </div>

        {/* Strong's popup */}
        <StrongsPopup
          strongsNumber={activeStrongsNumber()}
          onClose={() => setActiveStrongsNumber(null)}
        />

        {/* Footer */}
        <footer class="border-t border-[--color-border] dark:border-[--color-border-dark] pt-4 text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <span class="flex items-center gap-2">
              <button
                class="text-xs px-1.5 py-0.5 rounded bg-[--color-border] dark:bg-[--color-border-dark] hover:bg-[--color-accent]/20 dark:hover:bg-[--color-accent-dark]/20 transition-colors"
                onClick={toggleDisplayMode}
                title={`Switch to ${displayMode() === 'verse' ? 'paragraph' : 'verse'} mode (⌘D)`}
                aria-live="polite"
              >
                {displayMode() === 'verse' ? '☰' : '¶'}
              </button>
              {book()?.name} {chapterNumber()}:{selectedVerse()}
              {/* Word mode indicator */}
              <Show when={wordModeActive()}>
                <span class="text-xs px-1.5 py-0.5 rounded bg-[--color-accent]/20 dark:bg-[--color-accent-dark]/20 text-[--color-accent] dark:text-[--color-accent-dark] font-medium">
                  word
                </span>
              </Show>
              {/* Goto mode indicator */}
              <Show when={gotoState()._tag === 'awaiting'}>
                <span class="text-xs px-1.5 py-0.5 rounded bg-[--color-accent]/20 dark:bg-[--color-accent-dark]/20 text-[--color-accent] dark:text-[--color-accent-dark] font-mono">
                  g{(gotoState() as { digits: string }).digits}…
                </span>
              </Show>
              {/* Search query indicator */}
              <Show when={searchQuery().length >= 2}>
                <button
                  class="text-xs px-1.5 py-0.5 rounded bg-[--color-highlight] dark:bg-[--color-highlight-dark] text-[--color-ink] dark:text-[--color-ink-dark] hover:opacity-70 transition-opacity"
                  onClick={() => setSearchQuery('')}
                  title="Clear search (click to dismiss)"
                >
                  /{searchQuery()}/<span class="ml-1 opacity-60">{searchMatchVerses().length}</span>
                </button>
              </Show>
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
                  w
                </kbd>{' '}
                words
              </span>
              <span>
                <kbd class="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1 text-xs">
                  ⌘D
                </kbd>{' '}
                mode
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
    </Show>
  );
};

/**
 * Individual verse display with rich text or word mode rendering.
 */
const VerseDisplay: Component<{
  verse: Verse;
  isSelected: boolean;
  marginNotes?: MarginNote[];
  searchQuery?: string;
  wordModeActive?: boolean;
  words?: VerseWord[];
  selectedWordIndex?: number;
  onSelectWord?: (index: number) => void;
  onOpenStrongs?: (num: string) => void;
  onClick: () => void;
}> = (props) => {
  return (
    <p
      data-verse={props.verse.verse}
      class="cursor-pointer rounded px-2 py-1 transition-colors duration-100"
      classList={{
        'bg-[--color-highlight] dark:bg-[--color-highlight-dark]': props.isSelected,
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
      <Show
        when={props.wordModeActive && props.words && props.words.length > 0}
        fallback={
          <VerseRenderer
            text={props.verse.text}
            marginNotes={props.marginNotes}
            searchQuery={props.searchQuery}
          />
        }
      >
        <WordModeView
          words={props.words ?? []}
          selectedIndex={props.selectedWordIndex ?? 0}
          onSelectWord={(i) => props.onSelectWord?.(i)}
          onOpenStrongs={(num) => props.onOpenStrongs?.(num)}
        />
      </Show>
    </p>
  );
};

export default BibleRoute;
