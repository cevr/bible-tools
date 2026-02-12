import { Suspense } from 'react';
import { useNavigate } from 'react-router';
import { useBible } from '@/providers/bible-provider';
import { useOverlay } from '@/providers/overlay-provider';
import { useHistory, type HistoryEntry } from '@/providers/state-provider';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface GroupedEntries {
  label: string;
  entries: HistoryEntry[];
}

function groupByDate(entries: HistoryEntry[]): GroupedEntries[] {
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

function HistoryPanelInner() {
  const { overlay, closeOverlay } = useOverlay();
  const navigate = useNavigate();
  const bible = useBible();
  const { history, clear } = useHistory();

  const isOpen = overlay === 'history';

  const formatRef = (ref: { book: number; chapter: number; verse?: number }) => {
    const b = bible.getBook(ref.book);
    if (!b) return `${ref.book}:${ref.chapter}:${ref.verse ?? ''}`;
    return ref.verse ? `${b.name} ${ref.chapter}:${ref.verse}` : `${b.name} ${ref.chapter}`;
  };

  const formatTime = (ts: number) =>
    new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(ts));

  const formatDate = (ts: number) =>
    new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(ts));

  const navigateToEntry = (ref: { book: number; chapter: number; verse?: number }) => {
    const b = bible.getBook(ref.book);
    if (b) {
      const slug = b.name.toLowerCase().replace(/\s+/g, '-');
      const versePart = ref.verse ? `/${ref.verse}` : '';
      navigate(`/bible/${slug}/${ref.chapter}${versePart}`);
      closeOverlay();
    }
  };

  const grouped = groupByDate(history);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeOverlay()}>
      <DialogContent
        className="top-1/4 translate-y-0 p-0 gap-0 w-full max-w-lg rounded-xl bg-[--color-paper] dark:bg-[--color-paper-dark] border border-[--color-border] dark:border-[--color-border-dark] overflow-hidden max-h-[70vh] flex flex-col"
        showCloseButton={false}
      >
        <div className="px-4 pt-4 pb-2 border-b border-[--color-border] dark:border-[--color-border-dark] shrink-0 flex items-center justify-between">
          <h2 className="font-sans text-lg font-semibold text-[--color-ink] dark:text-[--color-ink-dark]">
            History
          </h2>
          {history.length > 0 && (
            <button
              className="text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] hover:text-red-500 dark:hover:text-red-400 transition-colors"
              onClick={() => void clear()}
            >
              Clear all
            </button>
          )}
        </div>

        <div className="overflow-y-auto min-h-0 flex-1 p-2">
          {history.length > 0 ? (
            <div className="space-y-3">
              {grouped.map((group) => (
                <div key={group.label}>
                  <h3 className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                    {group.label}
                  </h3>
                  <div className="space-y-0.5">
                    {group.entries.map((entry, i) => (
                      <button
                        key={`${entry.reference.book}-${entry.reference.chapter}-${entry.visitedAt}-${i}`}
                        className="w-full flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] transition-colors text-left"
                        onClick={() => navigateToEntry(entry.reference)}
                      >
                        <span className="text-sm font-medium text-[--color-ink] dark:text-[--color-ink-dark]">
                          {formatRef(entry.reference)}
                        </span>
                        <time
                          className="text-[10px] text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] shrink-0 tabular-nums"
                          dateTime={new Date(entry.visitedAt).toISOString()}
                        >
                          {group.label === 'Today' || group.label === 'Yesterday'
                            ? formatTime(entry.visitedAt)
                            : formatDate(entry.visitedAt)}
                        </time>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
              No history yet.
            </p>
          )}
        </div>

        <div className="border-t border-[--color-border] dark:border-[--color-border-dark] px-4 py-3 flex justify-end shrink-0">
          <button
            className="px-3 py-1.5 text-sm font-medium text-[--color-accent] dark:text-[--color-accent-dark] hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] rounded transition-colors"
            onClick={closeOverlay}
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function HistoryPanel() {
  const { overlay } = useOverlay();
  if (overlay !== 'history') return null;
  return (
    <Suspense fallback={null}>
      <HistoryPanelInner />
    </Suspense>
  );
}
