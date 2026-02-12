/**
 * Study data hooks — backed by AppService.
 *
 * Returns the AppService itself for study data methods.
 * Components call app.getCrossRefs(...) directly.
 */
import { useApp } from './db-provider';
import type { StudyDataService } from '@/data/study/service';

export function useStudyData(): StudyDataService {
  const app = useApp();
  return app;
}
