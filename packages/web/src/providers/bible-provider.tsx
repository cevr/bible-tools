import {
  createContext,
  useContext,
  type ParentComponent,
  type Accessor,
  createMemo,
  createResource,
  type Resource,
} from 'solid-js';
import {
  bibleDataService,
  fetchVerses,
  searchVerses as searchVersesApi,
  type Book,
  type Reference,
  type SearchResult,
  type Verse,
  formatReference,
  BOOKS,
} from '@/data/bible';

interface BibleContextValue {
  /**
   * Get all books of the Bible (sync - static data)
   */
  books: readonly Book[];

  /**
   * Get a specific book by number (sync - static data)
   */
  getBook: (bookNumber: number) => Book | undefined;

  /**
   * Parse a reference string (e.g., "john 3:16") (sync)
   */
  parseReference: (ref: string) => Reference | undefined;

  /**
   * Format a reference for display (sync)
   */
  formatReference: (ref: Reference) => string;

  /**
   * Get the next chapter reference (sync)
   */
  getNextChapter: (book: number, chapter: number) => Reference | undefined;

  /**
   * Get the previous chapter reference (sync)
   */
  getPrevChapter: (book: number, chapter: number) => Reference | undefined;
}

const BibleContext = createContext<BibleContextValue>();

/**
 * Provider for Bible data access.
 * Book metadata is synchronous, verse/chapter data uses createResource.
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
 * Hook to access Bible data.
 */
export function useBible(): BibleContextValue {
  const ctx = useContext(BibleContext);
  if (!ctx) {
    throw new Error('useBible must be used within a BibleProvider');
  }
  return ctx;
}

/**
 * Hook to get chapter data reactively based on book and chapter numbers.
 * Returns a Resource that automatically fetches from the API.
 */
export function useChapter(
  book: Accessor<number>,
  chapter: Accessor<number>,
): Resource<readonly Verse[]> {
  const [verses] = createResource(
    () => ({ book: book(), chapter: chapter() }),
    async ({ book, chapter }) => fetchVerses(book, chapter),
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
 * Hook for searching verses.
 * Returns a Resource that fetches search results from the API.
 */
export function useSearch(
  query: Accessor<string>,
  limit?: number,
): Resource<readonly SearchResult[]> {
  const [results] = createResource(
    () => query(),
    async (q) => searchVersesApi(q, limit),
  );
  return results;
}
