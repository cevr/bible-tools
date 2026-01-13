/**
 * Bible Study Database Service
 *
 * Uses SQLite for fast indexed lookups of:
 * - Cross-references (with preview text)
 * - Strong's concordance (with FTS5 search)
 * - KJV verses with Strong's word mappings
 * - Normalized Strong's-to-verse mapping for fast concordance
 *
 * The database is created in ~/.bible/ on first run from bundled JSON data.
 *
 * Schema v4 changes:
 * - Added strongs_verses table for O(1) concordance lookup
 * - Added strongs_fts FTS5 virtual table for definition search
 * - Added preview_text to cross_refs for single-query lookups
 */

import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import { Database } from 'bun:sqlite';

import type { Reference, Verse } from '../bible/types.js';

// Lazy-loaded data - only loaded when database initialization is needed
let crossRefsData: Record<string, CrossRefEntry> | null = null;
let strongsData: Record<string, Omit<StrongsEntry, 'number'>> | null = null;
let kjvStrongsData: VerseStrongs[] | null = null;
let marginNotesData: Record<string, MarginNote[]> | null = null;
let kjvData: { verses: Verse[] } | null = null;
let kjvVerseMap: Map<string, string> | null = null;

async function loadJsonData() {
  if (crossRefsData) return; // Already loaded

  const [crossRefs, strongs, kjvStrongs, marginNotes, kjv] = await Promise.all([
    import('../../../assets/cross-refs.json').then((m) => m.default),
    import('../../../assets/strongs.json').then((m) => m.default),
    import('../../../assets/kjv-strongs.json').then((m) => m.default),
    import('../../../assets/margin-notes.json').then((m) => m.default),
    import('../../../assets/kjv.json').then((m) => m.default),
  ]);

  crossRefsData = crossRefs as Record<string, CrossRefEntry>;
  strongsData = strongs as Record<string, Omit<StrongsEntry, 'number'>>;
  kjvStrongsData = kjvStrongs as VerseStrongs[];
  marginNotesData = marginNotes as Record<string, MarginNote[]>;
  kjvData = kjv as { verses: Verse[] };

  // Build verse text lookup map for preview text
  kjvVerseMap = new Map();
  for (const verse of kjvData.verses) {
    const key = `${verse.book}.${verse.chapter}.${verse.verse}`;
    kjvVerseMap.set(key, verse.text);
  }
}

/**
 * Get preview text for a verse (first ~100 chars)
 */
function getVersePreview(
  book: number,
  chapter: number,
  verse: number,
): string | null {
  if (!kjvVerseMap) return null;
  const key = `${book}.${chapter}.${verse}`;
  const text = kjvVerseMap.get(key);
  if (!text) return null;
  return text.length > 100 ? text.slice(0, 100) + '...' : text;
}

// Types

export interface CrossRefEntry {
  refs: Reference[];
}

export interface StrongsEntry {
  number: string;
  lemma: string;
  xlit: string;
  pron?: string;
  def: string;
  kjvDef?: string;
}

export interface WordWithStrongs {
  text: string;
  strongs?: string[];
}

export interface VerseStrongs {
  book: number;
  chapter: number;
  verse: number;
  words: WordWithStrongs[];
}

export interface MarginNote {
  type: 'hebrew' | 'greek' | 'alternate' | 'name' | 'other';
  phrase: string;
  text: string;
}

// Database path
const DB_DIR = join(homedir(), '.bible');
const DB_PATH = join(DB_DIR, 'study.db');
const DB_VERSION = 4; // v4: strongs_verses table, strongs_fts, preview_text in cross_refs

// Singleton database instance
let db: Database | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Get or create the database instance
 */
function getDatabase(): Database {
  if (db) return db;

  // Ensure directory exists
  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  return db;
}

/**
 * Check if database needs initialization
 */
function needsInit(): boolean {
  if (initialized) return false;

  const db = getDatabase();

  try {
    const result = db
      .query<
        { version: number },
        []
      >('SELECT version FROM meta WHERE key = "db_version"')
      .get();
    return !result || result.version < DB_VERSION;
  } catch {
    // Table doesn't exist
    return true;
  }
}

/**
 * Initialize the database schema and load data
 * Now async because it needs to load JSON data lazily
 */
async function initDatabaseAsync(): Promise<void> {
  if (!needsInit()) {
    initialized = true;
    return;
  }

  // Load JSON data lazily (only when database needs to be rebuilt)
  await loadJsonData();

  const db = getDatabase();

  // Create schema
  db.run(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      version INTEGER
    )
  `);

  // Cross-references with preview text for single-query lookups
  db.run(`
    CREATE TABLE IF NOT EXISTS cross_refs (
      book INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      ref_book INTEGER NOT NULL,
      ref_chapter INTEGER NOT NULL,
      ref_verse INTEGER,
      ref_verse_end INTEGER,
      preview_text TEXT,
      PRIMARY KEY (book, chapter, verse, ref_book, ref_chapter, ref_verse)
    )
  `);

  // Strong's definitions
  db.run(`
    CREATE TABLE IF NOT EXISTS strongs (
      number TEXT PRIMARY KEY,
      lemma TEXT,
      xlit TEXT,
      pron TEXT,
      def TEXT,
      kjv_def TEXT
    )
  `);

  // Verse-level Strong's word mappings (for word rendering)
  db.run(`
    CREATE TABLE IF NOT EXISTS verse_strongs (
      book INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      word_index INTEGER NOT NULL,
      word_text TEXT NOT NULL,
      strongs_nums TEXT,
      PRIMARY KEY (book, chapter, verse, word_index)
    )
  `);

  // Normalized Strong's-to-verse mapping for O(1) concordance lookups
  db.run(`
    CREATE TABLE IF NOT EXISTS strongs_verses (
      strongs_number TEXT NOT NULL,
      book INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      word_text TEXT,
      word_index INTEGER,
      PRIMARY KEY (strongs_number, book, chapter, verse, word_index)
    )
  `);

  // Margin notes with phrase positions
  db.run(`
    CREATE TABLE IF NOT EXISTS margin_notes (
      book INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      note_index INTEGER NOT NULL,
      note_type TEXT NOT NULL,
      note_phrase TEXT NOT NULL,
      note_text TEXT NOT NULL,
      PRIMARY KEY (book, chapter, verse, note_index)
    )
  `);

  // Create indexes
  db.run(
    'CREATE INDEX IF NOT EXISTS idx_cross_refs_from ON cross_refs(book, chapter, verse)',
  );
  db.run(
    'CREATE INDEX IF NOT EXISTS idx_cross_refs_ref ON cross_refs(ref_book, ref_chapter, ref_verse)',
  );
  db.run(
    'CREATE INDEX IF NOT EXISTS idx_verse_strongs ON verse_strongs(book, chapter, verse)',
  );
  db.run(
    'CREATE INDEX IF NOT EXISTS idx_strongs_verses_num ON strongs_verses(strongs_number)',
  );
  db.run(
    'CREATE INDEX IF NOT EXISTS idx_strongs_verses_verse ON strongs_verses(book, chapter, verse)',
  );
  db.run(
    'CREATE INDEX IF NOT EXISTS idx_margin_notes ON margin_notes(book, chapter, verse)',
  );
  db.run('CREATE INDEX IF NOT EXISTS idx_strongs_number ON strongs(number)');
  db.run('CREATE INDEX IF NOT EXISTS idx_strongs_lemma ON strongs(lemma)');

  // FTS5 virtual table for Strong's definition search
  db.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS strongs_fts USING fts5(
      number,
      lemma,
      def,
      content=strongs,
      content_rowid=rowid
    )
  `);

  // Load cross-references with preview text
  const insertCrossRef = db.prepare(`
    INSERT OR REPLACE INTO cross_refs (book, chapter, verse, ref_book, ref_chapter, ref_verse, ref_verse_end, preview_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.run('BEGIN TRANSACTION');
  for (const [key, entry] of Object.entries(crossRefsData!)) {
    const [book, chapter, verse] = key.split('.').map(Number) as [
      number,
      number,
      number,
    ];
    for (const ref of entry.refs) {
      // Get preview text for the referenced verse
      const preview = ref.verse
        ? getVersePreview(ref.book, ref.chapter, ref.verse)
        : null;
      insertCrossRef.run(
        book,
        chapter,
        verse,
        ref.book,
        ref.chapter,
        ref.verse ?? null,
        ref.verseEnd ?? null,
        preview,
      );
    }
  }
  db.run('COMMIT');

  // Load Strong's concordance
  const insertStrongs = db.prepare(`
    INSERT OR REPLACE INTO strongs (number, lemma, xlit, pron, def, kjv_def)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  db.run('BEGIN TRANSACTION');
  for (const [number, entry] of Object.entries(strongsData!)) {
    insertStrongs.run(
      number,
      entry.lemma,
      entry.xlit,
      entry.pron ?? null,
      entry.def,
      entry.kjvDef ?? null,
    );
  }
  db.run('COMMIT');

  // Populate FTS5 index for Strong's definitions
  db.run(`
    INSERT INTO strongs_fts(strongs_fts) VALUES('rebuild')
  `);

  // Load verse-Strong's mappings and normalized strongs_verses table
  const insertVerseStrongs = db.prepare(`
    INSERT OR REPLACE INTO verse_strongs (book, chapter, verse, word_index, word_text, strongs_nums)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertStrongsVerse = db.prepare(`
    INSERT OR IGNORE INTO strongs_verses (strongs_number, book, chapter, verse, word_text, word_index)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  db.run('BEGIN TRANSACTION');
  for (const v of kjvStrongsData!) {
    for (let i = 0; i < v.words.length; i++) {
      const word = v.words[i]!;
      insertVerseStrongs.run(
        v.book,
        v.chapter,
        v.verse,
        i,
        word.text,
        word.strongs ? JSON.stringify(word.strongs) : null,
      );

      // Populate normalized strongs_verses table for each Strong's number
      if (word.strongs) {
        for (const strongsNum of word.strongs) {
          insertStrongsVerse.run(
            strongsNum.toUpperCase(),
            v.book,
            v.chapter,
            v.verse,
            word.text,
            i,
          );
        }
      }
    }
  }
  db.run('COMMIT');

  // Load margin notes
  const insertMarginNote = db.prepare(`
    INSERT OR REPLACE INTO margin_notes (book, chapter, verse, note_index, note_type, note_phrase, note_text)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  db.run('BEGIN TRANSACTION');
  for (const [key, notes] of Object.entries(marginNotesData!)) {
    const [book, chapter, verse] = key.split('.').map(Number) as [
      number,
      number,
      number,
    ];
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i]!;
      insertMarginNote.run(
        book,
        chapter,
        verse,
        i,
        note.type,
        note.phrase,
        note.text,
      );
    }
  }
  db.run('COMMIT');

  // Update version
  db.run(
    'INSERT OR REPLACE INTO meta (key, version) VALUES ("db_version", ?)',
    [DB_VERSION],
  );

  initialized = true;
}

/**
 * Ensure database is initialized
 * Note: This must be called after initStudyDatabase() has completed
 */
function ensureInitialized(): void {
  if (!initialized) {
    throw new Error(
      'Study database not initialized. Call initStudyDatabase() first.',
    );
  }
}

/**
 * Initialize the study database asynchronously
 * Returns a promise that resolves when the database is ready
 */
export async function initStudyDatabase(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = initDatabaseAsync();
  return initPromise;
}

/**
 * @deprecated Use initStudyDatabase() instead
 * Start background initialization
 * Call this early to pre-warm the database without blocking
 */
export function initInBackground(): void {
  initStudyDatabase();
}

// Public API

/** Cross-reference with optional preview text */
export interface CrossRef extends Reference {
  previewText?: string;
}

/**
 * Get cross-references for a verse (includes preview text)
 */
export function getCrossRefs(
  book: number,
  chapter: number,
  verse: number,
): CrossRef[] {
  ensureInitialized();
  const db = getDatabase();

  const rows = db
    .query<
      {
        ref_book: number;
        ref_chapter: number;
        ref_verse: number | null;
        ref_verse_end: number | null;
        preview_text: string | null;
      },
      [number, number, number]
    >(
      `
    SELECT ref_book, ref_chapter, ref_verse, ref_verse_end, preview_text
    FROM cross_refs
    WHERE book = ? AND chapter = ? AND verse = ?
  `,
    )
    .all(book, chapter, verse);

  return rows.map((row) => ({
    book: row.ref_book,
    chapter: row.ref_chapter,
    verse: row.ref_verse ?? undefined,
    verseEnd: row.ref_verse_end ?? undefined,
    previewText: row.preview_text ?? undefined,
  }));
}

/**
 * Get Strong's definition
 */
export function getStrongsEntry(number: string): StrongsEntry | null {
  ensureInitialized();
  const db = getDatabase();

  const row = db
    .query<
      {
        number: string;
        lemma: string;
        xlit: string;
        pron: string | null;
        def: string;
        kjv_def: string | null;
      },
      [string]
    >(
      `
    SELECT number, lemma, xlit, pron, def, kjv_def
    FROM strongs
    WHERE number = ?
  `,
    )
    .get(number);

  if (!row) return null;

  return {
    number: row.number,
    lemma: row.lemma,
    xlit: row.xlit,
    pron: row.pron ?? undefined,
    def: row.def,
    kjvDef: row.kjv_def ?? undefined,
  };
}

/**
 * Get words with Strong's numbers for a verse
 */
export function getVerseWords(
  book: number,
  chapter: number,
  verse: number,
): WordWithStrongs[] {
  ensureInitialized();
  const db = getDatabase();

  const rows = db
    .query<
      {
        word_text: string;
        strongs_nums: string | null;
      },
      [number, number, number]
    >(
      `
    SELECT word_text, strongs_nums
    FROM verse_strongs
    WHERE book = ? AND chapter = ? AND verse = ?
    ORDER BY word_index
  `,
    )
    .all(book, chapter, verse);

  return rows.map((row) => ({
    text: row.word_text,
    strongs: row.strongs_nums ? JSON.parse(row.strongs_nums) : undefined,
  }));
}

/**
 * Check if a verse has Strong's word mapping
 */
export function hasStrongsMapping(
  book: number,
  chapter: number,
  verse: number,
): boolean {
  ensureInitialized();
  const db = getDatabase();

  const row = db
    .query<{ count: number }, [number, number, number]>(
      `
    SELECT COUNT(*) as count
    FROM verse_strongs
    WHERE book = ? AND chapter = ? AND verse = ?
  `,
    )
    .get(book, chapter, verse);

  return (row?.count ?? 0) > 0;
}

/**
 * Get margin notes for a verse (1611 KJV marginal readings)
 */
export function getMarginNotes(
  book: number,
  chapter: number,
  verse: number,
): MarginNote[] {
  ensureInitialized();
  const db = getDatabase();

  const rows = db
    .query<
      {
        note_type: string;
        note_phrase: string;
        note_text: string;
      },
      [number, number, number]
    >(
      `
    SELECT note_type, note_phrase, note_text
    FROM margin_notes
    WHERE book = ? AND chapter = ? AND verse = ?
    ORDER BY note_index
  `,
    )
    .all(book, chapter, verse);

  return rows.map((row) => ({
    type: row.note_type as MarginNote['type'],
    phrase: row.note_phrase,
    text: row.note_text,
  }));
}

/** Concordance search result */
export interface ConcordanceResult {
  book: number;
  chapter: number;
  verse: number;
  word: string;
}

/**
 * Search for all verses containing a Strong's number
 * Uses normalized strongs_verses table for O(1) index lookup
 */
export function searchByStrongs(strongsNumber: string): ConcordanceResult[] {
  ensureInitialized();
  const db = getDatabase();

  // Normalize to uppercase (H1234 or G5678)
  const normalized = strongsNumber.toUpperCase();

  // Use normalized strongs_verses table for fast index lookup
  const rows = db
    .query<
      {
        book: number;
        chapter: number;
        verse: number;
        word_text: string;
      },
      [string]
    >(
      `
    SELECT DISTINCT book, chapter, verse, word_text
    FROM strongs_verses
    WHERE strongs_number = ?
    ORDER BY book, chapter, verse
  `,
    )
    .all(normalized);

  return rows.map((row) => ({
    book: row.book,
    chapter: row.chapter,
    verse: row.verse,
    word: row.word_text,
  }));
}

/**
 * Get the count of occurrences for a Strong's number
 * Uses normalized strongs_verses table for O(1) index lookup
 */
export function getStrongsOccurrenceCount(strongsNumber: string): number {
  ensureInitialized();
  const db = getDatabase();

  const normalized = strongsNumber.toUpperCase();

  const row = db
    .query<{ count: number }, [string]>(
      `
    SELECT COUNT(DISTINCT book || '.' || chapter || '.' || verse) as count
    FROM strongs_verses
    WHERE strongs_number = ?
  `,
    )
    .get(normalized);

  return row?.count ?? 0;
}

/**
 * Search Strong's entries by lemma (original word)
 */
export function searchStrongsByLemma(lemma: string): StrongsEntry[] {
  ensureInitialized();
  const db = getDatabase();

  const rows = db
    .query<
      {
        number: string;
        lemma: string;
        xlit: string;
        pron: string | null;
        def: string;
        kjv_def: string | null;
      },
      [string]
    >(
      `
    SELECT number, lemma, xlit, pron, def, kjv_def
    FROM strongs
    WHERE lemma LIKE ?
    ORDER BY number
    LIMIT 50
  `,
    )
    .all(`%${lemma}%`);

  return rows.map((row) => ({
    number: row.number,
    lemma: row.lemma,
    xlit: row.xlit,
    pron: row.pron ?? undefined,
    def: row.def,
    kjvDef: row.kjv_def ?? undefined,
  }));
}

/**
 * Search Strong's entries by definition using FTS5
 */
export function searchStrongsByDefinition(query: string): StrongsEntry[] {
  ensureInitialized();
  const db = getDatabase();

  // Escape special FTS5 characters and prepare query
  const escapedQuery = query.replace(/['"*]/g, '');
  if (!escapedQuery.trim()) return [];

  // Use FTS5 for fast full-text search
  const rows = db
    .query<
      {
        number: string;
        lemma: string;
        xlit: string;
        pron: string | null;
        def: string;
        kjv_def: string | null;
      },
      [string]
    >(
      `
    SELECT s.number, s.lemma, s.xlit, s.pron, s.def, s.kjv_def
    FROM strongs s
    JOIN strongs_fts fts ON s.rowid = fts.rowid
    WHERE strongs_fts MATCH ?
    ORDER BY s.number
    LIMIT 50
  `,
    )
    .all(`def:${escapedQuery}* OR lemma:${escapedQuery}*`);

  return rows.map((row) => ({
    number: row.number,
    lemma: row.lemma,
    xlit: row.xlit,
    pron: row.pron ?? undefined,
    def: row.def,
    kjvDef: row.kjv_def ?? undefined,
  }));
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    initialized = false;
  }
}
