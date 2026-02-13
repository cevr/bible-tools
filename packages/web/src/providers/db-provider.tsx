/**
 * DB Provider — Top-level provider that initializes SQLite and the Effect runtime.
 *
 * Blocks rendering until wa-sqlite databases are ready.
 * Creates ManagedRuntime with all Effect services after init.
 * Provides CachedApp (suspending reads) and raw DbClient via context.
 */
import {
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { ManagedRuntime, type Layer } from 'effect';
import { getDbClient, type DbClient } from '@/workers/db-client';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { AppLive } from '@/data/layer';
import { AppService, type AppRuntime } from '@/data/app-service';
import { type CachedAppCore, createCachedApp, type CachedService } from '@/lib/cached-app';
import { CachedAppContext, DbContext } from '@/providers/db-context';
import type { WebBibleService } from '@/data/bible/effect-service';
import type { AppStateService } from '@/data/state/effect-service';
import type { WebStudyDataService } from '@/data/study/effect-service';
import type { WebSyncService } from '@/data/sync/effect-service';

type AppServices = WebBibleService | AppStateService | WebStudyDataService | WebSyncService;

export type CachedApp = CachedService<AppService>;

export function DbProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [stage, setStage] = useState('Initializing...');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const appServiceRef = useRef<AppService | null>(null);
  const dbClientRef = useRef<DbClient | null>(null);
  const runtimeRef = useRef<AppRuntime | null>(null);
  const cachedAppRef = useRef<CachedAppCore | null>(null);

  useEffect(() => {
    let disposed = false;
    const client = getDbClient();
    dbClientRef.current = client;

    client.onProgress((s, p) => {
      if (!disposed) {
        setStage(s);
        setProgress(p);
      }
    });

    client
      .init()
      .then(() => {
        if (disposed) return;
        console.log('[db-provider] db ready, creating runtime');
        const runtime = ManagedRuntime.make(AppLive as Layer.Layer<AppServices, never, never>);
        runtimeRef.current = runtime;
        const appService = new AppService(runtime, client);
        appServiceRef.current = appService;
        const cachedApp = createCachedApp(appService);
        cachedAppRef.current = cachedApp;

        // Warm caches for data that's needed on first render
        cachedApp.preload('getPosition');
        cachedApp.preload('getPreferences');
        cachedApp.preload('getBookmarks');
        cachedApp.preload('getHistory');

        setReady(true);
        console.log('[db-provider] ready');
      })
      .catch((err) => {
        if (disposed) return;
        console.error('[db-provider] FAILED', err);
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      disposed = true;
      runtimeRef.current?.dispose().catch((err) => {
        console.warn('[db-provider] runtime dispose error:', err);
      });
    };
  }, []);

  if (!ready) {
    return (
      <LoadingScreen
        stage={stage}
        progress={progress}
        error={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <DbContext.Provider value={dbClientRef.current}>
      <CachedAppContext.Provider value={cachedAppRef.current}>{children}</CachedAppContext.Provider>
    </DbContext.Provider>
  );
}

/**
 * Hook that returns a CachedApp proxy.
 *
 * Read methods suspend (return T, not Promise<T>).
 * Write methods return Promise as-is.
 * Only re-renders when a cache that was accessed during render is invalidated.
 */
export function useApp(): CachedApp {
  const core = useContext(CachedAppContext);
  if (!core) throw new Error('useApp must be used within a DbProvider');

  const accessedRef = useRef(new Set<string>());
  // Clear accessed set each render so we only track current render's reads
  accessedRef.current.clear();

  useSyncExternalStore(
    core.subscribe,
    () => core.snapshotFor(accessedRef.current),
    () => core.snapshotFor(accessedRef.current),
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => core.withTracking(accessedRef.current), [core]) as unknown as CachedApp;
}

export function useDb(): DbClient {
  const ctx = useContext(DbContext);
  if (!ctx) throw new Error('useDb must be used within a DbProvider');
  return ctx;
}
