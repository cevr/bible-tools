/**
 * Process raw Bible study data into JSON assets for bundling.
 *
 * This script processes:
 * 1. Cross-references from OpenBible.info TSV
 * 2. Strong's Hebrew and Greek dictionaries
 * 3. KJV verses with Strong's numbers
 *
 * Output files are placed in assets/ for bundling with the CLI.
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const DATA_RAW = join(import.meta.dir, '../assets/data-raw');
const ASSETS = join(import.meta.dir, '../assets');

// Book abbreviation mapping (OpenBible format -> our book numbers)
const BOOK_MAP: Record<string, number> = {
  Gen: 1, Exod: 2, Lev: 3, Num: 4, Deut: 5,
  Josh: 6, Judg: 7, Ruth: 8, '1Sam': 9, '2Sam': 10,
  '1Kgs': 11, '2Kgs': 12, '1Chr': 13, '2Chr': 14, Ezra: 15,
  Neh: 16, Esth: 17, Job: 18, Ps: 19, Prov: 20,
  Eccl: 21, Song: 22, Isa: 23, Jer: 24, Lam: 25,
  Ezek: 26, Dan: 27, Hos: 28, Joel: 29, Amos: 30,
  Obad: 31, Jonah: 32, Mic: 33, Nah: 34, Hab: 35,
  Zeph: 36, Hag: 37, Zech: 38, Mal: 39,
  Matt: 40, Mark: 41, Luke: 42, John: 43, Acts: 44,
  Rom: 45, '1Cor': 46, '2Cor': 47, Gal: 48, Eph: 49,
  Phil: 50, Col: 51, '1Thess': 52, '2Thess': 53, '1Tim': 54,
  '2Tim': 55, Titus: 56, Phlm: 57, Heb: 58, Jas: 59,
  '1Pet': 60, '2Pet': 61, '1John': 62, '2John': 63, '3John': 64,
  Jude: 65, Rev: 66,
};

// KJV-Strongs book abbreviation mapping
const KJV_STRONGS_BOOK_MAP: Record<string, number> = {
  Gen: 1, Exo: 2, Lev: 3, Num: 4, Deu: 5,
  Jos: 6, Jdg: 7, Rth: 8, '1Sa': 9, '2Sa': 10,
  '1Ki': 11, '2Ki': 12, '1Ch': 13, '2Ch': 14, Ezr: 15,
  Neh: 16, Est: 17, Job: 18, Psa: 19, Pro: 20,
  Ecc: 21, Sng: 22, Isa: 23, Jer: 24, Lam: 25,
  Eze: 26, Dan: 27, Hos: 28, Joe: 29, Amo: 30,
  Oba: 31, Jon: 32, Mic: 33, Nah: 34, Hab: 35,
  Zep: 36, Hag: 37, Zec: 38, Mal: 39,
  Mat: 40, Mar: 41, Luk: 42, Jhn: 43, Act: 44,
  Rom: 45, '1Co': 46, '2Co': 47, Gal: 48, Eph: 49,
  Phl: 50, Col: 51, '1Th': 52, '2Th': 53, '1Ti': 54,
  '2Ti': 55, Tit: 56, Phm: 57, Heb: 58, Jas: 59,
  '1Pe': 60, '2Pe': 61, '1Jo': 62, '2Jo': 63, '3Jo': 64,
  Jde: 65, Rev: 66,
};

interface Reference {
  book: number;
  chapter: number;
  verse?: number;
  verseEnd?: number;
}

interface CrossRefEntry {
  refs: Reference[];
}

interface StrongsEntry {
  lemma: string;
  xlit: string;
  pron?: string;
  def: string;
  kjvDef?: string;
}

/**
 * Clean HTML entities from string
 */
function cleanHtmlEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8212;?-?/g, '—')  // em-dash with potential trailing dash
    .replace(/&quot-/g, '"')  // Fix malformed entities
    .replace(/-&quot/g, '"');
}

interface WordWithStrongs {
  text: string;
  strongs?: string[];
}

interface VerseWithStrongs {
  book: number;
  chapter: number;
  verse: number;
  words: WordWithStrongs[];
}

/**
 * Parse OpenBible reference format: "Gen.1.1" or "Ps.89.11-Ps.89.12"
 */
function parseOpenBibleRef(ref: string): Reference | null {
  // Handle range: "Ps.89.11-Ps.89.12"
  const rangeParts = ref.split('-');
  const mainRef = rangeParts[0];

  const parts = mainRef.split('.');
  if (parts.length < 3) return null;

  const bookNum = BOOK_MAP[parts[0]];
  if (!bookNum) return null;

  const chapter = parseInt(parts[1], 10);
  const verse = parseInt(parts[2], 10);

  if (isNaN(chapter) || isNaN(verse)) return null;

  const result: Reference = { book: bookNum, chapter, verse };

  // Handle verse range
  if (rangeParts.length > 1) {
    const endParts = rangeParts[1].split('.');
    if (endParts.length >= 3) {
      const endVerse = parseInt(endParts[2], 10);
      if (!isNaN(endVerse)) {
        result.verseEnd = endVerse;
      }
    }
  }

  return result;
}

/**
 * Create a reference key for our format: "1.1.1" (book.chapter.verse)
 */
function refKey(ref: Reference): string {
  return `${ref.book}.${ref.chapter}.${ref.verse}`;
}

/**
 * Process cross-references TSV
 */
function processCrossRefs(): Record<string, CrossRefEntry> {
  console.log('Processing cross-references...');

  const tsvPath = join(DATA_RAW, 'cross_references.txt');
  const content = readFileSync(tsvPath, 'utf-8');
  const lines = content.split('\n');

  const crossRefs: Record<string, CrossRefEntry> = {};
  let processed = 0;
  let skipped = 0;

  for (const line of lines) {
    // Skip header and comments
    if (line.startsWith('#') || line.startsWith('From')) continue;
    if (!line.trim()) continue;

    const [fromRef, toRef] = line.split('\t');
    if (!fromRef || !toRef) continue;

    const from = parseOpenBibleRef(fromRef);
    const to = parseOpenBibleRef(toRef);

    if (!from || !to) {
      skipped++;
      continue;
    }

    const key = refKey(from);
    if (!crossRefs[key]) {
      crossRefs[key] = { refs: [] };
    }
    crossRefs[key].refs.push(to);
    processed++;
  }

  console.log(`  Processed ${processed} cross-references, skipped ${skipped}`);
  return crossRefs;
}

/**
 * Process Strong's dictionaries from multiple sources
 */
function processStrongs(): Record<string, StrongsEntry> {
  console.log('Processing Strong\'s dictionaries...');

  const strongs: Record<string, StrongsEntry> = {};

  // First, try loading from the lexicon.json (kaiserlik/kjv) - has Greek and Hebrew
  const lexiconPath = join(DATA_RAW, 'kjv-strongs/lexicon.json');
  try {
    const lexiconData = JSON.parse(readFileSync(lexiconPath, 'utf-8'));
    for (const [key, value] of Object.entries(lexiconData)) {
      const v = value as {
        Gk_word?: string;
        Heb_word?: string;
        transliteration?: string;
        strongs_def?: string;
        part_of_speech?: string;
        outline_usage?: string;
      };
      strongs[key] = {
        lemma: v.Gk_word || v.Heb_word || '',
        xlit: v.transliteration || '',
        def: cleanHtmlEntities(v.strongs_def || v.outline_usage || ''),
      };
    }
    console.log(`  Loaded ${Object.keys(lexiconData).length} entries from lexicon.json`);
  } catch (e) {
    console.log(`  WARNING: Could not load lexicon.json: ${e}`);
  }

  // Then supplement with OpenScriptures Hebrew data (has more detail)
  const hebrewPath = join(DATA_RAW, 'strongs/hebrew/strongs-hebrew-dictionary.js');
  try {
    const hebrewContent = readFileSync(hebrewPath, 'utf-8');
    const hebrewMatch = hebrewContent.match(/var strongsHebrewDictionary = (\{[\s\S]*?\n\});/);

    if (hebrewMatch) {
      const hebrewData = JSON.parse(hebrewMatch[1]);
      let added = 0;
      for (const [key, value] of Object.entries(hebrewData)) {
        const v = value as {
          lemma: string;
          xlit: string;
          pron?: string;
          strongs_def: string;
          kjv_def?: string;
        };
        // Only add if we don't have it or if OpenScriptures has more detail
        if (!strongs[key] || !strongs[key].def) {
          strongs[key] = {
            lemma: v.lemma,
            xlit: v.xlit,
            pron: v.pron,
            def: cleanHtmlEntities(v.strongs_def),
            kjvDef: v.kjv_def ? cleanHtmlEntities(v.kjv_def) : undefined,
          };
          added++;
        } else if (v.pron && !strongs[key].pron) {
          // Add pronunciation if missing
          strongs[key].pron = v.pron;
          strongs[key].kjvDef = v.kjv_def ? cleanHtmlEntities(v.kjv_def) : undefined;
        }
      }
      console.log(`  Added/updated ${added} Hebrew entries from OpenScriptures`);
    }
  } catch (e) {
    console.log(`  WARNING: Could not parse Hebrew dictionary: ${e}`);
  }

  // Supplement with OpenScriptures Greek data
  const greekPath = join(DATA_RAW, 'strongs/greek/strongs-greek-dictionary.js');
  try {
    const greekContent = readFileSync(greekPath, 'utf-8');
    const greekMatch = greekContent.match(/var strongsGreekDictionary = (\{.*\});/);

    if (greekMatch) {
      const greekData = JSON.parse(greekMatch[1]);
      let added = 0;
      for (const [key, value] of Object.entries(greekData)) {
        const v = value as {
          lemma: string;
          translit?: string;
          xlit?: string;
          pron?: string;
          strongs_def?: string;
          kjv_def?: string;
          derivation?: string;
        };
        if (!strongs[key] || !strongs[key].def) {
          strongs[key] = {
            lemma: v.lemma,
            xlit: v.translit || v.xlit || '',
            pron: v.pron,
            def: cleanHtmlEntities(v.strongs_def || v.derivation || ''),
            kjvDef: v.kjv_def ? cleanHtmlEntities(v.kjv_def) : undefined,
          };
          added++;
        } else if (v.pron && !strongs[key].pron) {
          strongs[key].pron = v.pron;
          strongs[key].kjvDef = v.kjv_def ? cleanHtmlEntities(v.kjv_def) : undefined;
        }
      }
      console.log(`  Added/updated ${added} Greek entries from OpenScriptures`);
    }
  } catch (e) {
    console.log(`  WARNING: Could not parse Greek dictionary: ${e}`);
  }

  return strongs;
}

/**
 * Parse a word with inline Strong's numbers: "beginning[H7225]" or "was[G2258]"
 * Returns the word and any Strong's numbers
 */
function parseWordWithStrongs(text: string): WordWithStrongs {
  const strongsPattern = /\[([HG]\d+)\]/g;
  const strongs: string[] = [];
  let match;

  while ((match = strongsPattern.exec(text)) !== null) {
    strongs.push(match[1]);
  }

  // Remove Strong's markers and <em> tags
  const cleanText = text
    .replace(/\[([HG]\d+)\]/g, '')
    .replace(/<\/?em>/g, '')
    .trim();

  return {
    text: cleanText,
    strongs: strongs.length > 0 ? strongs : undefined,
  };
}

/**
 * Process KJV with Strong's numbers
 */
function processKjvStrongs(): VerseWithStrongs[] {
  console.log('Processing KJV with Strong\'s numbers...');

  const kjvDir = join(DATA_RAW, 'kjv-strongs');
  const verses: VerseWithStrongs[] = [];

  // Get all book files (exclude metadata files and non-JSON)
  const excludeFiles = ['books.json', 'chapter_count.json', 'lexicon.json', 'README.md'];
  const files = readdirSync(kjvDir).filter(f =>
    f.endsWith('.json') && !excludeFiles.includes(f)
  );

  for (const file of files) {
    const bookAbbr = file.replace('.json', '');
    const bookNum = KJV_STRONGS_BOOK_MAP[bookAbbr];

    if (!bookNum) {
      console.log(`  Skipping unknown book: ${bookAbbr}`);
      continue;
    }

    const bookPath = join(kjvDir, file);
    let bookData;
    try {
      bookData = JSON.parse(readFileSync(bookPath, 'utf-8'));
    } catch (e) {
      console.log(`  ERROR parsing ${file}: ${e}`);
      continue;
    }

    // Navigate the nested structure: { "Gen": { "Gen|1": { "Gen|1|1": { "en": "..." } } } }
    const bookContent = bookData[bookAbbr];
    if (!bookContent) continue;

    for (const [chapterKey, chapterContent] of Object.entries(bookContent)) {
      const chapterNum = parseInt(chapterKey.split('|')[1], 10);

      for (const [verseKey, verseContent] of Object.entries(chapterContent as Record<string, unknown>)) {
        const verseNum = parseInt(verseKey.split('|')[2], 10);
        const englishText = (verseContent as { en: string }).en;

        if (!englishText) continue;

        // Split into words and parse Strong's numbers
        // Words are separated by spaces, but punctuation sticks to words
        const rawWords = englishText.split(/\s+/);
        const words: WordWithStrongs[] = [];

        for (const rawWord of rawWords) {
          if (!rawWord) continue;
          const parsed = parseWordWithStrongs(rawWord);
          if (parsed.text) {
            words.push(parsed);
          }
        }

        verses.push({
          book: bookNum,
          chapter: chapterNum,
          verse: verseNum,
          words,
        });
      }
    }
  }

  // Sort by book, chapter, verse
  verses.sort((a, b) => {
    if (a.book !== b.book) return a.book - b.book;
    if (a.chapter !== b.chapter) return a.chapter - b.chapter;
    return a.verse - b.verse;
  });

  console.log(`  Processed ${verses.length} verses`);
  return verses;
}

// Main processing
console.log('=== Processing Bible Study Data ===\n');

const crossRefs = processCrossRefs();
writeFileSync(
  join(ASSETS, 'cross-refs.json'),
  JSON.stringify(crossRefs),
  'utf-8'
);
console.log(`  Wrote cross-refs.json (${Object.keys(crossRefs).length} verses with refs)\n`);

const strongs = processStrongs();
writeFileSync(
  join(ASSETS, 'strongs.json'),
  JSON.stringify(strongs),
  'utf-8'
);
console.log(`  Wrote strongs.json (${Object.keys(strongs).length} entries)\n`);

const kjvStrongs = processKjvStrongs();
writeFileSync(
  join(ASSETS, 'kjv-strongs.json'),
  JSON.stringify(kjvStrongs),
  'utf-8'
);
console.log(`  Wrote kjv-strongs.json (${kjvStrongs.length} verses)\n`);

console.log('=== Done ===');
