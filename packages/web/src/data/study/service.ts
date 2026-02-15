/**
 * Study Data Types
 *
 * Domain types for cross-references, Strong's concordance, margin notes,
 * verse words, markers, notes, collections, and EGW commentary.
 *
 * Implementation lives in effect-service.ts (WebStudyDataService).
 */

export const CROSS_REF_TYPES = [
  'quotation',
  'allusion',
  'parallel',
  'typological',
  'prophecy',
  'sanctuary',
  'recapitulation',
  'thematic',
] as const;

export type CrossRefType = (typeof CROSS_REF_TYPES)[number];

interface CrossRefBase {
  book: number;
  chapter: number;
  verse: number | null;
  verseEnd: number | null;
  previewText: string | null;
  classification: CrossRefType | null;
  confidence: number | null;
}

export interface CatalogCrossReference extends CrossRefBase {
  source: 'openbible' | 'tske';
}

export interface UserCrossReference extends CrossRefBase {
  source: 'user';
  userRefId: string;
  userNote: string | null;
}

export type ClassifiedCrossReference = CatalogCrossReference | UserCrossReference;

export interface StrongsEntry {
  number: string;
  language: 'hebrew' | 'greek';
  lemma: string;
  transliteration: string | null;
  pronunciation: string | null;
  definition: string;
  kjvDefinition: string | null;
}

export interface VerseWord {
  wordIndex: number;
  wordText: string;
  strongsNumbers: string[] | null;
}

export interface MarginNote {
  noteIndex: number;
  noteType: string;
  phrase: string;
  noteText: string;
}

export interface ConcordanceResult {
  book: number;
  chapter: number;
  verse: number;
  wordText: string | null;
}

export type MarkerColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple';

export interface VerseMarker {
  id: string;
  book: number;
  chapter: number;
  verse: number;
  color: MarkerColor;
  createdAt: number;
}

export interface VerseNote {
  id: string;
  book: number;
  chapter: number;
  verse: number;
  content: string;
  createdAt: number;
}

export interface StudyCollection {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  createdAt: number;
}

export interface CollectionVerse {
  collectionId: string;
  book: number;
  chapter: number;
  verse: number;
  addedAt: number;
}

export interface EGWCommentaryEntry {
  refcode: string;
  bookCode: string;
  bookTitle: string;
  content: string;
  puborder: number;
  source: 'indexed' | 'search';
}

export interface EGWContextParagraph {
  refcode: string;
  bookCode: string;
  content: string;
  puborder: number;
}

export interface EgwNote {
  id: string;
  bookCode: string;
  puborder: number;
  content: string;
  createdAt: number;
}

export interface EgwMarker {
  id: string;
  bookCode: string;
  puborder: number;
  color: MarkerColor;
  createdAt: number;
}

export interface UserCrossRef {
  id: string;
  refBook: number;
  refChapter: number;
  refVerse: number | null;
  refVerseEnd: number | null;
  type: CrossRefType | null;
  note: string | null;
  createdAt: number;
}
