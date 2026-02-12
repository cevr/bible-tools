/**
 * DB Provider — Top-level provider that initializes SQLite and the Effect runtime.
 *
 * Blocks rendering until wa-sqlite databases are ready.
 * Creates ManagedRuntime with all Effect services after init.
 */
import {
  createContext,
  useContext,
  type ParentComponent,
  createSignal,
  onMount,
  onCleanup,
  Show,
} from 'solid-js';
import { ManagedRuntime } from 'effect';
import type { Layer } from 'effect';
import { getDbClient, type DbClient } from '@/workers/db-client';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { AppLive } from '@/data/layer';
import type { WebBibleService } from '@/data/bible/effect-service';
import type { AppStateService } from '@/data/state/effect-service';
import type { WebStudyDataService } from '@/data/study/effect-service';
import type { WebSyncService } from '@/data/sync/effect-service';

type AppServices = WebBibleService | AppStateService | WebStudyDataService | WebSyncService;
type AppRuntime = ManagedRuntime.ManagedRuntime<AppServices, never>;

const DbContext = createContext<DbClient>();
const RuntimeContext = createContext<AppRuntime>();

export const DbProvider: ParentComponent = (props) => {
  const [ready, setReady] = createSignal(false);
  const [stage, setStage] = createSignal('Initializing...');
  const [progress, setProgress] = createSignal(0);
  const [error, setError] = createSignal<string | null>(null);

  const client = getDbClient();
  let runtime: AppRuntime | undefined;

  async function initialize() {
    console.log('[db-provider] initialize: starting');
    setReady(false);
    setError(null);
    setStage('Initializing...');
    setProgress(0);

    client.onProgress((s, p) => {
      setStage(s);
      setProgress(p);
    });

    try {
      await client.init();
      console.log('[db-provider] initialize: db ready, creating runtime');
      runtime = ManagedRuntime.make(AppLive as Layer.Layer<AppServices, never, never>);
      setReady(true);
      console.log('[db-provider] initialize: done, ready=true');
    } catch (err) {
      console.error('[db-provider] initialize: FAILED', err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  onMount(() => {
    void initialize();
  });

  onCleanup(() => {
    if (runtime) {
      runtime.dispose().catch((err) => {
        console.warn('[db-provider] runtime dispose error:', err);
      });
    }
  });

  return (
    <Show
      when={ready()}
      fallback={
        <LoadingScreen
          stage={stage()}
          progress={progress()}
          error={error()}
          onRetry={() => {
            window.location.reload();
          }}
        />
      }
    >
      <DbContext.Provider value={client}>
        <RuntimeContext.Provider value={runtime as AppRuntime}>
          {props.children}
        </RuntimeContext.Provider>
      </DbContext.Provider>
    </Show>
  );
};

export function useDb(): DbClient {
  const ctx = useContext(DbContext);
  if (!ctx) {
    throw new Error('useDb must be used within a DbProvider');
  }
  return ctx;
}

export function useRuntime(): AppRuntime {
  const ctx = useContext(RuntimeContext);
  if (!ctx) {
    throw new Error('useRuntime must be used within a DbProvider');
  }
  return ctx;
}
