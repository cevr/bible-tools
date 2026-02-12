/**
 * EGW reader route.
 *
 * Three states based on URL params:
 * 1. No bookCode → Book list (fetched from API)
 * 2. bookCode, no page → Redirect to page 1
 * 3. bookCode + page → Page reader view
 */
import type { Component } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import {
  createSignal,
  createEffect,
  createResource,
  createMemo,
  For,
  Show,
  onMount,
  onCleanup,
} from 'solid-js';
import { useKeyboardAction } from '@/providers/keyboard-provider';
import { useOverlay } from '@/providers/overlay-provider';
import {
  fetchEgwBooks,
  fetchEgwPage,
  fetchEgwChapters,
  type EGWBookInfo,
  type EGWChapter,
  type EGWParagraph,
} from '@/data/egw/api';
import { isChapterHeading } from '@bible/core/egw-db';
import { PageView } from '@/components/egw/page-view';
import { BibleRefsPopup } from '@/components/egw/bible-refs-popup';

// ---------------------------------------------------------------------------
// Route component
// ---------------------------------------------------------------------------

const EgwRoute: Component = () => {
  const params = useParams<{ bookCode?: string; page?: string }>();
  const navigate = useNavigate();

  // Redirect to page 1 when bookCode present but no page
  createEffect(() => {
    if (params.bookCode && !params.page) {
      navigate(`/egw/${params.bookCode}/1`, { replace: true });
    }
  });

  return (
    <Show
      when={params.bookCode && params.page}
      fallback={
        <Show when={!params.bookCode}>
          <BookListView />
        </Show>
      }
    >
      <PageReaderView />
    </Show>
  );
};

// ---------------------------------------------------------------------------
// Book list view
// ---------------------------------------------------------------------------

const BookListView: Component = () => {
  const [books] = createResource(fetchEgwBooks);

  return (
    <div class="space-y-6">
      <header class="border-b border-[--color-border] dark:border-[--color-border-dark] pb-4">
        <h1 class="font-sans text-2xl font-semibold text-[--color-ink] dark:text-[--color-ink-dark]">
          Ellen G. White Writings
        </h1>
        <p class="mt-1 text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
          Select a book to begin reading
        </p>
      </header>

      <Show when={books.loading}>
        <p class="text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] italic">
          Loading books...
        </p>
      </Show>

      <Show when={books.error}>
        <div class="rounded-lg border border-[--color-border] dark:border-[--color-border-dark] bg-[--color-highlight]/30 dark:bg-[--color-highlight-dark]/30 p-4">
          <p class="text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
            No books available. Run{' '}
            <code class="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1 text-xs">
              bible egw sync
            </code>{' '}
            on the server to download books.
          </p>
        </div>
      </Show>

      <Show when={!books.loading && !books.error && books()}>
        {(loadedBooks) => (
          <Show
            when={loadedBooks().length > 0}
            fallback={
              <div class="rounded-lg border border-[--color-border] dark:border-[--color-border-dark] bg-[--color-highlight]/30 dark:bg-[--color-highlight-dark]/30 p-4">
                <p class="text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                  No books synced. Run{' '}
                  <code class="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1 text-xs">
                    bible egw sync
                  </code>{' '}
                  on the server.
                </p>
              </div>
            }
          >
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <For each={loadedBooks()}>
                {(book: EGWBookInfo) => (
                  <a
                    href={`/egw/${book.bookCode}`}
                    class="group rounded-lg border border-[--color-border] dark:border-[--color-border-dark] p-4 transition-colors hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark]"
                  >
                    <div class="font-sans font-semibold text-[--color-ink] dark:text-[--color-ink-dark] group-hover:text-[--color-accent] dark:group-hover:text-[--color-accent-dark]">
                      {book.bookCode}
                    </div>
                    <div class="mt-1 text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                      {book.title}
                    </div>
                    <div class="mt-1 text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] opacity-60">
                      {book.author}
                      <Show when={book.paragraphCount}>
                        {' '}
                        &middot; {book.paragraphCount} paragraphs
                      </Show>
                    </div>
                  </a>
                )}
              </For>
            </div>
          </Show>
        )}
      </Show>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Page reader view
// ---------------------------------------------------------------------------

const PageReaderView: Component = () => {
  const params = useParams<{ bookCode: string; page: string }>();
  const navigate = useNavigate();
  const { overlay } = useOverlay();

  const bookCode = () => params.bookCode;
  const pageNum = () => parseInt(params.page, 10) || 1;

  // Fetch page data
  const [pageData] = createResource(
    () => ({ code: bookCode(), page: pageNum() }),
    ({ code, page }) => fetchEgwPage(code, page),
  );

  // Fetch chapters for TOC dropdown
  const [chapters] = createResource(bookCode, (code) => fetchEgwChapters(code));

  // Selected paragraph index (among body paragraphs, not headings)
  const [selectedIndex, setSelectedIndex] = createSignal(0);

  // Chapter dropdown open state
  const [tocOpen, setTocOpen] = createSignal(false);

  // Bible refs popup state
  const [refsPopupOpen, setRefsPopupOpen] = createSignal(false);

  // Reset selection on page change
  createEffect(() => {
    pageNum(); // track
    setSelectedIndex(0);
  });

  // Scroll selected paragraph into view
  createEffect(() => {
    const idx = selectedIndex();
    const bodyParas = bodyParagraphs();
    if (!bodyParas.length) return;
    const para = bodyParas[idx];
    if (!para) return;
    const el = document.querySelector(`[data-para="${para.puborder}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  // Body paragraphs (excluding headings)
  const bodyParagraphs = createMemo<readonly EGWParagraph[]>(() => {
    const data = pageData();
    if (!data) return [];
    return data.paragraphs.filter((p) => !isChapterHeading(p.elementType));
  });

  // Selected paragraph data
  const selectedParagraph = createMemo(() => {
    const paras = bodyParagraphs();
    return paras[selectedIndex()] ?? null;
  });

  // Page navigation
  const goToPage = (page: number | null) => {
    if (page == null) return;
    navigate(`/egw/${bookCode()}/${page}`);
  };

  // Space/Enter opens Bible refs popup
  const handleRawKeyDown = (event: KeyboardEvent) => {
    if (overlay() !== 'none') return;
    if (refsPopupOpen()) return;
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    if (event.key === ' ' || (event.key === 'Enter' && !event.metaKey && !event.ctrlKey)) {
      event.preventDefault();
      event.stopPropagation();
      if (selectedParagraph()) {
        setRefsPopupOpen(true);
      }
    }
  };

  onMount(() => {
    window.addEventListener('keydown', handleRawKeyDown, true);
  });

  onCleanup(() => {
    window.removeEventListener('keydown', handleRawKeyDown, true);
  });

  // Keyboard navigation (parsed actions from keyboard provider)
  useKeyboardAction((action) => {
    if (refsPopupOpen()) return;

    switch (action) {
      case 'nextVerse': {
        const max = bodyParagraphs().length - 1;
        setSelectedIndex((i) => Math.min(i + 1, max));
        break;
      }
      case 'prevVerse':
        setSelectedIndex((i) => Math.max(0, i - 1));
        break;
      case 'nextChapter': {
        const data = pageData();
        if (data) goToPage(data.nextPage);
        break;
      }
      case 'prevChapter': {
        const data = pageData();
        if (data) goToPage(data.prevPage);
        break;
      }
    }
  });

  return (
    <div class="space-y-6">
      {/* Header */}
      <header class="sticky top-0 z-10 bg-[--color-paper] dark:bg-[--color-paper-dark] border-b border-[--color-border] dark:border-[--color-border-dark] pb-4 pt-2">
        <div class="flex items-baseline justify-between">
          <div class="flex items-baseline gap-3">
            <a
              href="/egw"
              class="text-sm text-[--color-accent] dark:text-[--color-accent-dark] hover:underline"
            >
              Books
            </a>
            <h1 class="font-sans text-2xl font-semibold text-[--color-ink] dark:text-[--color-ink-dark]">
              <Show when={pageData()} fallback={bookCode()}>
                {(data) => data().book.title}
              </Show>
            </h1>
          </div>
          <div class="flex items-center gap-3">
            {/* Chapter TOC dropdown */}
            <Show when={chapters()?.length ? chapters() : undefined}>
              {(chs) => (
                <div class="relative">
                  <button
                    class="text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] hover:text-[--color-accent] dark:hover:text-[--color-accent-dark] transition-colors"
                    onClick={() => setTocOpen((o) => !o)}
                  >
                    Chapters ▾
                  </button>
                  <Show when={tocOpen()}>
                    <ChapterDropdown
                      chapters={chs()}
                      currentPage={pageNum()}
                      onSelect={(page) => {
                        setTocOpen(false);
                        goToPage(page);
                      }}
                      onClose={() => setTocOpen(false)}
                    />
                  </Show>
                </div>
              )}
            </Show>
            <span class="text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
              <Show when={pageData()}>
                {(data) => (
                  <>
                    Page {data().page} of {data().totalPages}
                  </>
                )}
              </Show>
            </span>
          </div>
        </div>
        <Show when={pageData()?.chapterHeading}>
          {(heading) => (
            <div class="mt-2 text-lg font-medium text-[--color-accent] dark:text-[--color-accent-dark]">
              {heading()}
            </div>
          )}
        </Show>
      </header>

      {/* Content */}
      <Show when={pageData.loading}>
        <p class="text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] italic">Loading...</p>
      </Show>

      <Show when={pageData.error}>
        <p class="text-red-600 dark:text-red-400">Failed to load page: {String(pageData.error)}</p>
      </Show>

      <Show when={!pageData.loading && !pageData.error && pageData()}>
        {(data) => (
          <PageView
            paragraphs={data().paragraphs}
            selectedIndex={selectedIndex()}
            onSelect={setSelectedIndex}
          />
        )}
      </Show>

      {/* Bible refs popup */}
      <BibleRefsPopup
        content={selectedParagraph()?.content ?? null}
        refcode={selectedParagraph()?.refcodeShort ?? null}
        open={refsPopupOpen()}
        onClose={() => setRefsPopupOpen(false)}
      />

      {/* Footer */}
      <footer class="border-t border-[--color-border] dark:border-[--color-border-dark] pt-4 text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <span>
            <Show when={selectedParagraph()?.refcodeShort}>{(ref) => ref()}</Show>
          </span>
          <div class="flex gap-4 flex-wrap">
            <span>
              <kbd class="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1 text-xs">
                ↑↓
              </kbd>{' '}
              paragraph
            </span>
            <span>
              <kbd class="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1 text-xs">
                ←→
              </kbd>{' '}
              page
            </span>
            <span>
              <kbd class="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1 text-xs">
                ␣
              </kbd>{' '}
              refs
            </span>
            <span>
              <kbd class="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1 text-xs">
                ⌘K
              </kbd>{' '}
              palette
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Chapter dropdown
// ---------------------------------------------------------------------------

const ChapterDropdown: Component<{
  chapters: readonly EGWChapter[];
  currentPage: number;
  onSelect: (page: number) => void;
  onClose: () => void;
}> = (props) => {
  let ref: HTMLDivElement | undefined = undefined;

  // Close on outside click
  const handleClick = (e: MouseEvent) => {
    if (ref && !ref.contains(e.target as Node)) {
      props.onClose();
    }
  };

  onMount(() => {
    document.addEventListener('click', handleClick, true);
  });

  onCleanup(() => {
    document.removeEventListener('click', handleClick, true);
  });

  return (
    <div
      ref={(el) => (ref = el)}
      class="absolute right-0 top-full mt-1 z-20 max-h-80 w-64 overflow-y-auto rounded-lg border border-[--color-border] dark:border-[--color-border-dark] bg-[--color-paper] dark:bg-[--color-paper-dark] shadow-xl"
    >
      <For each={props.chapters}>
        {(ch: EGWChapter) => (
          <Show when={ch.page}>
            {(page) => (
              <button
                class="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark]"
                classList={{
                  'text-[--color-accent] dark:text-[--color-accent-dark] font-medium':
                    page() === props.currentPage,
                  'text-[--color-ink] dark:text-[--color-ink-dark]': page() !== props.currentPage,
                }}
                onClick={() => props.onSelect(page())}
              >
                <Show when={ch.title} fallback={ch.refcodeShort ?? `Page ${page()}`}>
                  {ch.title}
                </Show>
                <span class="ml-2 text-xs opacity-50">p.{page()}</span>
              </button>
            )}
          </Show>
        )}
      </For>
    </div>
  );
};

export default EgwRoute;
