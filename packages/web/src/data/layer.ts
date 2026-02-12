import { Layer } from 'effect';
import { DbClientService } from './db-client-service';
import { WebBibleService } from './bible/effect-service';
import { AppStateService } from './state/effect-service';
import { WebStudyDataService } from './study/effect-service';
import { WebSyncService } from './sync/effect-service';

export const AppLive = Layer.mergeAll(
  WebBibleService.Live,
  AppStateService.Live,
  WebStudyDataService.Live,
  WebSyncService.Live,
).pipe(Layer.provide(DbClientService.Live));
