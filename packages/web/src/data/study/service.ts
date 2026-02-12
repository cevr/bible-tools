/**
 * Study Data Service
 *
 * Provides cross-references, Strong's concordance, margin notes, and verse words
 * from local SQLite. Merges bible.db cross-refs with state.db classifications
 * and user cross-refs (ported from CLI's cross-refs.ts).
 */

import type { DbClient } from '@/workers/db-client.js';

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

export interface ClassifiedCrossReference {
  book: number;
  chapter: number;
  verse: number | null;
  verseEnd: number | null;
  source: 'openbible' | 'tske' | 'user';
  previewText: string | null;
  classification: CrossRefType | null;
  confidence: number | null;
  isUserAdded: boolean;
  userNote: string | null;
  userRefId: string | null;
}

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

interface CrossRefRow {
  ref_book: number;
  ref_chapter: number;
  ref_verse: number | null;
  ref_verse_end: number | null;
  source: string;
  preview_text: string | null;
}

interface ClassificationRow {
  ref_book: number;
  ref_chapter: number;
  ref_verse: number | null;
  type: string;
  confidence: number | null;
}

interface UserCrossRefRow {
  id: string;
  ref_book: number;
  ref_chapter: number;
  ref_verse: number | null;
  ref_verse_end: number | null;
  type: string | null;
  note: string | null;
  created_at: number;
}

interface StrongsRow {
  number: string;
  language: string;
  lemma: string;
  transliteration: string | null;
  pronunciation: string | null;
  definition: string;
  kjv_definition: string | null;
}

interface VerseWordRow {
  word_index: number;
  word_text: string;
  strongs_numbers: string | null;
}

interface MarginNoteRow {
  verse?: number;
  note_index: number;
  note_type: string;
  phrase: string;
  note_text: string;
}

interface ConcordanceRow {
  book: number;
  chapter: number;
  verse: number;
  word_text: string | null;
}

export interface StudyDataService {
  getCrossRefs(book: number, chapter: number, verse: number): Promise<ClassifiedCrossReference[]>;
  getStrongsEntry(number: string): Promise<StrongsEntry | null>;
  getVerseWords(book: number, chapter: number, verse: number): Promise<VerseWord[]>;
  getMarginNotes(book: number, chapter: number, verse: number): Promise<MarginNote[]>;
  getChapterMarginNotes(book: number, chapter: number): Promise<Map<number, MarginNote[]>>;
  searchByStrongs(number: string): Promise<ConcordanceResult[]>;
  setRefType(
    source: { book: number; chapter: number; verse: number },
    target: { book: number; chapter: number; verse: number | null },
    type: CrossRefType,
  ): Promise<void>;
  addUserCrossRef(
    source: { book: number; chapter: number; verse: number },
    target: { book: number; chapter: number; verse?: number; verseEnd?: number },
    opts?: { type?: CrossRefType; note?: string },
  ): Promise<UserCrossRef>;
  removeUserCrossRef(id: string): Promise<void>;
}

export function createStudyDataService(db: DbClient): StudyDataService {
  function classificationKey(book: number, chapter: number, verse: number | null): string {
    return `${book}:${chapter}:${verse ?? 0}`;
  }

  return {
    async getCrossRefs(
      book: number,
      chapter: number,
      verse: number,
    ): Promise<ClassifiedCrossReference[]> {
      // 1. Get bible.db cross-refs
      const rawRefs = await db.query<CrossRefRow>(
        'bible',
        `SELECT ref_book, ref_chapter, ref_verse, ref_verse_end, source, preview_text
         FROM cross_refs
         WHERE book = ? AND chapter = ? AND verse = ?`,
        [book, chapter, verse],
      );

      // 2. Get state.db classifications
      const classifications = await db.query<ClassificationRow>(
        'state',
        `SELECT ref_book, ref_chapter, ref_verse, type, confidence
         FROM cross_ref_classifications
         WHERE source_book = ? AND source_chapter = ? AND source_verse = ?`,
        [book, chapter, verse],
      );

      const classMap = new Map<string, ClassificationRow>();
      for (const c of classifications) {
        classMap.set(classificationKey(c.ref_book, c.ref_chapter, c.ref_verse), c);
      }

      // 3. Enrich refs with classifications
      const enriched: ClassifiedCrossReference[] = rawRefs.map((r) => {
        const key = classificationKey(r.ref_book, r.ref_chapter, r.ref_verse);
        const cls = classMap.get(key);
        return {
          book: r.ref_book,
          chapter: r.ref_chapter,
          verse: r.ref_verse,
          verseEnd: r.ref_verse_end,
          source: r.source as 'openbible' | 'tske',
          previewText: r.preview_text,
          classification: (cls?.type as CrossRefType) ?? null,
          confidence: cls?.confidence ?? null,
          isUserAdded: false,
          userNote: null,
          userRefId: null,
        };
      });

      // 4. Append user cross-refs
      const userRefs = await db.query<UserCrossRefRow>(
        'state',
        `SELECT id, ref_book, ref_chapter, ref_verse, ref_verse_end, type, note, created_at
         FROM user_cross_refs
         WHERE source_book = ? AND source_chapter = ? AND source_verse = ?`,
        [book, chapter, verse],
      );

      for (const u of userRefs) {
        enriched.push({
          book: u.ref_book,
          chapter: u.ref_chapter,
          verse: u.ref_verse,
          verseEnd: u.ref_verse_end,
          source: 'user',
          previewText: null,
          classification: (u.type as CrossRefType) ?? null,
          confidence: null,
          isUserAdded: true,
          userNote: u.note,
          userRefId: u.id,
        });
      }

      return enriched;
    },

    async getStrongsEntry(number: string): Promise<StrongsEntry | null> {
      const rows = await db.query<StrongsRow>(
        'bible',
        'SELECT number, language, lemma, transliteration, pronunciation, definition, kjv_definition FROM strongs WHERE number = ?',
        [number],
      );
      const r = rows[0];
      if (!r) return null;
      return {
        number: r.number,
        language: r.language as 'hebrew' | 'greek',
        lemma: r.lemma,
        transliteration: r.transliteration,
        pronunciation: r.pronunciation,
        definition: r.definition,
        kjvDefinition: r.kjv_definition,
      };
    },

    async getVerseWords(book: number, chapter: number, verse: number): Promise<VerseWord[]> {
      const rows = await db.query<VerseWordRow>(
        'bible',
        'SELECT word_index, word_text, strongs_numbers FROM verse_words WHERE book = ? AND chapter = ? AND verse = ? ORDER BY word_index',
        [book, chapter, verse],
      );
      return rows.map((r) => ({
        wordIndex: r.word_index,
        wordText: r.word_text,
        strongsNumbers: r.strongs_numbers ? JSON.parse(r.strongs_numbers) : null,
      }));
    },

    async getMarginNotes(book: number, chapter: number, verse: number): Promise<MarginNote[]> {
      const rows = await db.query<MarginNoteRow>(
        'bible',
        'SELECT note_index, note_type, phrase, note_text FROM margin_notes WHERE book = ? AND chapter = ? AND verse = ? ORDER BY note_index',
        [book, chapter, verse],
      );
      return rows.map((r) => ({
        noteIndex: r.note_index,
        noteType: r.note_type,
        phrase: r.phrase,
        noteText: r.note_text,
      }));
    },

    async getChapterMarginNotes(book: number, chapter: number): Promise<Map<number, MarginNote[]>> {
      const rows = await db.query<MarginNoteRow>(
        'bible',
        'SELECT verse, note_index, note_type, phrase, note_text FROM margin_notes WHERE book = ? AND chapter = ? ORDER BY verse, note_index',
        [book, chapter],
      );
      const map = new Map<number, MarginNote[]>();
      for (const r of rows) {
        const v = r.verse ?? 0;
        let arr = map.get(v);
        if (!arr) {
          arr = [];
          map.set(v, arr);
        }
        arr.push({
          noteIndex: r.note_index,
          noteType: r.note_type,
          phrase: r.phrase,
          noteText: r.note_text,
        });
      }
      return map;
    },

    async searchByStrongs(number: string): Promise<ConcordanceResult[]> {
      const rows = await db.query<ConcordanceRow>(
        'bible',
        'SELECT book, chapter, verse, word_text FROM strongs_verses WHERE strongs_number = ? ORDER BY book, chapter, verse',
        [number],
      );
      return rows.map((r) => ({
        book: r.book,
        chapter: r.chapter,
        verse: r.verse,
        wordText: r.word_text,
      }));
    },

    async setRefType(source, target, type): Promise<void> {
      await db.exec(
        `INSERT INTO cross_ref_classifications
           (source_book, source_chapter, source_verse, ref_book, ref_chapter, ref_verse, type, confidence, classified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)
         ON CONFLICT(source_book, source_chapter, source_verse, ref_book, ref_chapter, ref_verse)
         DO UPDATE SET type = excluded.type, classified_at = excluded.classified_at`,
        [
          source.book,
          source.chapter,
          source.verse,
          target.book,
          target.chapter,
          target.verse ?? 0,
          type,
          Date.now(),
        ],
      );
    },

    async addUserCrossRef(source, target, opts): Promise<UserCrossRef> {
      const id = crypto.randomUUID();
      const createdAt = Date.now();
      await db.exec(
        `INSERT INTO user_cross_refs
           (id, source_book, source_chapter, source_verse, ref_book, ref_chapter, ref_verse, ref_verse_end, type, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          source.book,
          source.chapter,
          source.verse,
          target.book,
          target.chapter,
          target.verse ?? null,
          target.verseEnd ?? null,
          opts?.type ?? null,
          opts?.note ?? null,
          createdAt,
        ],
      );
      return {
        id,
        refBook: target.book,
        refChapter: target.chapter,
        refVerse: target.verse ?? null,
        refVerseEnd: target.verseEnd ?? null,
        type: opts?.type ?? null,
        note: opts?.note ?? null,
        createdAt,
      };
    },

    async removeUserCrossRef(id: string): Promise<void> {
      await db.exec('DELETE FROM user_cross_refs WHERE id = ?', [id]);
    },
  };
}
