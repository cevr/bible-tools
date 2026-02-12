import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useBible } from '@/providers/bible-provider';
import { useOverlay } from '@/providers/overlay-provider';
import { useApp } from '@/providers/db-provider';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { BOOK_ALIASES, type Reference } from '@/data/bible';

interface DisplayResult {
  reference: Reference;
  text: string;
}

export function SearchOverlay() {
  const { overlay, overlayData, closeOverlay } = useOverlay();
  const navigate = useNavigate();
  const params = useParams<{ book?: string; chapter?: string }>();
  const bible = useBible();
  const app = useApp();

  const isOpen = overlay === 'search';
  const searchData = overlayData as { query?: string; onSearch?: (q: string) => void } | null;

  const [query, setQuery] = useState('');
  const [searchScope, setSearchScope] = useState<'chapter' | 'global'>('chapter');
  const [results, setResults] = useState<DisplayResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Pre-fill query on open
  useEffect(() => {
    if (isOpen && searchData?.query) {
      setQuery(searchData.query);
    }
  }, [isOpen]);

  // Current book/chapter from URL
  const currentBookNumber = (() => {
    const bookParam = params.book?.toLowerCase();
    if (!bookParam) return 1;
    const num = parseInt(bookParam, 10);
    if (!isNaN(num) && num >= 1 && num <= 66) return num;
    const aliasNum = BOOK_ALIASES[bookParam];
    if (aliasNum) return aliasNum;
    const book = bible.books.find((b) => b.name.toLowerCase() === bookParam);
    return book?.number ?? 1;
  })();

  const currentChapter = parseInt(params.chapter ?? '1', 10) || 1;

  // Search effect
  useEffect(() => {
    if (!isOpen) return;
    const q = query.toLowerCase().trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);

    if (searchScope === 'chapter') {
      app.fetchVerses(currentBookNumber, currentChapter).then((verses) => {
        const matches = verses
          .filter((v) => v.text.toLowerCase().includes(q))
          .map((v) => ({
            reference: { book: currentBookNumber, chapter: currentChapter, verse: v.verse },
            text: v.text,
          }))
          .slice(0, 20);
        setResults(matches);
        setLoading(false);
      });
    } else {
      app.searchVerses(query, 20).then((searchResults) => {
        setResults(
          searchResults.map((sr) => ({
            reference: { book: sr.book, chapter: sr.chapter, verse: sr.verse },
            text: sr.text,
          })),
        );
        setLoading(false);
      });
    }
  }, [isOpen, query, searchScope, currentBookNumber, currentChapter, app]);

  const handleClose = () => {
    searchData?.onSearch?.(query);
    closeOverlay();
  };

  const navigateToResult = (result: DisplayResult) => {
    const book = bible.getBook(result.reference.book);
    if (book) {
      const bookSlug = book.name.toLowerCase().replace(/\s+/g, '-');
      navigate(`/bible/${bookSlug}/${result.reference.chapter}/${result.reference.verse}`);
      searchData?.onSearch?.(query);
      closeOverlay();
    }
  };

  const highlightMatch = (text: string, q: string): ReactNode => {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-[--color-highlight] dark:bg-[--color-highlight-dark] rounded px-0.5">
          {text.slice(idx, idx + q.length)}
        </mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="top-1/4 translate-y-0 p-0 gap-0 w-full max-w-xl rounded-xl bg-[--color-paper] dark:bg-[--color-paper-dark] border border-[--color-border] dark:border-[--color-border-dark] overflow-hidden"
        showCloseButton={false}
        initialFocus={false}
      >
        {/* Header with scope toggle */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="text-sm font-medium text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
            Search verses
          </span>
          <div className="flex gap-1 text-xs">
            <button
              className={`px-2 py-1 rounded transition-colors ${
                searchScope === 'chapter'
                  ? 'bg-[--color-highlight] dark:bg-[--color-highlight-dark] text-[--color-ink] dark:text-[--color-ink-dark]'
                  : 'text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] hover:text-[--color-ink] dark:hover:text-[--color-ink-dark]'
              }`}
              onClick={() => setSearchScope('chapter')}
            >
              This chapter
            </button>
            <button
              className={`px-2 py-1 rounded transition-colors ${
                searchScope === 'global'
                  ? 'bg-[--color-highlight] dark:bg-[--color-highlight-dark] text-[--color-ink] dark:text-[--color-ink-dark]'
                  : 'text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] hover:text-[--color-ink] dark:hover:text-[--color-ink-dark]'
              }`}
              onClick={() => setSearchScope('global')}
            >
              All Bible
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="px-4 pb-2">
          <input
            id="search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            placeholder="Search for words or phrases..."
            className="w-full bg-transparent text-lg text-[--color-ink] dark:text-[--color-ink-dark] placeholder:text-[--color-ink-muted] dark:placeholder:text-[--color-ink-muted-dark] outline-none"
          />
        </div>

        <div className="border-t border-[--color-border] dark:border-[--color-border-dark]" />

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {query.length < 2 ? (
            <p className="px-4 py-6 text-center text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
              Type at least 2 characters to search
            </p>
          ) : loading ? (
            <p className="px-4 py-6 text-center text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
              Searching...
            </p>
          ) : results.length > 0 ? (
            <div className="p-2 space-y-1">
              {results.map((result) => {
                const book = bible.getBook(result.reference.book);
                return (
                  <button
                    key={`${result.reference.book}-${result.reference.chapter}-${result.reference.verse}`}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] transition-colors"
                    onClick={() => navigateToResult(result)}
                  >
                    <div className="text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] mb-0.5">
                      {book?.name} {result.reference.chapter}:{result.reference.verse}
                    </div>
                    <div className="text-sm text-[--color-ink] dark:text-[--color-ink-dark] line-clamp-2">
                      {highlightMatch(result.text, query)}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
              No results found
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[--color-border] dark:border-[--color-border-dark] px-4 py-2 text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] flex items-center gap-4">
          <span>
            <kbd className="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1">↵</kbd>{' '}
            select
          </span>
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
