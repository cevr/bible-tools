import { type Component, createMemo, createSignal, For, Show, createResource } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { useNavigate } from '@solidjs/router';
import { useBible } from '@/providers/bible-provider';
import { useOverlay } from '@/providers/overlay-provider';
import { useStudyData } from '@/providers/study-data-provider';
import { fetchVerses } from '@/data/bible';
import type { ClassifiedCrossReference, CrossRefType } from '@/data/study/service';

interface CrossRefsData {
  book: number;
  chapter: number;
  verse: number;
}

// Type badge config: abbreviation, color class
const TYPE_BADGES: Record<CrossRefType, { abbr: string; color: string }> = {
  quotation: { abbr: 'QUO', color: 'bg-blue-500/20 text-blue-700 dark:text-blue-300' },
  allusion: { abbr: 'ALL', color: 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300' },
  parallel: { abbr: 'PAR', color: 'bg-green-500/20 text-green-700 dark:text-green-300' },
  typological: { abbr: 'TYP', color: 'bg-amber-500/20 text-amber-700 dark:text-amber-300' },
  prophecy: { abbr: 'PRO', color: 'bg-purple-500/20 text-purple-700 dark:text-purple-300' },
  sanctuary: { abbr: 'SAN', color: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300' },
  recapitulation: { abbr: 'REC', color: 'bg-pink-500/20 text-pink-700 dark:text-pink-300' },
  thematic: { abbr: 'THM', color: 'bg-gray-500/20 text-gray-700 dark:text-gray-300' },
};

const ALL_TYPES: CrossRefType[] = [
  'quotation',
  'allusion',
  'parallel',
  'typological',
  'prophecy',
  'sanctuary',
  'recapitulation',
  'thematic',
];

/**
 * Cross-references popup showing real cross-reference data from SQLite.
 */
export const CrossRefsPopup: Component = () => {
  const { overlay, overlayData, closeOverlay } = useOverlay();
  const navigate = useNavigate();
  const bible = useBible();
  const study = useStudyData();

  const isOpen = () => overlay() === 'cross-refs';
  const data = () => overlayData() as CrossRefsData | null;

  // Fetch current verse text
  const [currentVerseText] = createResource(
    () => {
      const d = data();
      if (!d) return null;
      return d;
    },
    async (params) => {
      if (!params) return null;
      const verses = await fetchVerses(params.book, params.chapter);
      return verses.find((v) => v.verse === params.verse)?.text ?? null;
    },
  );

  // Fetch cross-references
  const [crossRefs, { refetch: refetchCrossRefs }] = createResource(
    () => {
      const d = data();
      if (!d) return null;
      return d;
    },
    async (params) => {
      if (!params) return [];
      return study.getCrossRefs(params.book, params.chapter, params.verse);
    },
  );

  const currentBook = createMemo(() => {
    const d = data();
    if (!d) return null;
    return bible.getBook(d.book);
  });

  // Track which ref is being type-edited
  const [editingRefIdx, setEditingRefIdx] = createSignal<number | null>(null);

  // Add user cross-ref input
  const [addRefInput, setAddRefInput] = createSignal('');

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeOverlay();
      setEditingRefIdx(null);
      setAddRefInput('');
    }
  };

  const navigateToRef = (ref: ClassifiedCrossReference) => {
    const book = bible.getBook(ref.book);
    if (book) {
      const bookSlug = book.name.toLowerCase().replace(/\s+/g, '-');
      const versePart = ref.verse ? `/${ref.verse}` : '';
      navigate(`/bible/${bookSlug}/${ref.chapter}${versePart}`);
      closeOverlay();
    }
  };

  const formatRef = (ref: ClassifiedCrossReference) => {
    const book = bible.getBook(ref.book);
    if (!book) return `${ref.book}:${ref.chapter}:${ref.verse ?? ''}`;
    const versePart = ref.verse
      ? ref.verseEnd
        ? `:${ref.verse}-${ref.verseEnd}`
        : `:${ref.verse}`
      : '';
    return `${book.name} ${ref.chapter}${versePart}`;
  };

  const handleSetType = async (ref: ClassifiedCrossReference, type: CrossRefType) => {
    const d = data();
    if (!d) return;
    await study.setRefType(
      { book: d.book, chapter: d.chapter, verse: d.verse },
      { book: ref.book, chapter: ref.chapter, verse: ref.verse },
      type,
    );
    setEditingRefIdx(null);
    refetchCrossRefs();
  };

  const handleAddUserRef = async () => {
    const d = data();
    const input = addRefInput().trim();
    if (!d || !input) return;
    const parsed = bible.parseReference(input);
    if (!parsed) return;
    await study.addUserCrossRef(
      { book: d.book, chapter: d.chapter, verse: d.verse },
      { book: parsed.book, chapter: parsed.chapter, verse: parsed.verse },
    );
    setAddRefInput('');
    refetchCrossRefs();
  };

  const handleRemoveUserRef = async (id: string) => {
    await study.removeUserCrossRef(id);
    refetchCrossRefs();
  };

  return (
    <Dialog open={isOpen()} onOpenChange={handleOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in" />
        <Dialog.Content class="fixed left-1/2 top-1/4 z-50 w-full max-w-lg -translate-x-1/2 rounded-xl bg-[--color-paper] dark:bg-[--color-paper-dark] shadow-2xl border border-[--color-border] dark:border-[--color-border-dark] overflow-hidden animate-in fade-in slide-in-from-top-4 max-h-[70vh] flex flex-col">
          {/* Header */}
          <div class="px-4 pt-4 pb-2 border-b border-[--color-border] dark:border-[--color-border-dark] shrink-0">
            <Dialog.Title class="font-sans text-lg font-semibold text-[--color-ink] dark:text-[--color-ink-dark]">
              <Show when={currentBook()}>
                {(book) => (
                  <Show when={data()}>
                    {(d) => (
                      <>
                        {book().name} {d().chapter}:{d().verse}
                      </>
                    )}
                  </Show>
                )}
              </Show>
            </Dialog.Title>
            <Dialog.Description class="sr-only">
              Cross-references and related verses
            </Dialog.Description>
          </div>

          {/* Current verse text */}
          <Show when={currentVerseText()}>
            {(text) => (
              <div class="px-4 py-3 bg-[--color-highlight]/50 dark:bg-[--color-highlight-dark]/50 shrink-0">
                <p class="reading-text text-[--color-ink] dark:text-[--color-ink-dark]">{text()}</p>
              </div>
            )}
          </Show>

          {/* Cross-references */}
          <div class="px-4 py-3 overflow-y-auto min-h-0 flex-1">
            <h3 class="text-xs font-medium text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] uppercase tracking-wider mb-2">
              Cross-References
            </h3>
            <Show when={crossRefs.loading}>
              <p class="text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                Loading...
              </p>
            </Show>
            <Show when={!crossRefs.loading}>
              <Show
                when={(crossRefs() ?? []).length > 0}
                fallback={
                  <p class="text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                    No cross-references found.
                  </p>
                }
              >
                <div class="space-y-1">
                  <For each={crossRefs()}>
                    {(ref, idx) => (
                      <div class="flex items-start gap-2 p-2 rounded-lg hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] transition-colors group">
                        {/* Type badge */}
                        <Show
                          when={ref.classification}
                          fallback={
                            <button
                              class="shrink-0 px-1.5 py-0.5 text-[10px] font-mono rounded bg-gray-200/50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                              onClick={() => setEditingRefIdx(idx())}
                              title="Set type"
                            >
                              ???
                            </button>
                          }
                        >
                          {(cls) => {
                            const badge = () => TYPE_BADGES[cls()];
                            return (
                              <button
                                class={`shrink-0 px-1.5 py-0.5 text-[10px] font-mono rounded ${badge().color} hover:opacity-80 transition-opacity`}
                                onClick={() => setEditingRefIdx(idx())}
                                title={cls()}
                              >
                                {badge().abbr}
                              </button>
                            );
                          }}
                        </Show>

                        {/* Reference */}
                        <button class="flex-1 text-left min-w-0" onClick={() => navigateToRef(ref)}>
                          <span class="text-sm font-medium text-[--color-ink] dark:text-[--color-ink-dark]">
                            {ref.isUserAdded ? '* ' : ''}
                            {formatRef(ref)}
                          </span>
                          <Show when={ref.previewText}>
                            <p class="text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] line-clamp-1 mt-0.5">
                              {ref.previewText}
                            </p>
                          </Show>
                          <Show when={ref.userNote}>
                            <p class="text-xs italic text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] mt-0.5">
                              {ref.userNote}
                            </p>
                          </Show>
                        </button>

                        {/* Delete button for user refs */}
                        <Show when={ref.isUserAdded && ref.userRefId}>
                          <button
                            class="shrink-0 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 dark:hover:text-red-300 transition-opacity text-xs px-1"
                            onClick={() => ref.userRefId && handleRemoveUserRef(ref.userRefId)}
                            title="Remove"
                          >
                            x
                          </button>
                        </Show>

                        {/* Type picker dropdown */}
                        <Show when={editingRefIdx() === idx()}>
                          <div class="absolute right-4 mt-6 z-10 bg-[--color-paper] dark:bg-[--color-paper-dark] border border-[--color-border] dark:border-[--color-border-dark] rounded-lg shadow-lg p-1 space-y-0.5">
                            <For each={ALL_TYPES}>
                              {(type) => {
                                const badge = TYPE_BADGES[type];
                                return (
                                  <button
                                    class={`w-full text-left px-2 py-1 text-xs rounded hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] flex items-center gap-2`}
                                    onClick={() => handleSetType(ref, type)}
                                  >
                                    <span
                                      class={`px-1 py-0.5 rounded text-[10px] font-mono ${badge.color}`}
                                    >
                                      {badge.abbr}
                                    </span>
                                    <span class="text-[--color-ink] dark:text-[--color-ink-dark] capitalize">
                                      {type}
                                    </span>
                                  </button>
                                );
                              }}
                            </For>
                            <button
                              class="w-full text-left px-2 py-1 text-xs rounded hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]"
                              onClick={() => setEditingRefIdx(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </Show>

            {/* Add user cross-ref */}
            <div class="mt-3 pt-3 border-t border-[--color-border] dark:border-[--color-border-dark]">
              <form
                class="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleAddUserRef();
                }}
              >
                <input
                  type="text"
                  placeholder="Add cross-ref (e.g. John 3:16)"
                  class="flex-1 px-2 py-1.5 text-sm rounded-lg border border-[--color-border] dark:border-[--color-border-dark] bg-transparent text-[--color-ink] dark:text-[--color-ink-dark] placeholder:text-[--color-ink-muted] dark:placeholder:text-[--color-ink-muted-dark] focus:outline-none focus:ring-1 focus:ring-[--color-accent] dark:focus:ring-[--color-accent-dark]"
                  value={addRefInput()}
                  onInput={(e) => setAddRefInput(e.currentTarget.value)}
                />
                <button
                  type="submit"
                  class="px-3 py-1.5 text-sm font-medium rounded-lg bg-[--color-accent] dark:bg-[--color-accent-dark] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                  disabled={!addRefInput().trim()}
                >
                  Add
                </button>
              </form>
            </div>
          </div>

          {/* Actions */}
          <div class="px-4 py-3 border-t border-[--color-border] dark:border-[--color-border-dark] flex items-center justify-between shrink-0">
            <div class="text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
              <Show when={(crossRefs() ?? []).length > 0}>
                <span>{(crossRefs() ?? []).length} cross-references</span>
              </Show>
            </div>
            <button
              class="px-3 py-1.5 text-sm font-medium text-[--color-accent] dark:text-[--color-accent-dark] hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] rounded transition-colors"
              onClick={() => closeOverlay()}
            >
              Done
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};
