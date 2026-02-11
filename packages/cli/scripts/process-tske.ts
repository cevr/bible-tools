#!/usr/bin/env bun
/**
 * Process TSKe (Treasury of Scripture Knowledge Enhanced) data into JSON.
 *
 * Input:  packages/cli/assets/data-raw/tske.txt
 * Output: packages/core/assets/cross-refs-tske.json
 *
 * TSKe format:
 * - Tab-delimited: "Book Ch:Vs\t<HTML content>"
 * - Refs in <u> tags: <u>Book_Ch:Vs</u> or <u>Book_Ch:Vs-VsEnd</u>
 * - Book intros (just book name) and chapter overviews (no verse) are skipped
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DATA_RAW = join(import.meta.dir, '../assets/data-raw');
const CORE_ASSETS = join(import.meta.dir, '../../core/assets');

// ============================================================================
// Types
// ============================================================================

interface Reference {
  book: number;
  chapter: number;
  verse?: number;
  verseEnd?: number;
}

interface CrossRefEntry {
  refs: Reference[];
}

// ============================================================================
// TSKe Book Abbreviation Map (66 books, Protestant canon)
// ============================================================================

const TSKE_BOOK_MAP = new Map<string, number>([
  ['Gen', 1],
  ['Exo', 2],
  ['Lev', 3],
  ['Num', 4],
  ['Deu', 5],
  ['Jos', 6],
  ['Jdg', 7],
  ['Rth', 8],
  ['1Sa', 9],
  ['2Sa', 10],
  ['1Ki', 11],
  ['2Ki', 12],
  ['1Ch', 13],
  ['2Ch', 14],
  ['Ezr', 15],
  ['Neh', 16],
  ['Est', 17],
  ['Job', 18],
  ['Psa', 19],
  ['Pro', 20],
  ['Ecc', 21],
  ['Son', 22],
  ['Isa', 23],
  ['Jer', 24],
  ['Lam', 25],
  ['Eze', 26],
  ['Dan', 27],
  ['Hos', 28],
  ['Joe', 29],
  ['Amo', 30],
  ['Oba', 31],
  ['Jon', 32],
  ['Mic', 33],
  ['Nah', 34],
  ['Hab', 35],
  ['Zep', 36],
  ['Hag', 37],
  ['Zec', 38],
  ['Mal', 39],
  ['Mat', 40],
  ['Mar', 41],
  ['Luk', 42],
  ['Joh', 43],
  ['Act', 44],
  ['Rom', 45],
  ['1Co', 46],
  ['2Co', 47],
  ['Gal', 48],
  ['Eph', 49],
  ['Phi', 50],
  ['Col', 51],
  ['1Th', 52],
  ['2Th', 53],
  ['1Ti', 54],
  ['2Ti', 55],
  ['Tit', 56],
  ['Phm', 57],
  ['Heb', 58],
  ['Jam', 59],
  ['1Pe', 60],
  ['2Pe', 61],
  ['1Jo', 62],
  ['2Jo', 63],
  ['3Jo', 64],
  ['Jud', 65],
  ['Rev', 66],
]);

// ============================================================================
// Pre-compiled Regexes (hoisted outside loop)
// ============================================================================

// Matches verse lines: "Gen 1:1\t..." — captures book, chapter, verse
const LINE_HEADER_RE = /^(\d?[A-Za-z]+)\s+(\d+):(\d+)\t/;

// Extracts <u> tag content
const U_TAG_RE = /<u>([^<]+)<\/u>/g;

// Parses a TSKe ref: "Book_Ch:Vs" or "Book_Ch:Vs-VsEnd"
const REF_RE = /^(\d?[A-Za-z]+)_(\d+):(\d+)(?:-(\d+))?$/;

// ============================================================================
// Parser
// ============================================================================

function parseTskeRef(raw: string): Reference | null {
  const m = REF_RE.exec(raw);
  if (!m) return null;

  const bookAbbr = m[1];
  const bookNum = TSKE_BOOK_MAP.get(bookAbbr);
  if (bookNum === undefined) return null;

  const chapter = parseInt(m[2], 10);
  const verse = parseInt(m[3], 10);
  if (isNaN(chapter) || isNaN(verse)) return null;

  const ref: Reference = { book: bookNum, chapter, verse };

  if (m[4] !== undefined) {
    const verseEnd = parseInt(m[4], 10);
    if (!isNaN(verseEnd)) {
      ref.verseEnd = verseEnd;
    }
  }

  return ref;
}

function processTske(): void {
  console.log('=== Processing TSKe Data ===\n');

  const inputPath = join(DATA_RAW, 'tske.txt');
  const content = readFileSync(inputPath, 'utf-8');
  const lines = content.split('\n');

  const crossRefs: Record<string, CrossRefEntry> = {};
  const unknownBooks = new Set<string>();
  let versesProcessed = 0;
  let refsExtracted = 0;
  let linesSkipped = 0;

  for (const line of lines) {
    if (!line.trim()) continue;

    // Match verse header — skips book intros and chapter overviews
    const headerMatch = LINE_HEADER_RE.exec(line);
    if (!headerMatch) {
      linesSkipped++;
      continue;
    }

    const sourceBookAbbr = headerMatch[1];
    const sourceBookNum = TSKE_BOOK_MAP.get(sourceBookAbbr);
    if (sourceBookNum === undefined) {
      unknownBooks.add(sourceBookAbbr);
      linesSkipped++;
      continue;
    }

    const sourceChapter = parseInt(headerMatch[2], 10);
    const sourceVerse = parseInt(headerMatch[3], 10);
    const key = `${sourceBookNum}.${sourceChapter}.${sourceVerse}`;

    // Extract all <u> tag contents
    const refs: Reference[] = [];
    U_TAG_RE.lastIndex = 0; // Reset global regex per line
    let uMatch: RegExpExecArray | null;
    while ((uMatch = U_TAG_RE.exec(line)) !== null) {
      const ref = parseTskeRef(uMatch[1]);
      if (ref) {
        refs.push(ref);
      }
    }

    if (refs.length > 0) {
      if (crossRefs[key]) {
        // Merge refs for the same verse (shouldn't happen but be safe)
        crossRefs[key].refs.push(...refs);
      } else {
        crossRefs[key] = { refs };
      }
      refsExtracted += refs.length;
    }

    versesProcessed++;
  }

  // Write output
  const outputPath = join(CORE_ASSETS, 'cross-refs-tske.json');
  writeFileSync(outputPath, JSON.stringify(crossRefs), 'utf-8');

  // Stats
  const verseKeys = Object.keys(crossRefs).length;
  console.log(`  Verses processed: ${versesProcessed}`);
  console.log(`  Verse keys with refs: ${verseKeys}`);
  console.log(`  Total refs extracted: ${refsExtracted}`);
  console.log(`  Lines skipped: ${linesSkipped}`);
  if (unknownBooks.size > 0) {
    console.log(`  Unknown books: ${[...unknownBooks].join(', ')}`);
  }
  console.log(`\n  Wrote ${outputPath}\n`);
  console.log('=== Done ===');
}

processTske();
