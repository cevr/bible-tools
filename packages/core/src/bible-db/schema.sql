-- Bible Database Schema v1
--
-- Unified database for Bible data including:
-- - Bible books metadata
-- - Bible verses (multi-version support)
-- - Cross-references
-- - Strong's concordance
-- - Verse-word Strong's mappings
-- - Margin notes (1611 KJV)
--
-- Design principles:
-- - Normalized where it aids consistency (books, strongs)
-- - Denormalized where it aids performance (preview_text, page lookups)
-- - FTS5 for full-text search
-- - Composite PKs for tuple-based lookups
-- - version_code enables future multi-translation support

-- ============================================================================
-- Meta / Version Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ============================================================================
-- Dimension Tables
-- ============================================================================

-- Bible books - canonical list with metadata
CREATE TABLE IF NOT EXISTS books (
  number INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  testament TEXT NOT NULL CHECK(testament IN ('old', 'new')),
  chapters INTEGER NOT NULL
);

-- Bible versions/translations
CREATE TABLE IF NOT EXISTS versions (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  year TEXT,
  copyright TEXT,
  is_default INTEGER NOT NULL DEFAULT 0
);

-- ============================================================================
-- Core Tables
-- ============================================================================

-- Bible verses - main verse storage
CREATE TABLE IF NOT EXISTS verses (
  book INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  version_code TEXT NOT NULL DEFAULT 'KJV',
  text TEXT NOT NULL,
  PRIMARY KEY (version_code, book, chapter, verse),
  FOREIGN KEY (book) REFERENCES books(number),
  FOREIGN KEY (version_code) REFERENCES versions(code)
);

-- Cross-references between verses
CREATE TABLE IF NOT EXISTS cross_refs (
  -- Source verse
  book INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  -- Target verse
  ref_book INTEGER NOT NULL,
  ref_chapter INTEGER NOT NULL,
  ref_verse INTEGER,
  ref_verse_end INTEGER,
  source TEXT NOT NULL DEFAULT 'openbible' CHECK(source IN ('openbible', 'tske')),
  -- Denormalized preview for fast display
  preview_text TEXT,
  PRIMARY KEY (book, chapter, verse, ref_book, ref_chapter, ref_verse),
  FOREIGN KEY (book) REFERENCES books(number),
  FOREIGN KEY (ref_book) REFERENCES books(number)
);

-- Strong's concordance definitions
CREATE TABLE IF NOT EXISTS strongs (
  number TEXT PRIMARY KEY,  -- H1234 or G5678
  language TEXT NOT NULL CHECK(language IN ('hebrew', 'greek')),
  lemma TEXT NOT NULL,
  transliteration TEXT,
  pronunciation TEXT,
  definition TEXT NOT NULL,
  kjv_definition TEXT
);

-- Verse words with Strong's mappings (for word-by-word display)
CREATE TABLE IF NOT EXISTS verse_words (
  book INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  word_index INTEGER NOT NULL,
  word_text TEXT NOT NULL,
  strongs_numbers TEXT,  -- JSON array e.g. ["H430", "H1254"]
  PRIMARY KEY (book, chapter, verse, word_index),
  FOREIGN KEY (book) REFERENCES books(number)
);

-- Normalized Strong's-to-verse mapping (inverted index for concordance)
CREATE TABLE IF NOT EXISTS strongs_verses (
  strongs_number TEXT NOT NULL,
  book INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  word_text TEXT,
  word_index INTEGER,
  PRIMARY KEY (strongs_number, book, chapter, verse, word_index),
  FOREIGN KEY (strongs_number) REFERENCES strongs(number),
  FOREIGN KEY (book) REFERENCES books(number)
);

-- 1611 KJV margin notes (scholarly annotations)
CREATE TABLE IF NOT EXISTS margin_notes (
  book INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  note_index INTEGER NOT NULL,
  note_type TEXT NOT NULL CHECK(note_type IN ('hebrew', 'greek', 'alternate', 'name', 'other')),
  phrase TEXT NOT NULL,
  note_text TEXT NOT NULL,
  PRIMARY KEY (book, chapter, verse, note_index),
  FOREIGN KEY (book) REFERENCES books(number)
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Verse lookups
CREATE INDEX IF NOT EXISTS idx_verses_book_chapter ON verses(version_code, book, chapter);

-- Cross-reference lookups (both directions)
CREATE INDEX IF NOT EXISTS idx_cross_refs_source ON cross_refs(book, chapter, verse);
CREATE INDEX IF NOT EXISTS idx_cross_refs_target ON cross_refs(ref_book, ref_chapter, ref_verse);
CREATE INDEX IF NOT EXISTS idx_cross_refs_source_col ON cross_refs(source);

-- Strong's lookups
CREATE INDEX IF NOT EXISTS idx_strongs_language ON strongs(language);
CREATE INDEX IF NOT EXISTS idx_strongs_lemma ON strongs(lemma);

-- Verse words lookup
CREATE INDEX IF NOT EXISTS idx_verse_words_verse ON verse_words(book, chapter, verse);

-- Concordance lookup (find all verses with a Strong's number)
CREATE INDEX IF NOT EXISTS idx_strongs_verses_number ON strongs_verses(strongs_number);
CREATE INDEX IF NOT EXISTS idx_strongs_verses_verse ON strongs_verses(book, chapter, verse);

-- Margin notes lookup
CREATE INDEX IF NOT EXISTS idx_margin_notes_verse ON margin_notes(book, chapter, verse);

-- ============================================================================
-- Full-Text Search (FTS5)
-- ============================================================================

-- Verse text search
CREATE VIRTUAL TABLE IF NOT EXISTS verses_fts USING fts5(
  text,
  book UNINDEXED,
  chapter UNINDEXED,
  verse UNINDEXED,
  version_code UNINDEXED,
  content=verses,
  content_rowid=rowid,
  tokenize='unicode61 remove_diacritics 1'
);

-- Strong's definition search
CREATE VIRTUAL TABLE IF NOT EXISTS strongs_fts USING fts5(
  lemma,
  definition,
  kjv_definition,
  number UNINDEXED,
  content=strongs,
  content_rowid=rowid,
  tokenize='unicode61 remove_diacritics 1'
);

-- Margin notes search
CREATE VIRTUAL TABLE IF NOT EXISTS margin_notes_fts USING fts5(
  note_text,
  phrase,
  book UNINDEXED,
  chapter UNINDEXED,
  verse UNINDEXED,
  content=margin_notes,
  content_rowid=rowid,
  tokenize='unicode61 remove_diacritics 1'
);

-- ============================================================================
-- Triggers for FTS Sync
-- ============================================================================

-- Verses FTS triggers
CREATE TRIGGER IF NOT EXISTS verses_ai AFTER INSERT ON verses BEGIN
  INSERT INTO verses_fts(rowid, text, book, chapter, verse, version_code)
  VALUES (new.rowid, new.text, new.book, new.chapter, new.verse, new.version_code);
END;

CREATE TRIGGER IF NOT EXISTS verses_ad AFTER DELETE ON verses BEGIN
  INSERT INTO verses_fts(verses_fts, rowid, text, book, chapter, verse, version_code)
  VALUES ('delete', old.rowid, old.text, old.book, old.chapter, old.verse, old.version_code);
END;

CREATE TRIGGER IF NOT EXISTS verses_au AFTER UPDATE ON verses BEGIN
  INSERT INTO verses_fts(verses_fts, rowid, text, book, chapter, verse, version_code)
  VALUES ('delete', old.rowid, old.text, old.book, old.chapter, old.verse, old.version_code);
  INSERT INTO verses_fts(rowid, text, book, chapter, verse, version_code)
  VALUES (new.rowid, new.text, new.book, new.chapter, new.verse, new.version_code);
END;

-- Strong's FTS triggers
CREATE TRIGGER IF NOT EXISTS strongs_ai AFTER INSERT ON strongs BEGIN
  INSERT INTO strongs_fts(rowid, lemma, definition, kjv_definition, number)
  VALUES (new.rowid, new.lemma, new.definition, new.kjv_definition, new.number);
END;

CREATE TRIGGER IF NOT EXISTS strongs_ad AFTER DELETE ON strongs BEGIN
  INSERT INTO strongs_fts(strongs_fts, rowid, lemma, definition, kjv_definition, number)
  VALUES ('delete', old.rowid, old.lemma, old.definition, old.kjv_definition, old.number);
END;

-- Margin notes FTS triggers
CREATE TRIGGER IF NOT EXISTS margin_notes_ai AFTER INSERT ON margin_notes BEGIN
  INSERT INTO margin_notes_fts(rowid, note_text, phrase, book, chapter, verse)
  VALUES (new.rowid, new.note_text, new.phrase, new.book, new.chapter, new.verse);
END;

CREATE TRIGGER IF NOT EXISTS margin_notes_ad AFTER DELETE ON margin_notes BEGIN
  INSERT INTO margin_notes_fts(margin_notes_fts, rowid, note_text, phrase, book, chapter, verse)
  VALUES ('delete', old.rowid, old.note_text, old.phrase, old.book, old.chapter, old.verse);
END;
