import { createContext, useContext, type ReactNode } from 'react';
import { bibleDataService, type Book, type Reference, formatReference, BOOKS } from '@/data/bible';

interface BibleContextValue {
  books: readonly Book[];
  getBook: (bookNumber: number) => Book | undefined;
  parseReference: (ref: string) => Reference | undefined;
  formatReference: (ref: Reference) => string;
  getNextChapter: (book: number, chapter: number) => Reference | undefined;
  getPrevChapter: (book: number, chapter: number) => Reference | undefined;
}

const BibleContext = createContext<BibleContextValue | null>(null);

const value: BibleContextValue = {
  books: BOOKS,
  getBook: (bookNumber) => bibleDataService.getBook(bookNumber),
  parseReference: (ref) => bibleDataService.parseReference(ref),
  formatReference,
  getNextChapter: (book, chapter) => bibleDataService.getNextChapter(book, chapter),
  getPrevChapter: (book, chapter) => bibleDataService.getPrevChapter(book, chapter),
};

export function BibleProvider({ children }: { children: ReactNode }) {
  return <BibleContext.Provider value={value}>{children}</BibleContext.Provider>;
}

export function useBible(): BibleContextValue {
  const ctx = useContext(BibleContext);
  if (!ctx) throw new Error('useBible must be used within a BibleProvider');
  return ctx;
}
