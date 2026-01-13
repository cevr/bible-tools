/**
 * EGW Commentary Service
 *
 * Provides commentary lookup by Bible verse from the EGW Bible Commentary volumes (BC1-BC7).
 * Searches the EGW paragraph database for paragraphs that reference specific Bible verses.
 */

import { Data, Effect, Stream } from 'effect';

import { EGWParagraphDatabase } from '../egw-db/book-database.js';
import type * as EGWSchemas from '../egw/schemas.js';
import type {
  CommentaryEntry,
  CommentaryResult,
  VerseReference,
} from './types.js';

/**
 * Error types for the commentary service
 */
export class CommentaryError extends Data.TaggedError('CommentaryError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Union of all commentary errors
 */
export type CommentaryServiceError = CommentaryError;

/**
 * Bible book name mapping for parsing EGW references
 * Maps short names used in EGW Commentary to Bible book numbers (1-66)
 */
const BIBLE_BOOK_PATTERNS: Record<string, number> = {
  // Old Testament
  gen: 1,
  genesis: 1,
  ex: 2,
  exod: 2,
  exodus: 2,
  lev: 3,
  leviticus: 3,
  num: 4,
  numbers: 4,
  deut: 5,
  deuteronomy: 5,
  josh: 6,
  joshua: 6,
  judg: 7,
  judges: 7,
  ruth: 8,
  '1sam': 9,
  '1 sam': 9,
  '1 samuel': 9,
  '2sam': 10,
  '2 sam': 10,
  '2 samuel': 10,
  '1ki': 11,
  '1 ki': 11,
  '1 kings': 11,
  '2ki': 12,
  '2 ki': 12,
  '2 kings': 12,
  '1chr': 13,
  '1 chr': 13,
  '1 chronicles': 13,
  '2chr': 14,
  '2 chr': 14,
  '2 chronicles': 14,
  ezra: 15,
  neh: 16,
  nehemiah: 16,
  esth: 17,
  esther: 17,
  job: 18,
  ps: 19,
  psa: 19,
  psalm: 19,
  psalms: 19,
  prov: 20,
  proverbs: 20,
  eccl: 21,
  ecclesiastes: 21,
  song: 22,
  songs: 22,
  'song of solomon': 22,
  isa: 23,
  isaiah: 23,
  jer: 24,
  jeremiah: 24,
  lam: 25,
  lamentations: 25,
  ezek: 26,
  ezekiel: 26,
  dan: 27,
  daniel: 27,
  hos: 28,
  hosea: 28,
  joel: 29,
  amos: 30,
  obad: 31,
  obadiah: 31,
  jonah: 32,
  mic: 33,
  micah: 33,
  nah: 34,
  nahum: 34,
  hab: 35,
  habakkuk: 35,
  zeph: 36,
  zephaniah: 36,
  hag: 37,
  haggai: 37,
  zech: 38,
  zechariah: 38,
  mal: 39,
  malachi: 39,
  // New Testament
  matt: 40,
  matthew: 40,
  mark: 41,
  luke: 42,
  john: 43,
  acts: 44,
  rom: 45,
  romans: 45,
  '1cor': 46,
  '1 cor': 46,
  '1 corinthians': 46,
  '2cor': 47,
  '2 cor': 47,
  '2 corinthians': 47,
  gal: 48,
  galatians: 48,
  eph: 49,
  ephesians: 49,
  phil: 50,
  philippians: 50,
  col: 51,
  colossians: 51,
  '1thess': 52,
  '1 thess': 52,
  '1 thessalonians': 52,
  '2thess': 53,
  '2 thess': 53,
  '2 thessalonians': 53,
  '1tim': 54,
  '1 tim': 54,
  '1 timothy': 54,
  '2tim': 55,
  '2 tim': 55,
  '2 timothy': 55,
  titus: 56,
  philem: 57,
  philemon: 57,
  heb: 58,
  hebrews: 58,
  james: 59,
  '1pet': 60,
  '1 pet': 60,
  '1 peter': 60,
  '2pet': 61,
  '2 pet': 61,
  '2 peter': 61,
  '1john': 62,
  '1 john': 62,
  '2john': 63,
  '2 john': 63,
  '3john': 64,
  '3 john': 64,
  jude: 65,
  rev: 66,
  revelation: 66,
};

/**
 * Bible Commentary volume to Bible book mapping
 * BC1: Genesis - Deuteronomy (1-5)
 * BC2: Joshua - 2 Kings (6-12)
 * BC3: 1 Chronicles - Song of Solomon (13-22)
 * BC4: Isaiah - Malachi (23-39)
 * BC5: Matthew - John (40-43)
 * BC6: Acts - Ephesians (44-49)
 * BC7: Philippians - Revelation (50-66)
 */
const BC_VOLUME_TO_BOOKS: Record<string, readonly number[]> = {
  '1BC': [1, 2, 3, 4, 5],
  '2BC': [6, 7, 8, 9, 10, 11, 12],
  '3BC': [13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
  '4BC': [23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39],
  '5BC': [40, 41, 42, 43],
  '6BC': [44, 45, 46, 47, 48, 49],
  '7BC': [50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66],
};

/**
 * Get the BC volume for a given Bible book number
 */
function getBCVolumeForBook(bookNum: number): string | undefined {
  for (const [volume, books] of Object.entries(BC_VOLUME_TO_BOOKS)) {
    if (books.includes(bookNum)) {
      return volume;
    }
  }
  return undefined;
}

/**
 * Convert EGW paragraph to commentary entry
 */
function paragraphToEntry(
  para: EGWSchemas.Paragraph,
  bookCode: string,
  bookTitle: string,
): CommentaryEntry {
  return {
    refcode: para.refcode_short ?? para.refcode_long ?? '',
    bookCode,
    bookTitle,
    content: para.content ?? '',
    puborder: para.puborder,
  };
}

/**
 * Check if paragraph content references a specific Bible verse
 * Looks for patterns like "Genesis 1:1" or "Gen. 1:1" in the content
 */
function paragraphReferencesVerse(
  content: string,
  verse: VerseReference,
): boolean {
  // This is a simplified check - in practice, we'd want more sophisticated parsing
  // For now, we'll search based on the verse being mentioned
  const lowerContent = content.toLowerCase();

  // Find Bible book name in content
  for (const [pattern, bookNum] of Object.entries(BIBLE_BOOK_PATTERNS)) {
    if (bookNum === verse.book) {
      // Look for patterns like "Genesis 1:1" or "Gen 1:1"
      const regex = new RegExp(
        `${pattern}\\.?\\s+${verse.chapter}:${verse.verse}\\b`,
        'i',
      );
      if (regex.test(lowerContent)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * EGW Commentary Service
 *
 * Provides commentary lookup from EGW Bible Commentary volumes.
 */
export class EGWCommentaryService extends Effect.Service<EGWCommentaryService>()(
  'egw-commentary/EGWCommentaryService',
  {
    effect: Effect.gen(function* () {
      const db = yield* EGWParagraphDatabase;

      /**
       * Get commentary for a specific Bible verse
       */
      const getCommentary = (
        verse: VerseReference,
      ): Effect.Effect<CommentaryResult, CommentaryServiceError> =>
        Effect.gen(function* () {
          // Determine which BC volume to search
          const bcVolume = getBCVolumeForBook(verse.book);
          if (!bcVolume) {
            return { verse, entries: [] };
          }

          // Search paragraphs from the relevant BC volume
          const entries = yield* db
            .getParagraphsByAuthor('Ellen Gould White')
            .pipe(
              Stream.filter((para) => {
                // Check if this paragraph is from the right BC volume
                const refcode = para.refcode_short ?? para.refcode_long ?? '';
                if (!refcode.toUpperCase().startsWith(bcVolume)) {
                  return false;
                }

                // Check if content references the verse
                const content = para.content ?? '';
                return paragraphReferencesVerse(content, verse);
              }),
              Stream.take(20), // Limit results
              Stream.map((para) =>
                paragraphToEntry(
                  para,
                  bcVolume,
                  `Bible Commentary Volume ${bcVolume.charAt(0)}`,
                ),
              ),
              Stream.runCollect,
              Effect.map((chunk) => [...chunk]),
              Effect.mapError(
                (e) =>
                  new CommentaryError({
                    message: 'Failed to get commentary',
                    cause: e,
                  }),
              ),
            );

          return { verse, entries };
        });

      /**
       * Search commentary by text query
       */
      const searchCommentary = (
        query: string,
        limit: number = 20,
      ): Effect.Effect<readonly CommentaryEntry[], CommentaryServiceError> =>
        db.getParagraphsByAuthor('Ellen Gould White').pipe(
          Stream.filter((para) => {
            // Only search BC volumes
            const refcode = para.refcode_short ?? para.refcode_long ?? '';
            const isBCVolume = /^[1-7]BC/i.test(refcode);
            if (!isBCVolume) return false;

            // Check content matches query
            const content = para.content ?? '';
            return content.toLowerCase().includes(query.toLowerCase());
          }),
          Stream.take(limit),
          Stream.map((para) => {
            const refcode = para.refcode_short ?? para.refcode_long ?? '';
            const bcVolume = refcode.substring(0, 3).toUpperCase();
            return paragraphToEntry(
              para,
              bcVolume,
              `Bible Commentary Volume ${bcVolume.charAt(0)}`,
            );
          }),
          Stream.runCollect,
          Effect.map((chunk) => [...chunk]),
          Effect.mapError(
            (e) =>
              new CommentaryError({
                message: 'Failed to search commentary',
                cause: e,
              }),
          ),
        );

      return {
        getCommentary,
        searchCommentary,
      } as const;
    }),
    dependencies: [EGWParagraphDatabase.Default],
  },
) {}
