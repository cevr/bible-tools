/**
 * DB Provider — Top-level provider that initializes SQLite and the Effect runtime.
 *
 * Blocks rendering until wa-sqlite databases are ready.
 * Creates ManagedRuntime with all Effect services after init.
 * Provides CachedApp (suspending reads) and raw DbClient via context.
 */
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { ManagedRuntime, type Layer } from 'effect';
import { getDbClient, type DbClient } from '@/workers/db-client';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { AppLive } from '@/data/layer';
import { AppService, type AppRuntime } from '@/data/app-service';
import { type CachedAppCore, createCachedApp } from '@/lib/cached-app';
import { CachedAppContext, DbContext } from '@/providers/db-context';
import type { WebBibleService } from '@/data/bible/effect-service';
import type { AppStateService } from '@/data/state/effect-service';
import type { WebStudyDataService } from '@/data/study/effect-service';
import type { WebSyncService } from '@/data/sync/effect-service';

const log = import.meta.env.DEV ? (...args: unknown[]) => console.log(...args) : () => {};

type AppServices = WebBibleService | AppStateService | WebStudyDataService | WebSyncService;

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
        log('[db-provider] db ready, creating runtime');
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
        log('[db-provider] ready');
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
