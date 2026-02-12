import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useBible } from '@/providers/bible-provider';
import { useOverlay } from '@/providers/overlay-provider';
import { useApp } from '@/providers/db-provider';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { ClassifiedCrossReference, CrossRefType } from '@/data/study/service';

interface CrossRefsData {
  book: number;
  chapter: number;
  verse: number;
}

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

export function CrossRefsPopup() {
  const { overlay, overlayData, closeOverlay } = useOverlay();
  const navigate = useNavigate();
  const bible = useBible();
  const app = useApp();

  const isOpen = overlay === 'cross-refs';
  const data = overlayData as CrossRefsData | null;

  const [currentVerseText, setCurrentVerseText] = useState<string | null>(null);
  const [crossRefs, setCrossRefs] = useState<ClassifiedCrossReference[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRefIdx, setEditingRefIdx] = useState<number | null>(null);
  const [addRefInput, setAddRefInput] = useState('');

  useEffect(() => {
    if (!isOpen || !data) {
      setCrossRefs([]);
      setCurrentVerseText(null);
      setEditingRefIdx(null);
      setAddRefInput('');
      return;
    }
    setLoading(true);
    Promise.all([
      app
        .fetchVerses(data.book, data.chapter)
        .then((vs) => vs.find((v) => v.verse === data.verse)?.text ?? null),
      app.getCrossRefs(data.book, data.chapter, data.verse),
    ]).then(([text, refs]) => {
      setCurrentVerseText(text);
      setCrossRefs(refs);
      setLoading(false);
    });
  }, [isOpen, data?.book, data?.chapter, data?.verse, app]);

  const refetchCrossRefs = () => {
    if (!data) return;
    app.getCrossRefs(data.book, data.chapter, data.verse).then(setCrossRefs);
  };

  const currentBook = data ? bible.getBook(data.book) : null;

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
    if (!data) return;
    await app.setRefType(
      { book: data.book, chapter: data.chapter, verse: data.verse },
      { book: ref.book, chapter: ref.chapter, verse: ref.verse },
      type,
    );
    setEditingRefIdx(null);
    refetchCrossRefs();
  };

  const handleAddUserRef = async () => {
    if (!data || !addRefInput.trim()) return;
    const parsed = bible.parseReference(addRefInput);
    if (!parsed) return;
    await app.addUserCrossRef(
      { book: data.book, chapter: data.chapter, verse: data.verse },
      { book: parsed.book, chapter: parsed.chapter, verse: parsed.verse },
    );
    setAddRefInput('');
    refetchCrossRefs();
  };

  const handleRemoveUserRef = async (id: string) => {
    await app.removeUserCrossRef(id);
    refetchCrossRefs();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeOverlay();
          setEditingRefIdx(null);
          setAddRefInput('');
        }
      }}
    >
      <DialogContent
        className="top-1/4 translate-y-0 p-0 gap-0 w-full max-w-lg rounded-xl bg-[--color-paper] dark:bg-[--color-paper-dark] border border-[--color-border] dark:border-[--color-border-dark] overflow-hidden max-h-[70vh] flex flex-col"
        showCloseButton={false}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-2 border-b border-[--color-border] dark:border-[--color-border-dark] shrink-0">
          <h2 className="font-sans text-lg font-semibold text-[--color-ink] dark:text-[--color-ink-dark]">
            {currentBook && data ? `${currentBook.name} ${data.chapter}:${data.verse}` : ''}
          </h2>
        </div>

        {/* Current verse text */}
        {currentVerseText && (
          <div className="px-4 py-3 bg-[--color-highlight]/50 dark:bg-[--color-highlight-dark]/50 shrink-0">
            <p className="reading-text text-[--color-ink] dark:text-[--color-ink-dark]">
              {currentVerseText}
            </p>
          </div>
        )}

        {/* Cross-references */}
        <div className="px-4 py-3 overflow-y-auto min-h-0 flex-1">
          <h3 className="text-xs font-medium text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] uppercase tracking-wider mb-2">
            Cross-References
          </h3>
          {loading ? (
            <p className="text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
              Loading...
            </p>
          ) : crossRefs.length > 0 ? (
            <div className="space-y-1">
              {crossRefs.map((ref, idx) => (
                <div
                  key={`${ref.book}-${ref.chapter}-${ref.verse}-${idx}`}
                  className="flex items-start gap-2 p-2 rounded-lg hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] transition-colors group"
                >
                  {/* Type badge */}
                  {ref.classification ? (
                    <button
                      className={`shrink-0 px-1.5 py-0.5 text-[10px] font-mono rounded ${TYPE_BADGES[ref.classification].color} hover:opacity-80 transition-opacity`}
                      onClick={() => setEditingRefIdx(idx)}
                      title={ref.classification}
                    >
                      {TYPE_BADGES[ref.classification].abbr}
                    </button>
                  ) : (
                    <button
                      className="shrink-0 px-1.5 py-0.5 text-[10px] font-mono rounded bg-gray-200/50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                      onClick={() => setEditingRefIdx(idx)}
                      title="Set type"
                    >
                      ???
                    </button>
                  )}

                  {/* Reference */}
                  <button className="flex-1 text-left min-w-0" onClick={() => navigateToRef(ref)}>
                    <span className="text-sm font-medium text-[--color-ink] dark:text-[--color-ink-dark]">
                      {ref.isUserAdded ? '* ' : ''}
                      {formatRef(ref)}
                    </span>
                    {ref.previewText && (
                      <p className="text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] line-clamp-1 mt-0.5">
                        {ref.previewText}
                      </p>
                    )}
                    {ref.userNote && (
                      <p className="text-xs italic text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] mt-0.5">
                        {ref.userNote}
                      </p>
                    )}
                  </button>

                  {/* Delete button for user refs */}
                  {ref.isUserAdded && ref.userRefId && (
                    <button
                      className="shrink-0 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 dark:hover:text-red-300 transition-opacity text-xs px-1"
                      onClick={() => ref.userRefId && handleRemoveUserRef(ref.userRefId)}
                      title="Remove"
                    >
                      x
                    </button>
                  )}

                  {/* Type picker dropdown */}
                  {editingRefIdx === idx && (
                    <div className="absolute right-4 mt-6 z-10 bg-[--color-paper] dark:bg-[--color-paper-dark] border border-[--color-border] dark:border-[--color-border-dark] rounded-lg shadow-lg p-1 space-y-0.5">
                      {ALL_TYPES.map((type) => {
                        const badge = TYPE_BADGES[type];
                        return (
                          <button
                            key={type}
                            className="w-full text-left px-2 py-1 text-xs rounded hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] flex items-center gap-2"
                            onClick={() => handleSetType(ref, type)}
                          >
                            <span
                              className={`px-1 py-0.5 rounded text-[10px] font-mono ${badge.color}`}
                            >
                              {badge.abbr}
                            </span>
                            <span className="text-[--color-ink] dark:text-[--color-ink-dark] capitalize">
                              {type}
                            </span>
                          </button>
                        );
                      })}
                      <button
                        className="w-full text-left px-2 py-1 text-xs rounded hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]"
                        onClick={() => setEditingRefIdx(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
              No cross-references found.
            </p>
          )}

          {/* Add user cross-ref */}
          <div className="mt-3 pt-3 border-t border-[--color-border] dark:border-[--color-border-dark]">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void handleAddUserRef();
              }}
            >
              <input
                type="text"
                placeholder="Add cross-ref (e.g. John 3:16)"
                className="flex-1 px-2 py-1.5 text-sm rounded-lg border border-[--color-border] dark:border-[--color-border-dark] bg-transparent text-[--color-ink] dark:text-[--color-ink-dark] placeholder:text-[--color-ink-muted] dark:placeholder:text-[--color-ink-muted-dark] focus:outline-none focus:ring-1 focus:ring-[--color-accent] dark:focus:ring-[--color-accent-dark]"
                value={addRefInput}
                onChange={(e) => setAddRefInput(e.target.value)}
              />
              <button
                type="submit"
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-[--color-accent] dark:bg-[--color-accent-dark] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                disabled={!addRefInput.trim()}
              >
                Add
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[--color-border] dark:border-[--color-border-dark] flex items-center justify-between shrink-0">
          <div className="text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
            {crossRefs.length > 0 && <span>{crossRefs.length} cross-references</span>}
          </div>
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
