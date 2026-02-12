/**
 * DB Provider — Top-level provider that initializes SQLite and the Effect runtime.
 *
 * Blocks rendering until wa-sqlite databases are ready.
 * Creates ManagedRuntime with all Effect services after init.
 * Provides AppService (facade) and raw DbClient via context.
 */
import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { ManagedRuntime, type Layer } from 'effect';
import { getDbClient, type DbClient } from '@/workers/db-client';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { AppLive } from '@/data/layer';
import { AppService, type AppRuntime } from '@/data/app-service';
import type { WebBibleService } from '@/data/bible/effect-service';
import type { AppStateService } from '@/data/state/effect-service';
import type { WebStudyDataService } from '@/data/study/effect-service';
import type { WebSyncService } from '@/data/sync/effect-service';

type AppServices = WebBibleService | AppStateService | WebStudyDataService | WebSyncService;

const AppServiceContext = createContext<AppService | null>(null);
const DbContext = createContext<DbClient | null>(null);

export function DbProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [stage, setStage] = useState('Initializing...');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const appServiceRef = useRef<AppService | null>(null);
  const dbClientRef = useRef<DbClient | null>(null);
  const runtimeRef = useRef<AppRuntime | null>(null);

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
        appServiceRef.current = new AppService(runtime);
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
      <AppServiceContext.Provider value={appServiceRef.current}>
        {children}
      </AppServiceContext.Provider>
    </DbContext.Provider>
  );
}

export function useApp(): AppService {
  const ctx = useContext(AppServiceContext);
  if (!ctx) throw new Error('useApp must be used within a DbProvider');
  return ctx;
}

export function useDb(): DbClient {
  const ctx = useContext(DbContext);
  if (!ctx) throw new Error('useDb must be used within a DbProvider');
  return ctx;
}
