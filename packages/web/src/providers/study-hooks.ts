/**
 * Study data hooks — Effect-backed study data access.
 *
 * Drop-in replacement for the old StudyDataProvider context.
 * Returns a promise-based interface matching StudyDataService.
 */
import { Effect } from 'effect';
import { WebStudyDataService } from '@/data/study/effect-service';
import type { StudyDataService } from '@/data/study/service';
import { useRuntime } from './db-provider';

/**
 * Hook providing study data (cross-refs, Strong's, margin notes, etc.)
 * backed by the Effect runtime. Same API as the old useStudyData().
 */
export function useStudyData(): StudyDataService {
  const runtime = useRuntime();

  function run<A>(effect: Effect.Effect<A, unknown, WebStudyDataService>): Promise<A> {
    return runtime.runPromise(effect as Effect.Effect<A, never, WebStudyDataService>);
  }

  return {
    getCrossRefs: (book, chapter, verse) =>
      run(Effect.flatMap(WebStudyDataService, (s) => s.getCrossRefs(book, chapter, verse))),
    getStrongsEntry: (number) =>
      run(Effect.flatMap(WebStudyDataService, (s) => s.getStrongsEntry(number))),
    getVerseWords: (book, chapter, verse) =>
      run(Effect.flatMap(WebStudyDataService, (s) => s.getVerseWords(book, chapter, verse))),
    getMarginNotes: (book, chapter, verse) =>
      run(Effect.flatMap(WebStudyDataService, (s) => s.getMarginNotes(book, chapter, verse))),
    getChapterMarginNotes: (book, chapter) =>
      run(Effect.flatMap(WebStudyDataService, (s) => s.getChapterMarginNotes(book, chapter))),
    searchByStrongs: (number) =>
      run(Effect.flatMap(WebStudyDataService, (s) => s.searchByStrongs(number))),
    setRefType: (source, target, type) =>
      run(Effect.flatMap(WebStudyDataService, (s) => s.setRefType(source, target, type))),
    addUserCrossRef: (source, target, opts) =>
      run(Effect.flatMap(WebStudyDataService, (s) => s.addUserCrossRef(source, target, opts))),
    removeUserCrossRef: (id) =>
      run(Effect.flatMap(WebStudyDataService, (s) => s.removeUserCrossRef(id))),
  };
}
