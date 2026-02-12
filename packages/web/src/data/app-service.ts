/**
 * AppService — facade that wraps ManagedRuntime and exposes every Effect
 * service method as a plain Promise-returning function.
 *
 * Components never import Effect directly.
 */
import { Effect, type ManagedRuntime } from 'effect';
import type { ChapterResponse, SearchResult, Verse } from '@bible/api';

import { WebBibleService } from './bible/effect-service';
import {
  AppStateService,
  type Bookmark,
  type HistoryEntry,
  type Position,
  type Preferences,
} from './state/effect-service';
import { WebStudyDataService } from './study/effect-service';
import { WebSyncService } from './sync/effect-service';
import type {
  ClassifiedCrossReference,
  ConcordanceResult,
  CrossRefType,
  MarginNote,
  StrongsEntry,
  UserCrossRef,
  VerseWord,
} from './study/service';
import type { Reference } from './bible/types';

type AppServices = WebBibleService | AppStateService | WebStudyDataService | WebSyncService;
export type AppRuntime = ManagedRuntime.ManagedRuntime<AppServices, never>;

export class AppService {
  constructor(private runtime: AppRuntime) {}

  // ---------------------------------------------------------------------------
  // Bible
  // ---------------------------------------------------------------------------

  fetchChapter(book: number, chapter: number): Promise<ChapterResponse> {
    return this.run(WebBibleService, (s) => s.fetchChapter(book, chapter));
  }

  fetchVerses(book: number, chapter: number): Promise<readonly Verse[]> {
    return this.run(WebBibleService, (s) => s.fetchVerses(book, chapter));
  }

  searchVerses(query: string, limit?: number): Promise<readonly SearchResult[]> {
    return this.run(WebBibleService, (s) => s.searchVerses(query, limit));
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  getPosition(): Promise<Position> {
    return this.run(AppStateService, (s) => s.getPosition());
  }

  setPosition(pos: Position): Promise<void> {
    return this.run(AppStateService, (s) => s.setPosition(pos));
  }

  getBookmarks(): Promise<Bookmark[]> {
    return this.run(AppStateService, (s) => s.getBookmarks());
  }

  addBookmark(ref: Reference, note?: string): Promise<Bookmark> {
    return this.run(AppStateService, (s) => s.addBookmark(ref, note));
  }

  removeBookmark(id: string): Promise<void> {
    return this.run(AppStateService, (s) => s.removeBookmark(id));
  }

  getHistory(limit?: number): Promise<HistoryEntry[]> {
    return this.run(AppStateService, (s) => s.getHistory(limit));
  }

  addToHistory(ref: Reference): Promise<void> {
    return this.run(AppStateService, (s) => s.addToHistory(ref));
  }

  clearHistory(): Promise<void> {
    return this.run(AppStateService, (s) => s.clearHistory());
  }

  getPreferences(): Promise<Preferences> {
    return this.run(AppStateService, (s) => s.getPreferences());
  }

  setPreferences(prefs: Partial<Preferences>): Promise<void> {
    return this.run(AppStateService, (s) => s.setPreferences(prefs));
  }

  // ---------------------------------------------------------------------------
  // Study
  // ---------------------------------------------------------------------------

  getCrossRefs(book: number, chapter: number, verse: number): Promise<ClassifiedCrossReference[]> {
    return this.run(WebStudyDataService, (s) => s.getCrossRefs(book, chapter, verse));
  }

  getStrongsEntry(number: string): Promise<StrongsEntry | null> {
    return this.run(WebStudyDataService, (s) => s.getStrongsEntry(number));
  }

  getVerseWords(book: number, chapter: number, verse: number): Promise<VerseWord[]> {
    return this.run(WebStudyDataService, (s) => s.getVerseWords(book, chapter, verse));
  }

  getMarginNotes(book: number, chapter: number, verse: number): Promise<MarginNote[]> {
    return this.run(WebStudyDataService, (s) => s.getMarginNotes(book, chapter, verse));
  }

  getChapterMarginNotes(book: number, chapter: number): Promise<Map<number, MarginNote[]>> {
    return this.run(WebStudyDataService, (s) => s.getChapterMarginNotes(book, chapter));
  }

  searchByStrongs(number: string): Promise<ConcordanceResult[]> {
    return this.run(WebStudyDataService, (s) => s.searchByStrongs(number));
  }

  setRefType(
    source: { book: number; chapter: number; verse: number },
    target: { book: number; chapter: number; verse: number | null },
    type: CrossRefType,
  ): Promise<void> {
    return this.run(WebStudyDataService, (s) => s.setRefType(source, target, type));
  }

  addUserCrossRef(
    source: { book: number; chapter: number; verse: number },
    target: { book: number; chapter: number; verse?: number; verseEnd?: number },
    opts?: { type?: CrossRefType; note?: string },
  ): Promise<UserCrossRef> {
    return this.run(WebStudyDataService, (s) => s.addUserCrossRef(source, target, opts));
  }

  removeUserCrossRef(id: string): Promise<void> {
    return this.run(WebStudyDataService, (s) => s.removeUserCrossRef(id));
  }

  // ---------------------------------------------------------------------------
  // Sync
  // ---------------------------------------------------------------------------

  syncNow(): Promise<void> {
    return this.run(WebSyncService, (s) => s.syncNow());
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private run<A>(tag: any, fn: (s: any) => Effect.Effect<A, any, any>): Promise<A> {
    return this.runtime.runPromise(Effect.flatMap(tag, fn)) as Promise<A>;
  }
}
