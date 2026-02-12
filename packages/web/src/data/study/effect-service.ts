import { Context, Effect, Layer } from 'effect';
import { DbClientService } from '../db-client-service';
import type { DatabaseQueryError } from '../errors';
import type {
  ClassifiedCrossReference,
  ConcordanceResult,
  CrossRefType,
  MarginNote,
  StrongsEntry,
  UserCrossRef,
  VerseWord,
} from './service';

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

function classificationKey(book: number, chapter: number, verse: number | null): string {
  return `${book}:${chapter}:${verse ?? 0}`;
}

interface WebStudyDataServiceShape {
  readonly getCrossRefs: (
    book: number,
    chapter: number,
    verse: number,
  ) => Effect.Effect<ClassifiedCrossReference[], DatabaseQueryError>;

  readonly getStrongsEntry: (
    number: string,
  ) => Effect.Effect<StrongsEntry | null, DatabaseQueryError>;

  readonly getVerseWords: (
    book: number,
    chapter: number,
    verse: number,
  ) => Effect.Effect<VerseWord[], DatabaseQueryError>;

  readonly getMarginNotes: (
    book: number,
    chapter: number,
    verse: number,
  ) => Effect.Effect<MarginNote[], DatabaseQueryError>;

  readonly getChapterMarginNotes: (
    book: number,
    chapter: number,
  ) => Effect.Effect<Map<number, MarginNote[]>, DatabaseQueryError>;

  readonly searchByStrongs: (
    number: string,
  ) => Effect.Effect<ConcordanceResult[], DatabaseQueryError>;

  readonly setRefType: (
    source: { book: number; chapter: number; verse: number },
    target: { book: number; chapter: number; verse: number | null },
    type: CrossRefType,
  ) => Effect.Effect<void, DatabaseQueryError>;

  readonly addUserCrossRef: (
    source: { book: number; chapter: number; verse: number },
    target: { book: number; chapter: number; verse?: number; verseEnd?: number },
    opts?: { type?: CrossRefType; note?: string },
  ) => Effect.Effect<UserCrossRef, DatabaseQueryError>;

  readonly removeUserCrossRef: (id: string) => Effect.Effect<void, DatabaseQueryError>;
}

export class WebStudyDataService extends Context.Tag('@bible-web/StudyData')<
  WebStudyDataService,
  WebStudyDataServiceShape
>() {
  static Live = Layer.effect(
    WebStudyDataService,
    Effect.gen(function* () {
      const db = yield* DbClientService;

      const getCrossRefs = Effect.fn('WebStudyDataService.getCrossRefs')(function* (
        book: number,
        chapter: number,
        verse: number,
      ) {
        // Parallelize: rawRefs, classifications, and userRefs are independent
        const [rawRefs, classifications, userRefs] = yield* Effect.all(
          [
            db.query<CrossRefRow>(
              'bible',
              `SELECT ref_book, ref_chapter, ref_verse, ref_verse_end, source, preview_text
               FROM cross_refs
               WHERE book = ? AND chapter = ? AND verse = ?`,
              [book, chapter, verse],
            ),
            db.query<ClassificationRow>(
              'state',
              `SELECT ref_book, ref_chapter, ref_verse, type, confidence
               FROM cross_ref_classifications
               WHERE source_book = ? AND source_chapter = ? AND source_verse = ?`,
              [book, chapter, verse],
            ),
            db.query<UserCrossRefRow>(
              'state',
              `SELECT id, ref_book, ref_chapter, ref_verse, ref_verse_end, type, note, created_at
               FROM user_cross_refs
               WHERE source_book = ? AND source_chapter = ? AND source_verse = ?`,
              [book, chapter, verse],
            ),
          ],
          { concurrency: 'unbounded' },
        );

        const classMap = new Map<string, ClassificationRow>();
        for (const c of classifications) {
          classMap.set(classificationKey(c.ref_book, c.ref_chapter, c.ref_verse), c);
        }

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
          };
        });

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
            userRefId: u.id,
            userNote: u.note,
          });
        }

        return enriched;
      });

      const getStrongsEntry = Effect.fn('WebStudyDataService.getStrongsEntry')(function* (
        num: string,
      ) {
        const rows = yield* db.query<StrongsRow>(
          'bible',
          'SELECT number, language, lemma, transliteration, pronunciation, definition, kjv_definition FROM strongs WHERE number = ?',
          [num],
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
        } satisfies StrongsEntry;
      });

      const getVerseWords = Effect.fn('WebStudyDataService.getVerseWords')(function* (
        book: number,
        chapter: number,
        verse: number,
      ) {
        const rows = yield* db.query<VerseWordRow>(
          'bible',
          'SELECT word_index, word_text, strongs_numbers FROM verse_words WHERE book = ? AND chapter = ? AND verse = ? ORDER BY word_index',
          [book, chapter, verse],
        );
        return rows.map((r): VerseWord => {
          let strongsNumbers: string[] | null = null;
          if (r.strongs_numbers) {
            try {
              strongsNumbers = JSON.parse(r.strongs_numbers);
            } catch {
              // Malformed JSON — skip rather than crash
              strongsNumbers = null;
            }
          }
          return {
            wordIndex: r.word_index,
            wordText: r.word_text,
            strongsNumbers,
          };
        });
      });

      const getMarginNotes = Effect.fn('WebStudyDataService.getMarginNotes')(function* (
        book: number,
        chapter: number,
        verse: number,
      ) {
        const rows = yield* db.query<MarginNoteRow>(
          'bible',
          'SELECT note_index, note_type, phrase, note_text FROM margin_notes WHERE book = ? AND chapter = ? AND verse = ? ORDER BY note_index',
          [book, chapter, verse],
        );
        return rows.map(
          (r): MarginNote => ({
            noteIndex: r.note_index,
            noteType: r.note_type,
            phrase: r.phrase,
            noteText: r.note_text,
          }),
        );
      });

      const getChapterMarginNotes = Effect.fn('WebStudyDataService.getChapterMarginNotes')(
        function* (book: number, chapter: number) {
          const rows = yield* db.query<MarginNoteRow>(
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
      );

      const searchByStrongs = Effect.fn('WebStudyDataService.searchByStrongs')(function* (
        num: string,
      ) {
        const rows = yield* db.query<ConcordanceRow>(
          'bible',
          'SELECT book, chapter, verse, word_text FROM strongs_verses WHERE strongs_number = ? ORDER BY book, chapter, verse',
          [num],
        );
        return rows.map(
          (r): ConcordanceResult => ({
            book: r.book,
            chapter: r.chapter,
            verse: r.verse,
            wordText: r.word_text,
          }),
        );
      });

      const setRefType = Effect.fn('WebStudyDataService.setRefType')(function* (
        source: { book: number; chapter: number; verse: number },
        target: { book: number; chapter: number; verse: number | null },
        type: CrossRefType,
      ) {
        yield* db.exec(
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
      });

      const addUserCrossRef = Effect.fn('WebStudyDataService.addUserCrossRef')(function* (
        source: { book: number; chapter: number; verse: number },
        target: { book: number; chapter: number; verse?: number; verseEnd?: number },
        opts?: { type?: CrossRefType; note?: string },
      ) {
        const id = crypto.randomUUID();
        const createdAt = Date.now();
        yield* db.exec(
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
        } satisfies UserCrossRef;
      });

      const removeUserCrossRef = Effect.fn('WebStudyDataService.removeUserCrossRef')(function* (
        id: string,
      ) {
        yield* db.exec('DELETE FROM user_cross_refs WHERE id = ?', [id]);
      });

      return WebStudyDataService.of({
        getCrossRefs,
        getStrongsEntry,
        getVerseWords,
        getMarginNotes,
        getChapterMarginNotes,
        searchByStrongs,
        setRefType,
        addUserCrossRef,
        removeUserCrossRef,
      });
    }),
  );
}
