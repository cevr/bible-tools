/**
 * Bible Study Database Service
 *
 * Uses SQLite for fast indexed lookups of:
 * - Cross-references
 * - Strong's concordance
 * - KJV verses with Strong's word mappings
 *
 * The database is created in ~/.bible/ on first run from bundled JSON data.
 */

import { Database } from 'bun:sqlite';
import { mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import type { Reference } from './types.js';

// Lazy-loaded data - only loaded when database initialization is needed
let crossRefsData: Record<string, CrossRefEntry> | null = null;
let strongsData: Record<string, Omit<StrongsEntry, 'number'>> | null = null;
let kjvStrongsData: VerseStrongs[] | null = null;
let marginNotesData: Record<string, MarginNote[]> | null = null;

async function loadJsonData() {
  if (crossRefsData) return; // Already loaded

  const [crossRefs, strongs, kjvStrongs, marginNotes] = await Promise.all([
    import('../../assets/cross-refs.json').then(m => m.default),
    import('../../assets/strongs.json').then(m => m.default),
    import('../../assets/kjv-strongs.json').then(m => m.default),
    import('../../assets/margin-notes.json').then(m => m.default),
  ]);

  crossRefsData = crossRefs as Record<string, CrossRefEntry>;
  strongsData = strongs as Record<string, Omit<StrongsEntry, 'number'>>;
  kjvStrongsData = kjvStrongs as VerseStrongs[];
  marginNotesData = marginNotes as Record<string, MarginNote[]>;
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
const DB_VERSION = 3; // v3: added phrase column to margin_notes

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
    const result = db.query<{ version: number }, []>(
      'SELECT version FROM meta WHERE key = "db_version"'
    ).get();
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

  db.run(`
    CREATE TABLE IF NOT EXISTS cross_refs (
      book INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      ref_book INTEGER NOT NULL,
      ref_chapter INTEGER NOT NULL,
      ref_verse INTEGER,
      ref_verse_end INTEGER,
      PRIMARY KEY (book, chapter, verse, ref_book, ref_chapter, ref_verse)
    )
  `);

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
  db.run('CREATE INDEX IF NOT EXISTS idx_cross_refs_ref ON cross_refs(ref_book, ref_chapter, ref_verse)');
  db.run('CREATE INDEX IF NOT EXISTS idx_verse_strongs ON verse_strongs(book, chapter, verse)');
  db.run('CREATE INDEX IF NOT EXISTS idx_margin_notes ON margin_notes(book, chapter, verse)');

  // Load cross-references
  const insertCrossRef = db.prepare(`
    INSERT OR REPLACE INTO cross_refs (book, chapter, verse, ref_book, ref_chapter, ref_verse, ref_verse_end)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  db.run('BEGIN TRANSACTION');
  for (const [key, entry] of Object.entries(crossRefsData!)) {
    const [book, chapter, verse] = key.split('.').map(Number) as [number, number, number];
    for (const ref of entry.refs) {
      insertCrossRef.run(book, chapter, verse, ref.book, ref.chapter, ref.verse ?? null, ref.verseEnd ?? null);
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
    insertStrongs.run(number, entry.lemma, entry.xlit, entry.pron ?? null, entry.def, entry.kjvDef ?? null);
  }
  db.run('COMMIT');

  // Load verse-Strong's mappings
  const insertVerseStrongs = db.prepare(`
    INSERT OR REPLACE INTO verse_strongs (book, chapter, verse, word_index, word_text, strongs_nums)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  db.run('BEGIN TRANSACTION');
  for (const v of kjvStrongsData!) {
    for (let i = 0; i < v.words.length; i++) {
      const word = v.words[i]!;
      insertVerseStrongs.run(v.book, v.chapter, v.verse, i, word.text, word.strongs ? JSON.stringify(word.strongs) : null);
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
    const [book, chapter, verse] = key.split('.').map(Number) as [number, number, number];
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i]!;
      insertMarginNote.run(book, chapter, verse, i, note.type, note.phrase, note.text);
    }
  }
  db.run('COMMIT');

  // Update version
  db.run('INSERT OR REPLACE INTO meta (key, version) VALUES ("db_version", ?)', [DB_VERSION]);

  initialized = true;
}

/**
 * Ensure database is initialized
 * Note: This must be called after initStudyDatabase() has completed
 */
function ensureInitialized(): void {
  if (!initialized) {
    throw new Error('Study database not initialized. Call initStudyDatabase() first.');
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

/**
 * Get cross-references for a verse
 */
export function getCrossRefs(book: number, chapter: number, verse: number): Reference[] {
  ensureInitialized();
  const db = getDatabase();

  const rows = db.query<{
    ref_book: number;
    ref_chapter: number;
    ref_verse: number | null;
    ref_verse_end: number | null;
  }, [number, number, number]>(`
    SELECT ref_book, ref_chapter, ref_verse, ref_verse_end
    FROM cross_refs
    WHERE book = ? AND chapter = ? AND verse = ?
  `).all(book, chapter, verse);

  return rows.map(row => ({
    book: row.ref_book,
    chapter: row.ref_chapter,
    verse: row.ref_verse ?? undefined,
    verseEnd: row.ref_verse_end ?? undefined,
  }));
}

/**
 * Get Strong's definition
 */
export function getStrongsEntry(number: string): StrongsEntry | null {
  ensureInitialized();
  const db = getDatabase();

  const row = db.query<{
    number: string;
    lemma: string;
    xlit: string;
    pron: string | null;
    def: string;
    kjv_def: string | null;
  }, [string]>(`
    SELECT number, lemma, xlit, pron, def, kjv_def
    FROM strongs
    WHERE number = ?
  `).get(number);

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
export function getVerseWords(book: number, chapter: number, verse: number): WordWithStrongs[] {
  ensureInitialized();
  const db = getDatabase();

  const rows = db.query<{
    word_text: string;
    strongs_nums: string | null;
  }, [number, number, number]>(`
    SELECT word_text, strongs_nums
    FROM verse_strongs
    WHERE book = ? AND chapter = ? AND verse = ?
    ORDER BY word_index
  `).all(book, chapter, verse);

  return rows.map(row => ({
    text: row.word_text,
    strongs: row.strongs_nums ? JSON.parse(row.strongs_nums) : undefined,
  }));
}

/**
 * Check if a verse has Strong's word mapping
 */
export function hasStrongsMapping(book: number, chapter: number, verse: number): boolean {
  ensureInitialized();
  const db = getDatabase();

  const row = db.query<{ count: number }, [number, number, number]>(`
    SELECT COUNT(*) as count
    FROM verse_strongs
    WHERE book = ? AND chapter = ? AND verse = ?
  `).get(book, chapter, verse);

  return (row?.count ?? 0) > 0;
}

/**
 * Get margin notes for a verse (1611 KJV marginal readings)
 */
export function getMarginNotes(book: number, chapter: number, verse: number): MarginNote[] {
  ensureInitialized();
  const db = getDatabase();

  const rows = db.query<{
    note_type: string;
    note_phrase: string;
    note_text: string;
  }, [number, number, number]>(`
    SELECT note_type, note_phrase, note_text
    FROM margin_notes
    WHERE book = ? AND chapter = ? AND verse = ?
    ORDER BY note_index
  `).all(book, chapter, verse);

  return rows.map(row => ({
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
 */
export function searchByStrongs(strongsNumber: string): ConcordanceResult[] {
  ensureInitialized();
  const db = getDatabase();

  // Normalize to uppercase (H1234 or G5678)
  const normalized = strongsNumber.toUpperCase();

  // Search using JSON contains pattern - SQLite LIKE on the JSON array
  const rows = db.query<{
    book: number;
    chapter: number;
    verse: number;
    word_text: string;
  }, [string]>(`
    SELECT DISTINCT book, chapter, verse, word_text
    FROM verse_strongs
    WHERE strongs_nums LIKE ?
    ORDER BY book, chapter, verse
  `).all(`%"${normalized}"%`);

  return rows.map(row => ({
    book: row.book,
    chapter: row.chapter,
    verse: row.verse,
    word: row.word_text,
  }));
}

/**
 * Get the count of occurrences for a Strong's number
 */
export function getStrongsOccurrenceCount(strongsNumber: string): number {
  ensureInitialized();
  const db = getDatabase();

  const normalized = strongsNumber.toUpperCase();

  const row = db.query<{ count: number }, [string]>(`
    SELECT COUNT(DISTINCT book || '.' || chapter || '.' || verse) as count
    FROM verse_strongs
    WHERE strongs_nums LIKE ?
  `).get(`%"${normalized}"%`);

  return row?.count ?? 0;
}

/**
 * Search Strong's entries by lemma (original word)
 */
export function searchStrongsByLemma(lemma: string): StrongsEntry[] {
  ensureInitialized();
  const db = getDatabase();

  const rows = db.query<{
    number: string;
    lemma: string;
    xlit: string;
    pron: string | null;
    def: string;
    kjv_def: string | null;
  }, [string]>(`
    SELECT number, lemma, xlit, pron, def, kjv_def
    FROM strongs
    WHERE lemma LIKE ?
    ORDER BY number
    LIMIT 50
  `).all(`%${lemma}%`);

  return rows.map(row => ({
    number: row.number,
    lemma: row.lemma,
    xlit: row.xlit,
    pron: row.pron ?? undefined,
    def: row.def,
    kjvDef: row.kjv_def ?? undefined,
  }));
}

/**
 * Search Strong's entries by definition
 */
export function searchStrongsByDefinition(query: string): StrongsEntry[] {
  ensureInitialized();
  const db = getDatabase();

  const rows = db.query<{
    number: string;
    lemma: string;
    xlit: string;
    pron: string | null;
    def: string;
    kjv_def: string | null;
  }, [string, string]>(`
    SELECT number, lemma, xlit, pron, def, kjv_def
    FROM strongs
    WHERE def LIKE ? OR kjv_def LIKE ?
    ORDER BY number
    LIMIT 50
  `).all(`%${query}%`, `%${query}%`);

  return rows.map(row => ({
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
