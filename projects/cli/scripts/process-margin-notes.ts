/**
 * Process KJV 1611 Margin Notes from TEI-XML files.
 *
 * Source: lb42/KJV_1611 repository (TEI-conformant 1611 text)
 * The XML files contain margin notes in <note> elements within <ab n="verse"> elements.
 *
 * Note types:
 * - Hebrew/Greek literals: "Heb. peace.", "Hebr. betweene the light..."
 * - Alternative readings: "Or, scant not.", "Or, creditour."
 * - Cross-references: "Psal.33.6.", "Gen.1.1." (we skip these, already have cross-refs)
 * - Combined: "Heb. once hither, and once thither."
 *
 * Output: assets/margin-notes.json
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const KJV_1611_PATH = join(process.env.HOME!, '.cache/repo/lb42/KJV_1611/chaps');
const ASSETS = join(import.meta.dir, '../assets');

// Book name mapping from KJV 1611 filenames to book numbers
const BOOK_NAME_MAP: Record<string, number> = {
  'Genesis': 1, 'Exodus': 2, 'Leviticus': 3, 'Numbers': 4, 'Deuteronomy': 5,
  'Joshua': 6, 'Judges': 7, 'Ruth': 8, '1-Samuel': 9, '2-Samuel': 10,
  '1-Kings': 11, '2-Kings': 12, '1-Chronicles': 13, '2-Chronicles': 14, 'Ezra': 15,
  'Nehemiah': 16, 'Esther': 17, 'Job': 18, 'Psalms': 19, 'Proverbs': 20,
  'Ecclesiastes': 21, 'Song-of-Solomon': 22, 'Isaiah': 23, 'Jeremiah': 24, 'Lamentations': 25,
  'Ezekiel': 26, 'Daniel': 27, 'Hosea': 28, 'Joel': 29, 'Amos': 30,
  'Obadiah': 31, 'Jonah': 32, 'Micah': 33, 'Nahum': 34, 'Habakkuk': 35,
  'Zephaniah': 36, 'Haggai': 37, 'Zechariah': 38, 'Malachi': 39,
  'Matthew': 40, 'Mark': 41, 'Luke': 42, 'John': 43, 'Acts': 44,
  'Romans': 45, '1-Corinthians': 46, '2-Corinthians': 47, 'Galatians': 48, 'Ephesians': 49,
  'Philippians': 50, 'Colossians': 51, '1-Thessalonians': 52, '2-Thessalonians': 53, '1-Timothy': 54,
  '2-Timothy': 55, 'Titus': 56, 'Philemon': 57, 'Hebrews': 58, 'James': 59,
  '1-Peter': 60, '2-Peter': 61, '1-John': 62, '2-John': 63, '3-John': 64,
  'Jude': 65, 'Revelation': 66,
};

// Note type classification patterns
const HEBREW_PATTERNS = [/^Heb\.?\s/i, /^Hebr\.?\s/i, /^Hebrew\.?\s/i];
const GREEK_PATTERNS = [/^Gr\.?\s/i, /^Greek\.?\s/i];
const ALTERNATE_PATTERNS = [/^Or,?\s/i, /^Or:/i];
// Cross-ref patterns - these look like book references
const CROSSREF_PATTERN = /^[A-Z0-9][a-z]*\.?\s*\d+[.:]/;

interface MarginNote {
  type: 'hebrew' | 'greek' | 'alternate' | 'other';
  text: string;
}

interface VerseNotes {
  book: number;
  chapter: number;
  verse: number;
  notes: MarginNote[];
}

/**
 * Classify a note's type based on its content
 */
function classifyNote(text: string): 'hebrew' | 'greek' | 'alternate' | 'crossref' | 'other' {
  const trimmed = text.trim();

  // Check for Hebrew
  for (const pattern of HEBREW_PATTERNS) {
    if (pattern.test(trimmed)) return 'hebrew';
  }

  // Check for Greek
  for (const pattern of GREEK_PATTERNS) {
    if (pattern.test(trimmed)) return 'greek';
  }

  // Check for alternate readings
  for (const pattern of ALTERNATE_PATTERNS) {
    if (pattern.test(trimmed)) return 'alternate';
  }

  // Check for cross-references (we'll skip these)
  if (CROSSREF_PATTERN.test(trimmed)) return 'crossref';

  return 'other';
}

/**
 * Clean note text: decode entities, normalize whitespace
 */
function cleanNoteText(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse a chapter XML file and extract margin notes
 */
function parseChapterFile(filePath: string, bookNum: number, chapterNum: number): VerseNotes[] {
  const content = readFileSync(filePath, 'utf-8');
  const results: VerseNotes[] = [];

  // Find all verse blocks: <ab n="verse_number">...</ab>
  // The verse blocks may contain <note>...</note> elements
  const versePattern = /<ab\s+n="(\d+)">([\s\S]*?)<\/ab>/g;
  const notePattern = /<note>([^<]+)<\/note>/g;

  let verseMatch;
  while ((verseMatch = versePattern.exec(content)) !== null) {
    const verseNum = parseInt(verseMatch[1], 10);
    const verseContent = verseMatch[2];

    // Find all notes in this verse
    const notes: MarginNote[] = [];
    let noteMatch;
    notePattern.lastIndex = 0; // Reset regex

    while ((noteMatch = notePattern.exec(verseContent)) !== null) {
      const rawNote = noteMatch[1];

      // Some notes contain multiple entries separated by commas
      // e.g. "Or, scant not. , Heb. peace."
      const noteParts = rawNote.split(/\s*,\s*(?=[A-Z])/);

      for (const part of noteParts) {
        const cleaned = cleanNoteText(part);
        if (!cleaned) continue;

        const noteType = classifyNote(cleaned);

        // Skip cross-references (we already have those from OpenBible)
        if (noteType === 'crossref') continue;

        notes.push({
          type: noteType,
          text: cleaned,
        });
      }
    }

    if (notes.length > 0) {
      results.push({
        book: bookNum,
        chapter: chapterNum,
        verse: verseNum,
        notes,
      });
    }
  }

  return results;
}

/**
 * Parse filename to extract book name and chapter number
 * e.g. "Genesis_01.xml" -> { bookName: "Genesis", chapter: 1 }
 */
function parseFilename(filename: string): { bookName: string; chapter: number } | null {
  const match = filename.match(/^(.+?)_(\d+)\.xml$/);
  if (!match) return null;

  return {
    bookName: match[1],
    chapter: parseInt(match[2], 10),
  };
}

// Main processing
console.log('=== Processing KJV 1611 Margin Notes ===\n');

const files = readdirSync(KJV_1611_PATH).filter(f => f.endsWith('.xml'));
console.log(`Found ${files.length} chapter files\n`);

const allNotes: VerseNotes[] = [];
let skippedApocrypha = 0;
let skippedUnknown = 0;

for (const file of files) {
  const parsed = parseFilename(file);
  if (!parsed) {
    console.log(`  Skipping unparseable filename: ${file}`);
    continue;
  }

  const bookNum = BOOK_NAME_MAP[parsed.bookName];
  if (!bookNum) {
    // Apocrypha and other books not in our 66-book canon
    skippedApocrypha++;
    continue;
  }

  const filePath = join(KJV_1611_PATH, file);
  const chapterNotes = parseChapterFile(filePath, bookNum, parsed.chapter);
  allNotes.push(...chapterNotes);
}

// Sort by book, chapter, verse
allNotes.sort((a, b) => {
  if (a.book !== b.book) return a.book - b.book;
  if (a.chapter !== b.chapter) return a.chapter - b.chapter;
  return a.verse - b.verse;
});

// Convert to keyed format for faster lookup: { "book.chapter.verse": notes[] }
const notesMap: Record<string, MarginNote[]> = {};
for (const entry of allNotes) {
  const key = `${entry.book}.${entry.chapter}.${entry.verse}`;
  notesMap[key] = entry.notes;
}

// Stats
const notesByType = { hebrew: 0, greek: 0, alternate: 0, other: 0 };
for (const notes of Object.values(notesMap)) {
  for (const note of notes) {
    notesByType[note.type]++;
  }
}

console.log(`Processed ${Object.keys(notesMap).length} verses with margin notes`);
console.log(`  Hebrew/Greek literal: ${notesByType.hebrew + notesByType.greek}`);
console.log(`  Alternative readings: ${notesByType.alternate}`);
console.log(`  Other notes: ${notesByType.other}`);
console.log(`  Skipped ${skippedApocrypha} Apocrypha chapters`);

// Write output
writeFileSync(
  join(ASSETS, 'margin-notes.json'),
  JSON.stringify(notesMap),
  'utf-8'
);
console.log(`\nWrote margin-notes.json\n`);

console.log('=== Done ===');
