import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useBible } from '@/providers/bible-provider';
import { useOverlay } from '@/providers/overlay-provider';
import { useApp } from '@/providers/db-provider';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { ConcordanceResult, StrongsEntry } from '@/data/study/service';

export function ConcordanceSearch() {
  const { overlay, closeOverlay } = useOverlay();
  const navigate = useNavigate();
  const bible = useBible();
  const app = useApp();

  const isOpen = overlay === 'concordance';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ConcordanceResult[]>([]);
  const [strongsEntry, setStrongsEntry] = useState<StrongsEntry | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setStrongsEntry(null);
      return;
    }
  }, [isOpen]);

  const strongsNumber = (() => {
    const q = query.trim().toUpperCase();
    return /^[HG]\d+$/.test(q) ? q : null;
  })();

  useEffect(() => {
    if (!isOpen || !strongsNumber) {
      setResults([]);
      setStrongsEntry(null);
      return;
    }
    setLoading(true);
    Promise.all([app.searchByStrongs(strongsNumber), app.getStrongsEntry(strongsNumber)]).then(
      ([res, entry]) => {
        setResults(res);
        setStrongsEntry(entry);
        setLoading(false);
      },
    );
  }, [isOpen, strongsNumber, app]);

  const navigateToVerse = (book: number, chapter: number, verse: number) => {
    const b = bible.getBook(book);
    if (b) {
      const slug = b.name.toLowerCase().replace(/\s+/g, '-');
      navigate(`/bible/${slug}/${chapter}/${verse}`);
      closeOverlay();
    }
  };

  const formatRef = (book: number, chapter: number, verse: number) => {
    const b = bible.getBook(book);
    return b ? `${b.name} ${chapter}:${verse}` : `${book}:${chapter}:${verse}`;
  };

  const languageColor = strongsEntry
    ? strongsEntry.language === 'hebrew'
      ? 'text-[--color-strongs-hebrew] dark:text-[--color-strongs-hebrew-dark]'
      : 'text-[--color-strongs-greek] dark:text-[--color-strongs-greek-dark]'
    : '';

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeOverlay();
          setQuery('');
        }
      }}
    >
      <DialogContent
        className="top-1/4 translate-y-0 p-0 gap-0 w-full max-w-xl rounded-xl bg-[--color-paper] dark:bg-[--color-paper-dark] border border-[--color-border] dark:border-[--color-border-dark] overflow-hidden max-h-[70vh] flex flex-col"
        showCloseButton={false}
        initialFocus={false}
      >
        <div className="px-4 pt-4 pb-2">
          <span className="text-sm font-medium text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
            Strong's Concordance
          </span>
        </div>

        <div className="px-4 pb-2">
          <input
            id="concordance-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            placeholder="Strong's number (e.g. H157, G26)"
            className="w-full bg-transparent text-lg text-[--color-ink] dark:text-[--color-ink-dark] placeholder:text-[--color-ink-muted] dark:placeholder:text-[--color-ink-muted-dark] outline-none font-mono"
          />
        </div>

        {/* Strong's entry preview */}
        {strongsEntry && (
          <div className="px-4 py-2 bg-[--color-highlight]/50 dark:bg-[--color-highlight-dark]/50 shrink-0">
            <span className={`font-mono font-bold ${languageColor}`}>{strongsEntry.number}</span>
            <span className="ml-2 font-serif text-[--color-ink] dark:text-[--color-ink-dark]">
              {strongsEntry.lemma}
            </span>
            {strongsEntry.transliteration && (
              <span className="ml-2 text-sm italic text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                {strongsEntry.transliteration}
              </span>
            )}
            <p className="mt-1 text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] line-clamp-2">
              {strongsEntry.definition}
            </p>
          </div>
        )}

        <div className="border-t border-[--color-border] dark:border-[--color-border-dark]" />

        {/* Results */}
        <div className="overflow-y-auto min-h-0 flex-1">
          {!strongsNumber ? (
            <p className="px-4 py-6 text-center text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
              Enter a Strong's number (H for Hebrew, G for Greek)
            </p>
          ) : loading ? (
            <p className="px-4 py-6 text-center text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
              Searching...
            </p>
          ) : results.length > 0 ? (
            <div className="p-2 space-y-0.5">
              {results.map((result, i) => (
                <button
                  key={`${result.book}-${result.chapter}-${result.verse}-${i}`}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] transition-colors flex items-baseline gap-3"
                  onClick={() => navigateToVerse(result.book, result.chapter, result.verse)}
                >
                  <span className="text-xs font-medium text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] w-36 shrink-0">
                    {formatRef(result.book, result.chapter, result.verse)}
                  </span>
                  {result.wordText && (
                    <span className="text-sm text-[--color-ink] dark:text-[--color-ink-dark]">
                      {result.wordText}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
              No verses found
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[--color-border] dark:border-[--color-border-dark] px-4 py-2 flex items-center justify-between text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] shrink-0">
          {results.length > 0 && <span>{results.length} verses</span>}
          <span>
            <kbd className="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1">
              esc
            </kbd>{' '}
            close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
