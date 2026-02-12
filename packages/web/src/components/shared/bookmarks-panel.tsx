import { useState, useEffect, Suspense } from 'react';
import { useNavigate } from 'react-router';
import { useBible } from '@/providers/bible-provider';
import { useOverlay } from '@/providers/overlay-provider';
import { useBookmarks, type Bookmark } from '@/providers/state-provider';
import { Dialog, DialogContent } from '@/components/ui/dialog';

function BookmarksPanelInner() {
  const { overlay, overlayData, closeOverlay } = useOverlay();
  const navigate = useNavigate();
  const bible = useBible();
  const { bookmarks, add, remove } = useBookmarks();

  const isOpen = overlay === 'bookmarks';
  const currentRef = overlayData as { book: number; chapter: number; verse: number } | null;
  const [noteInput, setNoteInput] = useState('');

  useEffect(() => {
    if (!isOpen) setNoteInput('');
  }, [isOpen]);

  const formatRef = (ref: { book: number; chapter: number; verse?: number }) => {
    const b = bible.getBook(ref.book);
    if (!b) return `${ref.book}:${ref.chapter}:${ref.verse ?? ''}`;
    return ref.verse ? `${b.name} ${ref.chapter}:${ref.verse}` : `${b.name} ${ref.chapter}`;
  };

  const navigateToBookmark = (ref: { book: number; chapter: number; verse?: number }) => {
    const b = bible.getBook(ref.book);
    if (b) {
      const slug = b.name.toLowerCase().replace(/\s+/g, '-');
      const versePart = ref.verse ? `/${ref.verse}` : '';
      navigate(`/bible/${slug}/${ref.chapter}${versePart}`);
      closeOverlay();
    }
  };

  const handleAdd = async () => {
    if (!currentRef) return;
    await add(currentRef, noteInput || undefined);
    setNoteInput('');
  };

  const formatDate = (ts: number) =>
    new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(
      new Date(ts),
    );

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeOverlay();
          setNoteInput('');
        }
      }}
    >
      <DialogContent
        className="top-1/4 translate-y-0 p-0 gap-0 w-full max-w-lg rounded-xl bg-[--color-paper] dark:bg-[--color-paper-dark] border border-[--color-border] dark:border-[--color-border-dark] overflow-hidden max-h-[70vh] flex flex-col"
        showCloseButton={false}
      >
        <div className="px-4 pt-4 pb-2 border-b border-[--color-border] dark:border-[--color-border-dark] shrink-0">
          <h2 className="font-sans text-lg font-semibold text-[--color-ink] dark:text-[--color-ink-dark]">
            Bookmarks
          </h2>
        </div>

        {/* Quick-add */}
        {currentRef && (
          <div className="px-4 py-3 bg-[--color-highlight]/50 dark:bg-[--color-highlight-dark]/50 shrink-0">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void handleAdd();
              }}
            >
              <span className="text-sm text-[--color-ink] dark:text-[--color-ink-dark] shrink-0 py-1.5">
                {formatRef(currentRef)}
              </span>
              <input
                type="text"
                placeholder="Note (optional)"
                className="flex-1 px-2 py-1.5 text-sm rounded-lg border border-[--color-border] dark:border-[--color-border-dark] bg-transparent text-[--color-ink] dark:text-[--color-ink-dark] placeholder:text-[--color-ink-muted] dark:placeholder:text-[--color-ink-muted-dark] focus:outline-none focus:ring-1 focus:ring-[--color-accent] dark:focus:ring-[--color-accent-dark]"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
              />
              <button
                type="submit"
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-[--color-accent] dark:bg-[--color-accent-dark] text-white hover:opacity-90 transition-opacity"
              >
                Add
              </button>
            </form>
          </div>
        )}

        {/* List */}
        <div className="overflow-y-auto min-h-0 flex-1 p-2">
          {bookmarks.length > 0 ? (
            <div className="space-y-1">
              {bookmarks.map((bm: Bookmark) => (
                <div
                  key={bm.id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] transition-colors group"
                >
                  <button
                    className="flex-1 text-left min-w-0"
                    onClick={() => navigateToBookmark(bm.reference)}
                  >
                    <span className="text-sm font-medium text-[--color-ink] dark:text-[--color-ink-dark]">
                      {formatRef(bm.reference)}
                    </span>
                    {bm.note && (
                      <p className="text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] mt-0.5">
                        {bm.note}
                      </p>
                    )}
                    <time
                      className="text-[10px] text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]"
                      dateTime={new Date(bm.createdAt).toISOString()}
                    >
                      {formatDate(bm.createdAt)}
                    </time>
                  </button>
                  <button
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 dark:hover:text-red-300 transition-opacity text-xs px-1"
                    onClick={() => void remove(bm.id)}
                    title="Remove"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
              No bookmarks yet.
            </p>
          )}
        </div>

        {/* Footer */}
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

export function BookmarksPanel() {
  const { overlay } = useOverlay();
  if (overlay !== 'bookmarks') return null;
  return (
    <Suspense fallback={null}>
      <BookmarksPanelInner />
    </Suspense>
  );
}
