/**
 * History panel — view and navigate to recently visited passages.
 * Entries grouped by: Today, Yesterday, This Week, Older.
 */
import { type Component, createMemo, For, Show } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { useNavigate } from '@solidjs/router';
import { useBible } from '@/providers/bible-provider';
import { useOverlay } from '@/providers/overlay-provider';
import { useHistory } from '@/providers/state-provider';

interface GroupedEntries {
  label: string;
  entries: Array<{
    reference: { book: number; chapter: number; verse?: number };
    visitedAt: number;
  }>;
}

function groupByDate(
  entries: Array<{
    reference: { book: number; chapter: number; verse?: number };
    visitedAt: number;
  }>,
): GroupedEntries[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86_400_000;
  const weekStart = todayStart - 6 * 86_400_000;

  const groups: Record<string, GroupedEntries> = {};
  const order = ['Today', 'Yesterday', 'This Week', 'Older'];

  for (const entry of entries) {
    let label: string;
    if (entry.visitedAt >= todayStart) label = 'Today';
    else if (entry.visitedAt >= yesterdayStart) label = 'Yesterday';
    else if (entry.visitedAt >= weekStart) label = 'This Week';
    else label = 'Older';

    if (!groups[label]) groups[label] = { label, entries: [] };
    groups[label].entries.push(entry);
  }

  return order.filter((l) => groups[l]).map((l) => groups[l]);
}

export const HistoryPanel: Component = () => {
  const { overlay, closeOverlay } = useOverlay();
  const navigate = useNavigate();
  const bible = useBible();
  const { history, clear } = useHistory();

  const isOpen = () => overlay() === 'history';

  const handleOpenChange = (open: boolean) => {
    if (!open) closeOverlay();
  };

  const formatRef = (ref: { book: number; chapter: number; verse?: number }) => {
    const b = bible.getBook(ref.book);
    if (!b) return `${ref.book}:${ref.chapter}:${ref.verse ?? ''}`;
    return ref.verse ? `${b.name} ${ref.chapter}:${ref.verse}` : `${b.name} ${ref.chapter}`;
  };

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  const formatDate = (ts: number) => {
    const date = new Date(ts);
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const navigateToEntry = (ref: { book: number; chapter: number; verse?: number }) => {
    const b = bible.getBook(ref.book);
    if (b) {
      const slug = b.name.toLowerCase().replace(/\s+/g, '-');
      const versePart = ref.verse ? `/${ref.verse}` : '';
      navigate(`/bible/${slug}/${ref.chapter}${versePart}`);
      closeOverlay();
    }
  };

  const grouped = createMemo(() => groupByDate(history() ?? []));

  return (
    <Dialog open={isOpen()} onOpenChange={handleOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in" />
        <Dialog.Content class="fixed left-1/2 top-1/4 z-50 w-full max-w-lg -translate-x-1/2 rounded-xl bg-[--color-paper] dark:bg-[--color-paper-dark] shadow-2xl border border-[--color-border] dark:border-[--color-border-dark] overflow-hidden animate-in fade-in slide-in-from-top-4 max-h-[70vh] flex flex-col">
          <div class="px-4 pt-4 pb-2 border-b border-[--color-border] dark:border-[--color-border-dark] shrink-0 flex items-center justify-between">
            <Dialog.Title class="font-sans text-lg font-semibold text-[--color-ink] dark:text-[--color-ink-dark]">
              History
            </Dialog.Title>
            <Dialog.Description class="sr-only">Recently visited passages</Dialog.Description>
            <Show when={(history() ?? []).length > 0}>
              <button
                class="text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] hover:text-red-500 dark:hover:text-red-400 transition-colors"
                onClick={() => void clear()}
              >
                Clear all
              </button>
            </Show>
          </div>

          <div class="overflow-y-auto min-h-0 flex-1 p-2">
            <Show when={history.loading}>
              <p class="px-4 py-6 text-center text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                Loading…
              </p>
            </Show>
            <Show when={!history.loading}>
              <Show
                when={(history() ?? []).length > 0}
                fallback={
                  <p class="px-4 py-6 text-center text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                    No history yet.
                  </p>
                }
              >
                <div class="space-y-3">
                  <For each={grouped()}>
                    {(group) => (
                      <div>
                        <h3 class="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                          {group.label}
                        </h3>
                        <div class="space-y-0.5">
                          <For each={group.entries}>
                            {(entry) => (
                              <button
                                class="w-full flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] transition-colors text-left"
                                onClick={() => navigateToEntry(entry.reference)}
                              >
                                <span class="text-sm font-medium text-[--color-ink] dark:text-[--color-ink-dark]">
                                  {formatRef(entry.reference)}
                                </span>
                                <time
                                  class="text-[10px] text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] shrink-0 tabular-nums"
                                  dateTime={new Date(entry.visitedAt).toISOString()}
                                >
                                  {group.label === 'Today' || group.label === 'Yesterday'
                                    ? formatTime(entry.visitedAt)
                                    : formatDate(entry.visitedAt)}
                                </time>
                              </button>
                            )}
                          </For>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </Show>
          </div>

          <div class="border-t border-[--color-border] dark:border-[--color-border-dark] px-4 py-3 flex justify-end shrink-0">
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
