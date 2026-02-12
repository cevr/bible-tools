import {
  createContext,
  useContext,
  type ParentComponent,
  type Accessor,
  createMemo,
  createResource,
  type Resource,
} from 'solid-js';
import { Effect } from 'effect';
import {
  bibleDataService,
  type Book,
  type Reference,
  type SearchResult,
  type Verse,
  formatReference,
  BOOKS,
} from '@/data/bible';
import { WebBibleService } from '@/data/bible/effect-service';
import { useRuntime } from './db-provider';

interface BibleContextValue {
  books: readonly Book[];
  getBook: (bookNumber: number) => Book | undefined;
  parseReference: (ref: string) => Reference | undefined;
  formatReference: (ref: Reference) => string;
  getNextChapter: (book: number, chapter: number) => Reference | undefined;
  getPrevChapter: (book: number, chapter: number) => Reference | undefined;
}

const BibleContext = createContext<BibleContextValue>();

/**
 * Provider for Bible data access.
 * Book metadata is synchronous, verse/chapter data uses Effect services.
 */
export const BibleProvider: ParentComponent = (props) => {
  const value: BibleContextValue = {
    books: BOOKS,
    getBook: (bookNumber) => bibleDataService.getBook(bookNumber),
    parseReference: (ref) => bibleDataService.parseReference(ref),
    formatReference,
    getNextChapter: (book, chapter) => bibleDataService.getNextChapter(book, chapter),
    getPrevChapter: (book, chapter) => bibleDataService.getPrevChapter(book, chapter),
  };

  return <BibleContext.Provider value={value}>{props.children}</BibleContext.Provider>;
};

/**
 * Hook to access Bible data (sync methods).
 */
export function useBible(): BibleContextValue {
  const ctx = useContext(BibleContext);
  if (!ctx) {
    throw new Error('useBible must be used within a BibleProvider');
  }
  return ctx;
}

/**
 * Hook to get chapter data reactively via Effect service.
 */
export function useChapter(
  book: Accessor<number>,
  chapter: Accessor<number>,
): Resource<readonly Verse[]> {
  const runtime = useRuntime();
  const [verses] = createResource(
    () => ({ book: book(), chapter: chapter() }),
    async ({ book, chapter }) =>
      runtime.runPromise(Effect.flatMap(WebBibleService, (s) => s.fetchVerses(book, chapter))),
  );
  return verses;
}

/**
 * Hook to get book info reactively.
 */
export function useBook(bookNumber: Accessor<number>): Accessor<Book | undefined> {
  const bible = useBible();
  return createMemo(() => bible.getBook(bookNumber()));
}

/**
 * Hook for searching verses via Effect service.
 */
export function useSearch(
  query: Accessor<string>,
  limit?: number,
): Resource<readonly SearchResult[]> {
  const runtime = useRuntime();
  const [results] = createResource(
    () => query(),
    async (q) =>
      runtime.runPromise(Effect.flatMap(WebBibleService, (s) => s.searchVerses(q, limit))),
  );
  return results;
}
