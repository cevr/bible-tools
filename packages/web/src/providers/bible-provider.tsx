import {
  createContext,
  useContext,
  type ParentComponent,
  type Accessor,
  createSignal,
  createMemo,
} from 'solid-js';
import {
  bibleDataService,
  type Book,
  type Reference,
  type SearchResult,
  type Verse,
  formatReference,
  getBook,
  BOOKS,
} from '@/data/bible';

interface BibleContextValue {
  /**
   * Get all books of the Bible
   */
  books: Book[];

  /**
   * Get a specific book by number
   */
  getBook: (bookNumber: number) => Book | undefined;

  /**
   * Get all verses in a chapter
   */
  getChapter: (book: number, chapter: number) => Verse[];

  /**
   * Get a specific verse
   */
  getVerse: (book: number, chapter: number, verse: number) => Verse | undefined;

  /**
   * Parse a reference string (e.g., "john 3:16")
   */
  parseReference: (ref: string) => Reference | undefined;

  /**
   * Format a reference for display
   */
  formatReference: (ref: Reference) => string;

  /**
   * Get the next chapter reference
   */
  getNextChapter: (book: number, chapter: number) => Reference | undefined;

  /**
   * Get the previous chapter reference
   */
  getPrevChapter: (book: number, chapter: number) => Reference | undefined;

  /**
   * Search verses by text query
   */
  searchVerses: (query: string, limit?: number) => SearchResult[];
}

const BibleContext = createContext<BibleContextValue>();

/**
 * Provider for Bible data access.
 */
export const BibleProvider: ParentComponent = (props) => {
  const value: BibleContextValue = {
    books: BOOKS,
    getBook: (bookNumber) => bibleDataService.getBook(bookNumber),
    getChapter: (book, chapter) => bibleDataService.getChapter(book, chapter),
    getVerse: (book, chapter, verse) =>
      bibleDataService.getVerse(book, chapter, verse),
    parseReference: (ref) => bibleDataService.parseReference(ref),
    formatReference,
    getNextChapter: (book, chapter) =>
      bibleDataService.getNextChapter(book, chapter),
    getPrevChapter: (book, chapter) =>
      bibleDataService.getPrevChapter(book, chapter),
    searchVerses: (query, limit) => bibleDataService.searchVerses(query, limit),
  };

  return (
    <BibleContext.Provider value={value}>{props.children}</BibleContext.Provider>
  );
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
 */
export function useChapter(
  book: Accessor<number>,
  chapter: Accessor<number>
): Accessor<Verse[]> {
  const bible = useBible();
  return createMemo(() => bible.getChapter(book(), chapter()));
}

/**
 * Hook to get book info reactively.
 */
export function useBook(bookNumber: Accessor<number>): Accessor<Book | undefined> {
  const bible = useBible();
  return createMemo(() => bible.getBook(bookNumber()));
}
