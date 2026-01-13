/**
 * Study Database Performance Tests
 *
 * These tests verify query performance stays within acceptable bounds.
 * Run with: bun test test/perf/
 *
 * Note: These tests require the real study.db to be populated.
 * Run `bun run src/main.ts bible` once to initialize the database.
 */

import { describe, expect, it, beforeAll } from 'bun:test';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import {
  initStudyDatabase,
  getCrossRefs,
  getStrongsEntry,
  getVerseWords,
  getMarginNotes,
  searchByStrongs,
  searchStrongsByDefinition,
} from '../../src/data/study/study-db.js';

const DB_PATH = join(homedir(), '.bible', 'study.db');

describe('Study Database Performance', () => {
  beforeAll(async () => {
    if (!existsSync(DB_PATH)) {
      console.log('Study database not found at', DB_PATH);
      console.log('Run `bun run src/main.ts bible` to initialize it.');
      return;
    }
    await initStudyDatabase();
  });

  it('getCrossRefs should complete in < 10ms', () => {
    if (!existsSync(DB_PATH)) return;

    const start = performance.now();
    const refs = getCrossRefs(43, 3, 16); // John 3:16
    const elapsed = performance.now() - start;

    console.log(`getCrossRefs: ${elapsed.toFixed(2)}ms, ${refs.length} refs`);
    expect(refs.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(10);
  });

  it('getCrossRefs should include preview text', () => {
    if (!existsSync(DB_PATH)) return;

    const refs = getCrossRefs(43, 3, 16); // John 3:16
    const withPreview = refs.filter((r) => r.previewText);

    console.log(`  ${withPreview.length}/${refs.length} refs have preview text`);
    expect(withPreview.length).toBeGreaterThan(0);
  });

  it('getStrongsEntry should complete in < 5ms', () => {
    if (!existsSync(DB_PATH)) return;

    const start = performance.now();
    const entry = getStrongsEntry('H430'); // Elohim
    const elapsed = performance.now() - start;

    console.log(`getStrongsEntry: ${elapsed.toFixed(2)}ms`);
    expect(entry).toBeDefined();
    // Just check entry exists and has data
    expect(entry?.def).toBeDefined();
    expect(elapsed).toBeLessThan(5);
  });

  it('searchByStrongs should complete in < 50ms (using strongs_verses index)', () => {
    if (!existsSync(DB_PATH)) return;

    const start = performance.now();
    const results = searchByStrongs('H430'); // Common word - Elohim
    const elapsed = performance.now() - start;

    console.log(
      `searchByStrongs H430: ${elapsed.toFixed(2)}ms, ${results.length} verses`,
    );
    expect(results.length).toBeGreaterThan(100);
    expect(elapsed).toBeLessThan(50); // Should be much faster with index
  });

  it('searchByStrongs should complete in < 50ms for Greek words', () => {
    if (!existsSync(DB_PATH)) return;

    const start = performance.now();
    const results = searchByStrongs('G26'); // Agape (love)
    const elapsed = performance.now() - start;

    console.log(
      `searchByStrongs G26: ${elapsed.toFixed(2)}ms, ${results.length} verses`,
    );
    expect(results.length).toBeGreaterThan(10); // At least some results
    expect(elapsed).toBeLessThan(50);
  });

  it('searchStrongsByDefinition should complete in < 20ms (using FTS5)', () => {
    if (!existsSync(DB_PATH)) return;

    const start = performance.now();
    const results = searchStrongsByDefinition('love');
    const elapsed = performance.now() - start;

    console.log(
      `searchStrongsByDefinition 'love': ${elapsed.toFixed(2)}ms, ${results.length} entries`,
    );
    expect(results.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(20);
  });

  it('getMarginNotes should complete in < 10ms', () => {
    if (!existsSync(DB_PATH)) return;

    const start = performance.now();
    const notes = getMarginNotes(1, 1, 1); // Gen 1:1
    const elapsed = performance.now() - start;

    console.log(`getMarginNotes: ${elapsed.toFixed(2)}ms, ${notes.length} notes`);
    expect(notes.length).toBeGreaterThanOrEqual(0);
    expect(elapsed).toBeLessThan(10);
  });

  it('getVerseWords should complete in < 5ms', () => {
    if (!existsSync(DB_PATH)) return;

    const start = performance.now();
    const words = getVerseWords(1, 1, 1); // Gen 1:1
    const elapsed = performance.now() - start;

    console.log(`getVerseWords: ${elapsed.toFixed(2)}ms, ${words.length} words`);
    expect(words.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(5);
  });

  it('batch getCrossRefs for 50 verses should complete in < 200ms', () => {
    if (!existsSync(DB_PATH)) return;

    const verses = Array.from({ length: 50 }, (_, i) => ({
      book: 1,
      chapter: 1,
      verse: i + 1,
    }));

    const start = performance.now();
    let totalRefs = 0;
    for (const verse of verses) {
      const refs = getCrossRefs(verse.book, verse.chapter, verse.verse);
      totalRefs += refs.length;
    }
    const elapsed = performance.now() - start;

    console.log(
      `batch getCrossRefs (50 verses): ${elapsed.toFixed(2)}ms, ${totalRefs} total refs`,
    );
    expect(elapsed).toBeLessThan(200);
  });
});
